#!/usr/bin/env node
// Apply schema.sql to a Cloudflare D1 database one statement at a time.
//
// Why not `wrangler d1 execute --remote --file=schema.sql`? That path hits
// CF's D1 `/import` API endpoint, which returns "Authentication error
// [code: 10000]" on OAuth-token sessions as of wrangler 4.84.x. The
// single-statement path (`--command <sql>`) hits a different endpoint
// that doesn't have the bug. This script splits the schema on `;`
// boundaries and streams each statement through `--command`.
//
// Usage:
//   node tools/apply-d1-schema.mjs \
//     --db pokebells-indexer \
//     --file game/indexer/schema.sql
//
//   # Preview without executing:
//   node tools/apply-d1-schema.mjs ... --dry-run
//
// Requires wrangler 4.84+ on PATH (or via npx, which we use by default).

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    db: null,
    file: null,
    dryRun: false,
    remote: true,
    skipErrors: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const val = argv[i + 1];
    switch (flag) {
      case '--db':          args.db = val; i += 1; break;
      case '--file':        args.file = val; i += 1; break;
      case '--dry-run':     args.dryRun = true; break;
      case '--local':       args.remote = false; break;
      case '--skip-errors': args.skipErrors = true; break;
      case '--help': case '-h':
        console.log(
          'Usage: node tools/apply-d1-schema.mjs --db <name> --file <path> [--dry-run] [--local] [--skip-errors]'
        );
        process.exit(0);
    }
  }
  if (!args.db || !args.file) {
    throw new Error('Both --db and --file are required. Use --help for options.');
  }
  return args;
}

// Minimal SQL statement splitter. Walks character-by-character so we don't
// accidentally split inside a string literal (single-quoted) or a line
// comment (`--`). Multi-line comments (`/* */`) are also respected.
// Semicolons that terminate statements are the split boundary.
function splitSqlStatements(sql) {
  const statements = [];
  let buffer = '';
  let i = 0;
  const len = sql.length;
  let inSingle = false, inDouble = false, inLineComment = false, inBlockComment = false;

  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      buffer += ch;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; buffer += '*/'; i += 2; continue; }
      buffer += ch;
      i += 1;
      continue;
    }
    if (inSingle) {
      buffer += ch;
      if (ch === "'" && sql[i - 1] !== '\\') inSingle = false;
      i += 1;
      continue;
    }
    if (inDouble) {
      buffer += ch;
      if (ch === '"' && sql[i - 1] !== '\\') inDouble = false;
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') { inLineComment = true; buffer += '--'; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; buffer += '/*'; i += 2; continue; }
    if (ch === "'") { inSingle = true; buffer += ch; i += 1; continue; }
    if (ch === '"') { inDouble = true; buffer += ch; i += 1; continue; }

    if (ch === ';') {
      const trimmed = buffer.trim();
      if (trimmed) statements.push(trimmed);
      buffer = '';
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  const tail = buffer.trim();
  if (tail) statements.push(tail);

  // Drop pure-comment statements (no actual SQL keyword).
  return statements.filter((s) => {
    const stripped = s
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    return stripped.length > 0;
  });
}

// Flatten a multi-line SQL statement into a single line, stripping SQL
// comments along the way. Needed because cmd.exe on Windows treats
// embedded newlines as end-of-command and breaks `--command "..."`.
// Safe for our schema where no string literal contains `--` or `/*`;
// for general SQL with such embedded sequences, this would need a
// tokenizer. We also drop --/block comments because once collapsed to
// one line a `--` at the start would eat the rest of the statement.
function sanitizeForCli(statement) {
  return statement
    .replace(/--[^\n\r]*/g, ' ')          // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')    // block comments
    .replace(/\s+/g, ' ')                 // collapse whitespace
    .trim();
}

function describe(statement) {
  const first = sanitizeForCli(statement).slice(0, 80);
  return first.length >= 80 ? first + '…' : first;
}

// Quote an argument for the platform's native shell. Needed because we
// go through `shell: true` — Node 20+ refuses to exec .cmd files directly
// via spawn without a shell (CVE-2024-27980 mitigation), so on Windows
// we MUST let cmd.exe handle npx.cmd. We escape manually to keep SQL
// intact (double quotes, spaces, ampersands, carets, percents).
function quoteForShell(arg) {
  if (process.platform === 'win32') {
    // cmd.exe rules: wrap in "..." and double internal `"` to `""`. Also
    // escape cmd metacharacters that aren't protected by double quotes:
    // `%` (variable expansion) via `"%"^"%"` pattern, `!` (delayed
    // expansion). Our schema.sql only contains `"` so the simple wrap
    // is safe; we add `%` escaping defensively for future statements.
    const escaped = String(arg)
      .replace(/"/g, '""')
      .replace(/%/g, '"%"');
    return `"${escaped}"`;
  }
  // POSIX sh: wrap in single quotes; close + `'\''` + reopen for internal `'`.
  return `'${String(arg).replace(/'/g, "'\\''")}'`;
}

function runWrangler(dbName, statement, { remote, dryRun }) {
  // Flatten to a single line BEFORE shell-quoting. cmd.exe ends the
  // command line at the first unescaped newline; SQL doesn't care about
  // whitespace (outside string literals) so this is lossless for DDL.
  const oneLine = sanitizeForCli(statement);
  if (!oneLine) return { status: 0, skipped: true };

  const parts = [
    'npx', 'wrangler', 'd1', 'execute',
    quoteForShell(dbName),
    remote ? '--remote' : '--local',
    '--command', quoteForShell(oneLine),
    '--yes',
  ];
  const cmdline = parts.join(' ');
  if (dryRun) {
    console.log('  [dry-run]', cmdline.slice(0, 160) + (cmdline.length > 160 ? '…' : ''));
    return { status: 0, dryRun: true };
  }
  // shell:true → cmd.exe on Windows / sh on POSIX interprets the full
  // command line. Works around Node's .cmd block + lets PATH find npx.
  const result = spawnSync(cmdline, { stdio: 'inherit', shell: true });
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const absFile = isAbsolute(args.file) ? args.file : join(REPO, args.file);
  const sql = await readFile(absFile, 'utf8');
  const statements = splitSqlStatements(sql);

  console.log(`Parsed ${statements.length} SQL statements from ${args.file}`);
  console.log(`Target: ${args.db} (${args.remote ? 'remote' : 'local'})`);
  if (args.dryRun) console.log('Dry run — no changes will be made.');
  console.log('');

  let ok = 0;
  let failed = 0;
  for (let idx = 0; idx < statements.length; idx += 1) {
    const stmt = statements[idx];
    console.log(`[${idx + 1}/${statements.length}] ${describe(stmt)}`);
    const result = runWrangler(args.db, stmt, args);
    if (result.status === 0) {
      ok += 1;
    } else {
      failed += 1;
      console.error(`  ✗ Statement failed with exit code ${result.status}`);
      if (!args.skipErrors) {
        console.error('  Aborting. Re-run with --skip-errors to continue past failures.');
        process.exit(result.status ?? 1);
      }
    }
  }

  console.log('');
  console.log(`Summary: ${ok} ok, ${failed} failed, ${statements.length} total.`);
  if (failed > 0) process.exit(1);
}

await main().catch((error) => {
  console.error('[apply-d1-schema] fatal:', error?.stack ?? error);
  process.exit(1);
});
