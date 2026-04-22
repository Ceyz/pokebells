import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTESTATION_SCHEME,
  ATTESTATION_SCHEME_V2,
  CAPTURE_SCHEMA_VERSION,
  GEN2_UNSUPPORTED_LABEL,
  IVS_COMMITMENT_SCHEME,
  PARTY_OFFSETS,
  RAM_ADDRS,
  SAVE_SNAPSHOT_SCHEME,
  SRAM_TOTAL_BYTE_LENGTH,
  SVBK_REGISTER,
  WRAM_BANK0_BYTE_LENGTH,
  WRAM_BYTE_LENGTH,
  buildCaptureProvenance,
  buildCapturedPokemonRecord,
  buildRevealRecord,
  buildSaveSnapshotRecord,
  buildSpriteImageResolver,
  catchChancePercent,
  computeCatchChance,
  computeIvsCommitment,
  deriveGbcHpIv,
  isGen2Shiny,
  parseGbcDvs,
  readRamSnapshot,
  readSramSnapshot,
  statusNameFromByte,
  validateCapturedPokemonRecord,
  validateRevealRecord,
  validateSaveSnapshotRecord,
  writeSramSnapshot,
} from './capture-core.mjs';
import {
  getGen2SpeciesCatalog,
  getSpeciesByDexNo,
} from './gen2-species.mjs';

function loadCatalog() {
  return getGen2SpeciesCatalog();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Build a ReadByte-compatible memory image backing a single Crystal party mon
// at slot 2. Uses the Gen 2 PARTYMON layout (48 bytes). The test writes all
// bytes the capture record reads, so the memory outside the party/battle
// windows can stay zeroed without affecting assertions.
function buildMemoryForSpecies(speciesEntry, level) {
  const memory = new Uint8Array(0x10000);
  const slotIndex = 2;
  const slotBase = RAM_ADDRS.teamSlotBase + ((slotIndex - 1) * RAM_ADDRS.teamSlotSize);

  // Fill WRAM window with a known pattern so the SHA-256 attestation is
  // deterministic across test runs.
  for (let address = 0xc000; address < 0xe000; address += 1) {
    memory[address] = address & 0xff;
  }

  memory[slotBase + PARTY_OFFSETS.species] = speciesEntry.dexNo;
  memory[slotBase + PARTY_OFFSETS.heldItem] = 0;
  for (let index = 0; index < 4; index += 1) {
    memory[slotBase + PARTY_OFFSETS.moves + index] = 33 + index; // arbitrary legal ids
  }
  memory[slotBase + PARTY_OFFSETS.originalTrainerId] = 0x12;
  memory[slotBase + PARTY_OFFSETS.originalTrainerId + 1] = 0x34;
  memory[slotBase + PARTY_OFFSETS.experience] = 0x01;
  memory[slotBase + PARTY_OFFSETS.experience + 1] = 0x02;
  memory[slotBase + PARTY_OFFSETS.experience + 2] = 0x03;
  memory[slotBase + PARTY_OFFSETS.hpExp] = 0x00;
  memory[slotBase + PARTY_OFFSETS.hpExp + 1] = 0x64;
  memory[slotBase + PARTY_OFFSETS.atkExp] = 0x00;
  memory[slotBase + PARTY_OFFSETS.atkExp + 1] = 0xc8;
  memory[slotBase + PARTY_OFFSETS.defExp] = 0x01;
  memory[slotBase + PARTY_OFFSETS.defExp + 1] = 0x2c;
  memory[slotBase + PARTY_OFFSETS.speExp] = 0x01;
  memory[slotBase + PARTY_OFFSETS.speExp + 1] = 0x90;
  memory[slotBase + PARTY_OFFSETS.spcExp] = 0x01;
  memory[slotBase + PARTY_OFFSETS.spcExp + 1] = 0xf4;
  memory[slotBase + PARTY_OFFSETS.attackDefenseDv] = 0xab; // ATK=10, DEF=11
  memory[slotBase + PARTY_OFFSETS.speedSpecialDv] = 0xcd;  // SPE=12, SPC=13
  memory[slotBase + PARTY_OFFSETS.pp] = 35;
  memory[slotBase + PARTY_OFFSETS.pp + 1] = 15;
  memory[slotBase + PARTY_OFFSETS.pp + 2] = 20;
  memory[slotBase + PARTY_OFFSETS.pp + 3] = 0;
  memory[slotBase + PARTY_OFFSETS.happiness] = 70;
  memory[slotBase + PARTY_OFFSETS.pokerus] = 0;
  memory[slotBase + PARTY_OFFSETS.caughtData] = 0x56;
  memory[slotBase + PARTY_OFFSETS.caughtData + 1] = 0x78;
  memory[slotBase + PARTY_OFFSETS.level] = level;
  memory[slotBase + PARTY_OFFSETS.status] = 0x40; // paralyze
  memory[slotBase + PARTY_OFFSETS.currentHp] = 0x00;
  memory[slotBase + PARTY_OFFSETS.currentHp + 1] = 0x23;
  memory[slotBase + PARTY_OFFSETS.maxHp] = 0x00;
  memory[slotBase + PARTY_OFFSETS.maxHp + 1] = 0x30;
  memory[slotBase + PARTY_OFFSETS.attack] = 0x00;
  memory[slotBase + PARTY_OFFSETS.attack + 1] = 0x2a;
  memory[slotBase + PARTY_OFFSETS.defense] = 0x00;
  memory[slotBase + PARTY_OFFSETS.defense + 1] = 0x1f;
  memory[slotBase + PARTY_OFFSETS.speed] = 0x00;
  memory[slotBase + PARTY_OFFSETS.speed + 1] = 0x25;
  memory[slotBase + PARTY_OFFSETS.specialAttack] = 0x00;
  memory[slotBase + PARTY_OFFSETS.specialAttack + 1] = 0x30;
  memory[slotBase + PARTY_OFFSETS.specialDefense] = 0x00;
  memory[slotBase + PARTY_OFFSETS.specialDefense + 1] = 0x32;

  return { memory, slotIndex, slotBase };
}

// Fixed salt for reproducible commitments across test runs.
const TEST_SALT_BYTES = new Uint8Array(32).fill(0x42);

async function makeValidRecord(options = {}) {
  const catalog = loadCatalog();
  const speciesEntry = getSpeciesByDexNo(catalog, options.dexNo ?? 25);
  const level = options.level ?? 17;
  const { memory, slotIndex, slotBase } = buildMemoryForSpecies(speciesEntry, level);
  if (options.mutateMemory) options.mutateMemory(memory, slotIndex);
  const readByte = (address) => memory[address];

  // v1.4: caller reads DVs + IVs first, hands them to provenance so the
  // commitment binds the public record to the raw values. privateReveal
  // is returned alongside so the caller can build op:"reveal" later.
  const atkDefDv = memory[slotBase + PARTY_OFFSETS.attackDefenseDv];
  const spdSpcDv = memory[slotBase + PARTY_OFFSETS.speedSpecialDv];
  const ivs = parseGbcDvs(atkDefDv, spdSpcDv);

  const provenance = await buildCaptureProvenance(readByte, {
    network: 'bells-testnet',
    signedInWallet: 'tb1ptestwallet000000000000000000000000000000',
    sessionSequenceNumber: 1,
    blockHashAtCapture: 'a'.repeat(64),
    ivs,
    ivsSaltBytes: TEST_SALT_BYTES,
  });
  const record = buildCapturedPokemonRecord(readByte, {
    slotIndex,
    now: '2026-04-22T10:00:00.000Z',
    romName: 'pokecrystal.gbc',
    captureNetwork: 'bells-testnet',
    captureProvenance: provenance,
    speciesResolver(internalSpeciesId) {
      return catalog.byInternalId.get(internalSpeciesId) ?? null;
    },
  });
  return { catalog, record, speciesEntry, provenance, slotIndex, slotBase, readByte, ivs };
}

test('parseGbcDvs decodes packed nibbles (format unchanged Gen 1 -> Gen 2)', () => {
  assert.deepEqual(parseGbcDvs(0xe4, 0xb7), {
    atk: 14,
    def: 4,
    spe: 11,
    spd: 7,
  });
  assert.equal(deriveGbcHpIv({ atk: 14, def: 4, spe: 11, spd: 7 }), 3);
});

test('readSramSnapshot walks all 4 MBC3 banks and writeSramSnapshot round-trips', () => {
  // Minimal MBC3 SRAM fake: `bankedSram` is a 32 KB backing store; we
  // expose read/write functions that bank-switch via writes to 0x4000.
  // Writes to 0x0000 are the RAM-enable register (noop in fake).
  const bankedSram = new Uint8Array(SRAM_TOTAL_BYTE_LENGTH);
  let currentBank = 0;
  // Fill each bank with a distinct byte pattern to verify we read them.
  for (let bank = 0; bank < 4; bank += 1) {
    for (let i = 0; i < 0x2000; i += 1) {
      bankedSram[bank * 0x2000 + i] = (bank * 0x40 + (i & 0x3f)) & 0xff;
    }
  }
  const readByte = (address) => {
    if (address >= 0xa000 && address < 0xc000) {
      return bankedSram[currentBank * 0x2000 + (address - 0xa000)] & 0xff;
    }
    return 0;
  };
  const writeByte = (address, value) => {
    if (address >= 0x4000 && address < 0x6000) {
      currentBank = value & 0x03;
    } else if (address >= 0xa000 && address < 0xc000) {
      bankedSram[currentBank * 0x2000 + (address - 0xa000)] = value & 0xff;
    }
    // 0x0000..0x1FFF = ram enable — noop for this fake.
  };

  const snapshot = readSramSnapshot(readByte, writeByte);
  assert.equal(snapshot.byteLength, SRAM_TOTAL_BYTE_LENGTH);
  for (let bank = 0; bank < 4; bank += 1) {
    assert.equal(snapshot[bank * 0x2000], (bank * 0x40) & 0xff, `bank ${bank} first byte`);
    assert.equal(snapshot[bank * 0x2000 + 0x1fff], (bank * 0x40 + 0x3f) & 0xff, `bank ${bank} last byte`);
  }

  // Write back an altered snapshot — flip every byte — and verify round-trip.
  const altered = snapshot.map((b) => (~b) & 0xff);
  writeSramSnapshot(writeByte, readByte, altered);
  const readBack = readSramSnapshot(readByte, writeByte);
  assert.deepEqual([...readBack], [...altered], 'round-trip SRAM write+read');
});

test('buildSaveSnapshotRecord + validateSaveSnapshotRecord round-trip', async () => {
  const sramBytes = new Uint8Array(SRAM_TOTAL_BYTE_LENGTH);
  for (let i = 0; i < sramBytes.length; i += 1) sramBytes[i] = i & 0xff;

  const record = await buildSaveSnapshotRecord({
    signedInWallet: 'tb1psavewallet00000000000000000000000000',
    captureNetwork: 'bells-testnet',
    gameRom: 'pokecrystal-pokebells.gbc',
    gameRomSha256: 'd'.repeat(64),
    sramBytes,
    saveVersion: 3,
    blockHashAtSave: 'a'.repeat(64),
    now: '2026-04-22T12:00:00.000Z',
  });

  assert.equal(record.p, 'pokebells');
  assert.equal(record.op, 'save-snapshot');
  assert.equal(record.save_version, 3);
  assert.equal(record.sram_byte_length, SRAM_TOTAL_BYTE_LENGTH);
  assert.equal(record.save_scheme, SAVE_SNAPSHOT_SCHEME);
  assert.equal(record.sram_encoding, 'base64');
  assert.ok(record.sram.length > 40000, 'base64 of 32 KB is ~43 KB');

  const validation = await validateSaveSnapshotRecord(record);
  assert.equal(validation.ok, true, validation.error ?? 'save-snapshot should validate');

  // Tamper: flip one byte of the payload, sha must now mismatch.
  const tampered = { ...record };
  const decoded = Uint8Array.from(atob(tampered.sram), (c) => c.charCodeAt(0));
  decoded[0] = (decoded[0] + 1) & 0xff;
  tampered.sram = btoa(String.fromCharCode(...decoded));
  const tamperCheck = await validateSaveSnapshotRecord(tampered);
  assert.equal(tamperCheck.ok, false);
  assert.match(tamperCheck.error, /sram_sha256/);
});

test('readRamSnapshot forces SVBK=1 when writeByte is provided and restores it', () => {
  const memory = new Uint8Array(0x10000);
  // Fill bank 0 + bank 1 regions with recognizable patterns.
  for (let i = 0xc000; i < 0xd000; i += 1) memory[i] = 0xaa;
  for (let i = 0xd000; i < 0xe000; i += 1) memory[i] = 0xbb;
  memory[SVBK_REGISTER] = 0x05; // SVBK pointing at bank 5
  const readByte = (a) => memory[a];
  const writeByte = (a, v) => { memory[a] = v & 0xff; };

  const snapshot = readRamSnapshot(readByte, { writeByte });

  assert.equal(snapshot.bytes.byteLength, WRAM_BYTE_LENGTH);
  assert.equal(snapshot.svbk, 1);
  assert.equal(memory[SVBK_REGISTER], 0x05, 'SVBK restored after snapshot');
  assert.equal(snapshot.bytes[0], 0xaa, 'first byte from bank 0 window');
  assert.equal(snapshot.bytes[WRAM_BANK0_BYTE_LENGTH], 0xbb, 'second half from bank 1 window');
});

test('readRamSnapshot without writeByte still records the active SVBK bank', () => {
  const memory = new Uint8Array(0x10000);
  memory[SVBK_REGISTER] = 0x03;
  const readByte = (a) => memory[a];
  const snapshot = readRamSnapshot(readByte);
  assert.equal(snapshot.svbk, 3, 'records the bank that was active during the blind read');
});

test('isGen2Shiny: ATK=10 + DEF/SPE/SPC from magic set triggers shiny', () => {
  assert.equal(isGen2Shiny({ atk: 10, def: 10, spe: 10, spd: 10 }), true);
  assert.equal(isGen2Shiny({ atk: 10, def: 2, spe: 3, spd: 15 }), true);
  assert.equal(isGen2Shiny({ atk: 9, def: 10, spe: 10, spd: 10 }), false);
  assert.equal(isGen2Shiny({ atk: 10, def: 5, spe: 10, spd: 10 }), false);
  assert.equal(isGen2Shiny(null), false);
});

test('computeCatchChance respects status bonus and clamps to valid range', () => {
  const base = computeCatchChance({ catchRate: 45, currentHp: 30, maxHp: 100, status: 'none' });
  const boosted = computeCatchChance({ catchRate: 45, currentHp: 30, maxHp: 100, status: 'sleep' });

  assert.ok(base !== null);
  assert.ok(boosted !== null);
  assert.ok(boosted > base);
  assert.ok(catchChancePercent(boosted) > catchChancePercent(base));
  assert.equal(computeCatchChance({ catchRate: 0, currentHp: 1, maxHp: 10 }), null);
});

test('statusNameFromByte maps party status bytes', () => {
  assert.equal(statusNameFromByte(0x00), 'none');
  assert.equal(statusNameFromByte(0x03), 'sleep');
  assert.equal(statusNameFromByte(0x08), 'poison');
  assert.equal(statusNameFromByte(0x10), 'burn');
  assert.equal(statusNameFromByte(0x20), 'freeze');
  assert.equal(statusNameFromByte(0x40), 'paralyze');
});

test('buildCaptureProvenance attests a bank-switched Crystal snapshot + commits IVs', async () => {
  const memory = new Uint8Array(0x10000);
  for (let address = 0xc000; address < 0xe000; address += 1) {
    memory[address] = (address * 3) & 0xff;
  }
  memory[0xff70] = 0x04;
  const readByte = (address) => memory[address];
  const writeByte = (address, value) => { memory[address] = value & 0xff; };

  const provenance = await buildCaptureProvenance(readByte, {
    network: 'bells-testnet',
    signedInWallet: 'tb1ptestwallet000000000000000000000000000000',
    sessionSequenceNumber: 7,
    writeByte,
    ivs: { atk: 10, def: 11, spe: 12, spd: 13 },
    ivsSaltBytes: TEST_SALT_BYTES,
    fetchImpl: async (url) => {
      assert.match(String(url), /blocks\/tip\/hash$/);
      return {
        ok: true,
        async text() { return 'b'.repeat(64); },
      };
    },
  });

  assert.equal(provenance.capture_network, 'bells-testnet');
  assert.equal(provenance.block_hash_at_capture, 'b'.repeat(64));
  assert.equal(provenance.session_sequence_number, 7);
  assert.equal(provenance.attestation_scheme, ATTESTATION_SCHEME_V2);
  assert.equal(provenance.attestation.length, 64);
  assert.equal(provenance.svbk_at_capture, 1, 'snapshot should have forced SVBK=1');
  assert.equal(memory[0xff70], 0x04, 'SVBK should be restored to pre-snapshot value');
  // v1.4 hides raw snapshot + raw ivs; only commitments make it out.
  assert.equal(provenance.ram_snapshot, null);
  assert.equal(provenance.ram_snapshot_encoding, null);
  assert.equal(typeof provenance.ram_snapshot_hash, 'string');
  assert.equal(provenance.ram_snapshot_hash.length, 64);
  assert.equal(typeof provenance.ivs_commitment, 'string');
  assert.equal(provenance.ivs_commitment.length, 64);
  assert.equal(provenance.ivs_commitment_scheme, IVS_COMMITMENT_SCHEME);
  // privateReveal side-channel carries the preimages for later reveal.
  assert.ok(provenance.privateReveal);
  assert.equal(provenance.privateReveal.ivs.atk, 10);
  assert.equal(provenance.privateReveal.ivs_salt_hex.length, 64);
  assert.equal(provenance.privateReveal.ram_snapshot_base64.length > 0, true);
});

test('buildCapturedPokemonRecord emits a schema v1.4 commit-reveal capture', async () => {
  const { catalog, record, speciesEntry } = await makeValidRecord();

  assert.equal(record.schema_version, '1.4');
  assert.equal(record.p, 'pokebells');
  assert.equal(record.op, 'capture');
  assert.equal(record.species, 25);
  assert.equal(record.species_id, 25);
  assert.equal(record.species_name, 'Pikachu');
  assert.equal(record.level, 17);
  // Commit-reveal: IVs / derived_ivs / EVs / shiny / raw snapshot are hidden.
  assert.equal(record.ivs, null);
  assert.equal(record.derived_ivs, null);
  assert.equal(record.evs, null);
  assert.equal(record.shiny, null);
  assert.equal(record.ram_snapshot, null);
  assert.equal(record.ram_snapshot_encoding, null);
  // Public commitments bind the capture to the hidden values.
  assert.equal(typeof record.ivs_commitment, 'string');
  assert.equal(record.ivs_commitment.length, 64);
  assert.equal(record.ivs_commitment_scheme, IVS_COMMITMENT_SCHEME);
  assert.equal(typeof record.ram_snapshot_hash, 'string');
  assert.equal(record.ram_snapshot_hash.length, 64);
  assert.equal(record.attestation_scheme, ATTESTATION_SCHEME_V2);
  assert.equal(record.svbk_at_capture, 1);
  assert.equal(record.status, 'paralyze');
  assert.equal(record.catch_rate, speciesEntry.catchRate);
  assert.equal(record.held_item, 0);
  assert.equal(record.friendship, 70);
  assert.equal(record.pokerus, 0);
  assert.equal(record.game_rom, 'pokecrystal.gbc');
  assert.equal(record.capture_network, 'bells-testnet');
  assert.equal(record.block_hash_at_capture, 'a'.repeat(64));
  assert.equal(record.session_sequence_number, 1);
  assert.equal(record.nft_metadata.shiny_state, 'Hidden (revealed after mint)');
  assert.ok(record.nft_metadata.attributes.some((e) => e.trait_type === 'IV HP' && e.value === 'Hidden (revealed after mint)'));
  assert.ok(record.nft_metadata.attributes.some((e) => e.trait_type === 'Friendship' && e.value === 70));

  const validation = await validateCapturedPokemonRecord(record, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
  });
  assert.equal(validation.ok, true, validation.error ?? 'capture should validate');
});

test('buildRevealRecord + validateRevealRecord round-trips against capture commitments', async () => {
  const { record, provenance } = await makeValidRecord();
  const reveal = buildRevealRecord({
    captureRecord: record,
    captureInscriptionId: 'deadbeef'.repeat(8) + 'i0',
    privateReveal: provenance.privateReveal,
  });
  assert.equal(reveal.p, 'pokebells');
  assert.equal(reveal.op, 'reveal');
  assert.equal(reveal.schema_version, '1.4');
  assert.equal(reveal.ref_attestation, record.attestation);
  assert.deepEqual(reveal.ivs, { atk: 10, def: 11, spe: 12, spd: 13 });
  assert.equal(reveal.shiny, false);
  assert.equal(reveal.ram_snapshot_encoding, 'base64');
  assert.equal(reveal.ivs_salt_hex.length, 64);

  const validation = await validateRevealRecord(reveal, record);
  assert.equal(validation.ok, true, validation.error ?? 'reveal should validate');
  assert.equal(validation.shiny, false);
});

test('validateRevealRecord rejects a reveal with tampered IVs', async () => {
  const { record, provenance } = await makeValidRecord();
  const reveal = buildRevealRecord({
    captureRecord: record,
    captureInscriptionId: 'a'.repeat(64) + 'i0',
    privateReveal: provenance.privateReveal,
  });
  // Adversary tries to publish reveal claiming perfect IVs without knowing
  // the salt preimage - commitment check must fail.
  reveal.ivs = { atk: 15, def: 15, spe: 15, spd: 15 };
  const validation = await validateRevealRecord(reveal, record);
  assert.equal(validation.ok, false);
  assert.match(validation.error, /ivs_commitment/);
});

test('buildRevealRecord derives Gen 2-authentic shiny from revealed DVs', async () => {
  const { record, provenance } = await makeValidRecord({
    mutateMemory(memory, slotIndex) {
      const slotBase = RAM_ADDRS.teamSlotBase + ((slotIndex - 1) * RAM_ADDRS.teamSlotSize);
      // ATK=10, DEF=10, SPE=10, SPC=10 -> shiny.
      memory[slotBase + PARTY_OFFSETS.attackDefenseDv] = 0xaa;
      memory[slotBase + PARTY_OFFSETS.speedSpecialDv] = 0xaa;
    },
  });
  // Capture itself reports shiny as null (hidden).
  assert.equal(record.shiny, null);
  assert.equal(record.nft_metadata.shiny_state, 'Hidden (revealed after mint)');

  const reveal = buildRevealRecord({
    captureRecord: record,
    captureInscriptionId: 'b'.repeat(64) + 'i0',
    privateReveal: provenance.privateReveal,
  });
  assert.equal(reveal.shiny, true);
  const validation = await validateRevealRecord(reveal, record);
  assert.equal(validation.ok, true);
});

test('validateCapturedPokemonRecord rejects crafted schema and provenance tampering', async () => {
  const { catalog, record } = await makeValidRecord();

  const badCatchRate = clone(record);
  badCatchRate.catch_rate = 1;
  const catchRateValidation = await validateCapturedPokemonRecord(badCatchRate, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
  });
  assert.equal(catchRateValidation.ok, false);
  assert.match(catchRateValidation.error, /catch_rate/);

  const badSpecies = clone(record);
  badSpecies.species = 300;
  badSpecies.species_id = 300;
  const speciesValidation = await validateCapturedPokemonRecord(badSpecies, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
  });
  assert.equal(speciesValidation.ok, false);
  assert.match(speciesValidation.error, /species_id/);

  const tamperedCommit = clone(record);
  tamperedCommit.ivs_commitment = 'f'.repeat(64);
  const commitValidation = await validateCapturedPokemonRecord(tamperedCommit, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
  });
  assert.equal(commitValidation.ok, false);
  assert.match(commitValidation.error, /attestation/);

  const badAttestation = clone(record);
  badAttestation.attestation = 'f'.repeat(64);
  const attestationValidation = await validateCapturedPokemonRecord(badAttestation, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
  });
  assert.equal(attestationValidation.ok, false);
  assert.match(attestationValidation.error, /attestation/);
});

test('validateCapturedPokemonRecord accepts all 251 Gen 2 species ids', async () => {
  // Spot-check that the species_id range validator now accepts Johto mons
  // (152..251) which the Gen 1 validator rejected.
  for (const dexNo of [152, 200, 251]) {
    const { catalog, record } = await makeValidRecord({ dexNo });
    const validation = await validateCapturedPokemonRecord(record, {
      speciesCatalog: catalog,
      verifyProvenance: true,
      requireSignedWallet: true,
    });
    assert.equal(validation.ok, true, `dex ${dexNo} should validate ok, got: ${validation.error}`);
  }
});

test('validateCapturedPokemonRecord can confirm block hash provenance against electrs', async () => {
  const { catalog, record } = await makeValidRecord();
  let fetchedUrl = null;

  const validation = await validateCapturedPokemonRecord(record, {
    speciesCatalog: catalog,
    verifyProvenance: true,
    requireSignedWallet: true,
    checkBlockHashExists: true,
    fetchImpl: async (url) => {
      fetchedUrl = String(url);
      return { ok: true };
    },
  });

  assert.equal(validation.ok, true);
  assert.match(fetchedUrl, /bells-testnet-api\.nintondo\.io\/block\/a{64}$/);
});

test('buildSpriteImageResolver rejects unusable inputs and placeholder ids', () => {
  assert.equal(buildSpriteImageResolver(null), null);
  assert.equal(buildSpriteImageResolver({ p: 'pokebells-sprites', v: 2, sprites: {} }), null);

  const emptyResolver = buildSpriteImageResolver({ p: 'pokebells-sprites', v: 1, sprites: {} });
  assert.ok(typeof emptyResolver === 'function');
  assert.equal(emptyResolver(25, false), null);

  const placeholderResolver = buildSpriteImageResolver(
    {
      p: 'pokebells-sprites',
      v: 1,
      sprites: {
        25: {
          normal_inscription_id: 'REPLACE_ME_AFTER_INSCRIBE_i0',
          shiny_inscription_id: 'REPLACE_ME_AFTER_INSCRIBE_i0',
        },
      },
    },
    { contentBaseUrl: 'https://bells-mainnet-content.nintondo.io/content/' },
  );
  assert.equal(placeholderResolver(25, false), null);
  assert.equal(placeholderResolver(25, true), null);
});

test('buildSpriteImageResolver prefixes inscription ids with the content base', () => {
  const resolver = buildSpriteImageResolver(
    {
      p: 'pokebells-sprites',
      v: 1,
      sprites: {
        25: {
          normal_inscription_id: 'abcdef0123456789i0',
          shiny_inscription_id: 'fedcba9876543210i0',
        },
      },
    },
    { contentBaseUrl: 'https://bells-mainnet-content.nintondo.io/content/' },
  );

  assert.equal(resolver(25, false), 'https://bells-mainnet-content.nintondo.io/content/abcdef0123456789i0');
  assert.equal(resolver(25, true), 'https://bells-mainnet-content.nintondo.io/content/fedcba9876543210i0');
  assert.equal(resolver(999, false), null);
});

test('buildCapturedPokemonRecord wires nft_metadata.image from resolver (always non-shiny pre-reveal)', () => {
  const catalog = loadCatalog();
  const speciesEntry = getSpeciesByDexNo(catalog, 25);
  const { memory, slotIndex } = buildMemoryForSpecies(speciesEntry, 17);
  const readByte = (address) => memory[address];

  const recordNoSprite = buildCapturedPokemonRecord(readByte, {
    slotIndex,
    romName: 'pokecrystal.gbc',
    speciesResolver(id) { return catalog.byInternalId.get(id) ?? null; },
  });
  assert.equal(recordNoSprite.nft_metadata.image, null);

  // v1.4: shiny is hidden pre-reveal so the sprite is always non-shiny until
  // the reveal inscription lands. Consumers that want the real sprite flip
  // to shiny after the reveal updates the indexed record.
  const record = buildCapturedPokemonRecord(readByte, {
    slotIndex,
    romName: 'pokecrystal.gbc',
    speciesResolver(id) { return catalog.byInternalId.get(id) ?? null; },
    resolveSpriteImage(speciesNo, shiny) {
      assert.equal(speciesNo, 25);
      assert.equal(shiny, false, 'pre-reveal captures always resolve the non-shiny sprite');
      return 'https://bells-mainnet-content.nintondo.io/content/abcdef0123456789i0';
    },
  });
  assert.equal(record.nft_metadata.image, 'https://bells-mainnet-content.nintondo.io/content/abcdef0123456789i0');

  const tolerantRecord = buildCapturedPokemonRecord(readByte, {
    slotIndex,
    romName: 'pokecrystal.gbc',
    speciesResolver(id) { return catalog.byInternalId.get(id) ?? null; },
    resolveSpriteImage() { throw new Error('resolver blew up'); },
  });
  assert.equal(tolerantRecord.nft_metadata.image, null);
});
