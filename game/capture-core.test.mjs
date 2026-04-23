import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTESTATION_SCHEME,
  ATTESTATION_SCHEME_V2,
  ATTESTATION_SCHEME_V2_1,
  CAPTURE_COMMIT_OP_V1_5,
  CAPTURE_SCHEMA_VERSION,
  GEN2_UNSUPPORTED_LABEL,
  IVS_COMMITMENT_SCHEME,
  MINT_OP_V1_5,
  PARTY_OFFSETS,
  POKEBELLS_COLLECTION_NAME,
  RAM_ADDRS,
  RAM_COMMITMENT_SCHEME_V1,
  RAM_WITNESS_SCHEME_FULL_V1,
  SAVE_SNAPSHOT_SCHEME,
  SCHEMA_VERSION_V1_5,
  SRAM_TOTAL_BYTE_LENGTH,
  SVBK_REGISTER,
  WRAM_BANK0_BYTE_LENGTH,
  WRAM_BYTE_LENGTH,
  buildCaptureCommitRecord,
  buildCaptureProvenance,
  buildCapturedPokemonRecord,
  buildPokemonMintRecord,
  buildRevealRecord,
  buildSaveSnapshotRecord,
  buildSpriteImageResolver,
  catchChancePercent,
  computeCaptureAttestationV2_1,
  computeCatchChance,
  computeIvsCommitment,
  deriveGbcHpIv,
  isGen2Shiny,
  parseGbcDvs,
  parsePartySlotFromSnapshot,
  readRamSnapshot,
  readSramSnapshot,
  statusNameFromByte,
  validateCaptureCommitRecord,
  validateCapturedPokemonRecord,
  validatePokemonMintRecord,
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

// ============================================================================
// SCHEMA v1.5 — capture_commit + mint
// ============================================================================

// Deterministic sprite resolver for the v1.5 tests. The validator's strict
// image check requires a resolver match, so every test passes this same stub
// to both buildPokemonMintRecord and validatePokemonMintRecord.
const v15SpriteResolver = (dex, shiny) => `/content/sprite_${dex}${shiny ? '_s' : ''}i0`;

async function makeValidV15(options = {}) {
  const catalog = loadCatalog();
  const speciesEntry = getSpeciesByDexNo(catalog, options.dexNo ?? 25);
  const level = options.level ?? 17;
  const { memory, slotIndex, slotBase } = buildMemoryForSpecies(speciesEntry, level);
  if (options.mutateMemory) options.mutateMemory(memory, slotIndex);
  const readByte = (address) => memory[address];

  const atkDefDv = memory[slotBase + PARTY_OFFSETS.attackDefenseDv];
  const spdSpcDv = memory[slotBase + PARTY_OFFSETS.speedSpecialDv];
  const ivs = parseGbcDvs(atkDefDv, spdSpcDv);

  const built = await buildCaptureCommitRecord(readByte, {
    network: 'bells-testnet',
    signedInWallet: 'tb1ptestwallet000000000000000000000000000000',
    sessionSequenceNumber: 1,
    blockHashAtCapture: 'a'.repeat(64),
    partySlotIndex: slotIndex,
    ivs,
    ivsSaltBytes: TEST_SALT_BYTES,
    romSha256: 'b'.repeat(64),
  });
  return { catalog, speciesEntry, slotIndex, slotBase, readByte, ivs, ...built };
}

test('v1.5 computeCaptureAttestationV2_1 is deterministic + slot-sensitive', async () => {
  const args = {
    blockHashAtCapture: 'a'.repeat(64),
    ramSnapshotHashHex: 'b'.repeat(64),
    svbk: 1,
    signedInWallet: 'tb1ptest',
    sessionSequenceNumber: 1,
    ivsCommitmentHex: 'c'.repeat(64),
    partySlotIndex: 2,
  };
  const h1 = await computeCaptureAttestationV2_1(args);
  const h2 = await computeCaptureAttestationV2_1(args);
  assert.equal(h1, h2, 'must be deterministic');
  assert.equal(h1.length, 64, '64-char hex');
  // Changing slot must change the hash (cryptographic pinning of slot)
  const hSlot3 = await computeCaptureAttestationV2_1({ ...args, partySlotIndex: 3 });
  assert.notEqual(h1, hSlot3, 'slot tampering must change attestation');
});

test('v1.5 parsePartySlotFromSnapshot extracts species/level/DVs correctly', () => {
  const catalog = loadCatalog();
  const cyndaquil = getSpeciesByDexNo(catalog, 155);
  const { memory, slotIndex } = buildMemoryForSpecies(cyndaquil, 5);
  const snapshot = new Uint8Array(WRAM_BYTE_LENGTH);
  for (let a = 0xc000; a < 0xe000; a += 1) {
    snapshot[a - 0xc000] = memory[a];
  }
  const slot = parsePartySlotFromSnapshot(snapshot, slotIndex);
  assert.equal(slot.internalSpeciesId, cyndaquil.dexNo);
  assert.equal(slot.level, 5);
  assert.deepEqual(slot.dvs, { atk: 10, def: 11, spe: 12, spd: 13 });
  assert.equal(slot.heldItem, 0);
  assert.equal(slot.friendship, 70);
  assert.deepEqual(slot.moves, [33, 34, 35, 36]);
});

test('v1.5 parsePartySlotFromSnapshot rejects bad inputs', () => {
  const snap = new Uint8Array(WRAM_BYTE_LENGTH);
  assert.throws(() => parsePartySlotFromSnapshot(snap, 0), /1\.\.6/);
  assert.throws(() => parsePartySlotFromSnapshot(snap, 7), /1\.\.6/);
  assert.throws(() => parsePartySlotFromSnapshot(snap, 1.5), /1\.\.6/);
  assert.throws(() => parsePartySlotFromSnapshot(new Uint8Array(100), 1), /8192/);
  assert.throws(() => parsePartySlotFromSnapshot([], 1), /Uint8Array/);
});

test('v1.5 buildCaptureCommitRecord emits a clean opaque receipt', async () => {
  const { commitRecord, privateReveal } = await makeValidV15();
  assert.equal(commitRecord.p, 'pokebells');
  assert.equal(commitRecord.op, CAPTURE_COMMIT_OP_V1_5);
  assert.equal(commitRecord.schema_version, SCHEMA_VERSION_V1_5);
  assert.equal(commitRecord.attestation_scheme, ATTESTATION_SCHEME_V2_1);
  assert.equal(commitRecord.ram_commitment_scheme, RAM_COMMITMENT_SCHEME_V1);
  assert.equal(commitRecord.ivs_commitment_scheme, IVS_COMMITMENT_SCHEME);
  assert.equal(commitRecord.party_slot_index, 2);
  assert.equal(commitRecord.svbk_at_capture, 1);
  assert.match(commitRecord.attestation, /^[0-9a-f]{64}$/);
  assert.match(commitRecord.ivs_commitment, /^[0-9a-f]{64}$/);
  assert.match(commitRecord.ram_snapshot_hash, /^[0-9a-f]{64}$/);
  assert.equal(commitRecord.game_rom_sha256, 'b'.repeat(64));

  // Marketplace pollution check: NO species / level / nft_metadata / image / attributes
  assert.equal(commitRecord.species_id, undefined, 'no species in commit');
  assert.equal(commitRecord.level, undefined, 'no level in commit');
  assert.equal(commitRecord.name, undefined, 'no name in commit');
  assert.equal(commitRecord.image, undefined, 'no image in commit');
  assert.equal(commitRecord.attributes, undefined, 'no attributes in commit');
  assert.equal(commitRecord.nft_metadata, undefined, 'no nft_metadata in commit');

  // privateReveal cache
  assert.equal(privateReveal.ivs_salt_hex.length, 64);
  assert.equal(privateReveal.ram_snapshot_base64.length > 0, true);
  assert.deepEqual(privateReveal.ivs, { atk: 10, def: 11, spe: 12, spd: 13 });
});

test('v1.5 buildPokemonMintRecord builds a marketplace-ready NFT', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15({ dexNo: 155, level: 5 });
  const captureInscriptionId = `${'d'.repeat(64)}i0`;

  const mint = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: captureInscriptionId,
    privateReveal,
    speciesResolver: (id) => catalog.byInternalId.get(id) ?? null,
    resolveSpriteImage: (dexNo, shiny) => `/content/sprite_${dexNo}${shiny ? '_s' : ''}i0`,
    now: '2026-04-23T10:00:00.000Z',
  });

  assert.equal(mint.p, 'pokebells');
  assert.equal(mint.op, MINT_OP_V1_5);
  assert.equal(mint.schema_version, SCHEMA_VERSION_V1_5);
  assert.equal(mint.ref_capture_commit, captureInscriptionId);
  assert.equal(mint.party_slot_index, 2);
  assert.equal(mint.signed_in_wallet, commitRecord.signed_in_wallet);

  // Pokemon traits derived from RAM
  assert.equal(mint.species_id, 155);
  assert.equal(mint.species_name, 'Cyndaquil');
  assert.equal(mint.level, 5);
  assert.equal(mint.shiny, false);
  assert.deepEqual(mint.ivs, { atk: 10, def: 11, spe: 12, spd: 13 });
  assert.equal(mint.derived_ivs.hp, 5);

  // Top-level marketplace metadata
  assert.equal(mint.name, 'Cyndaquil Lv.5');
  assert.equal(mint.image, '/content/sprite_155i0');
  assert.ok(Array.isArray(mint.attributes), 'attributes is array');
  const traitMap = Object.fromEntries(mint.attributes.map((t) => [t.trait_type, t.value]));
  assert.equal(traitMap.Pokemon, 'Cyndaquil');
  assert.equal(traitMap['Dex No'], 155);
  assert.equal(traitMap.Level, 5);
  assert.equal(traitMap.Shiny, 'No');
  assert.equal(traitMap['IV Total'], 46);
  assert.equal(traitMap['IV HP'], 5);
  assert.equal(traitMap['IV Attack'], 10);
  assert.equal(traitMap.Collection, POKEBELLS_COLLECTION_NAME);

  // No nested nft_metadata mirror — top-level IS the metadata
  assert.equal(mint.nft_metadata, undefined);

  // Reveal preimages present (anti-cheat verifier needs them)
  assert.equal(mint.ivs_salt_hex.length, 64);
  assert.equal(mint.ram_snapshot_encoding, 'base64');
  assert.equal(mint.ram_witness_scheme, RAM_WITNESS_SCHEME_FULL_V1);
});

test('v1.5 validateCaptureCommitRecord accepts valid + rejects schema breaks', async () => {
  const { commitRecord } = await makeValidV15();
  const ok = await validateCaptureCommitRecord(commitRecord);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const badOp = await validateCaptureCommitRecord({ ...commitRecord, op: 'capture' });
  assert.equal(badOp.ok, false);
  assert.match(badOp.errors.join(' | '), /op must equal "capture_commit"/);

  const badSchema = await validateCaptureCommitRecord({ ...commitRecord, schema_version: '1.4' });
  assert.equal(badSchema.ok, false);
  assert.match(badSchema.errors.join(' | '), /schema_version must equal "1.5"/);

  const badSlot = await validateCaptureCommitRecord({ ...commitRecord, party_slot_index: 7 });
  assert.equal(badSlot.ok, false);
  assert.match(badSlot.errors.join(' | '), /party_slot_index/);

  const badSvbk = await validateCaptureCommitRecord({ ...commitRecord, svbk_at_capture: 2 });
  assert.equal(badSvbk.ok, false);
  assert.match(badSvbk.errors.join(' | '), /svbk_at_capture must equal 1/);

  const badAttScheme = await validateCaptureCommitRecord({
    ...commitRecord, attestation_scheme: 'sha256:...:v2',
  });
  assert.equal(badAttScheme.ok, false);
  assert.match(badAttScheme.errors.join(' | '), /attestation_scheme/);
});

test('v1.5 validateCaptureCommitRecord rejects tampered attestation', async () => {
  const { commitRecord } = await makeValidV15();

  // Tamper a field that's part of attestation preimage
  const tamperedSlot = { ...commitRecord, party_slot_index: 3 };
  const r1 = await validateCaptureCommitRecord(tamperedSlot);
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /attestation does not match/);

  const tamperedWallet = { ...commitRecord, signed_in_wallet: 'tb1pevil' };
  const r2 = await validateCaptureCommitRecord(tamperedWallet);
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /attestation does not match/);

  const tamperedCommitment = { ...commitRecord, ivs_commitment: 'f'.repeat(64) };
  const r3 = await validateCaptureCommitRecord(tamperedCommitment);
  assert.equal(r3.ok, false);
  assert.match(r3.errors.join(' | '), /attestation does not match/);
});

test('v1.5 validatePokemonMintRecord accepts a valid commit+mint pair', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const mint = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver: (id) => catalog.byInternalId.get(id) ?? null,
    resolveSpriteImage: v15SpriteResolver,
  });
  const result = await validatePokemonMintRecord(mint, commitRecord, {
    speciesResolver: (id) => catalog.byInternalId.get(id) ?? null,
    resolveSpriteImage: v15SpriteResolver,
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('v1.5 validatePokemonMintRecord rejects all flavors of tampering', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const validMint = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });

  const badSlot = clone(validMint);
  badSlot.party_slot_index = 3;
  const r1 = await validatePokemonMintRecord(badSlot, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /party_slot_index .* does not match commit/);

  const badWallet = clone(validMint);
  badWallet.signed_in_wallet = 'tb1pevil';
  const r2 = await validatePokemonMintRecord(badWallet, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /signed_in_wallet does not match commit/);

  const badIvs = clone(validMint);
  badIvs.ivs = { atk: 0, def: 0, spe: 0, spd: 0 };
  const r3 = await validatePokemonMintRecord(badIvs, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r3.ok, false);
  assert.match(r3.errors.join(' | '), /ivs_commitment preimage does not match/);

  const badSpecies = clone(validMint);
  badSpecies.species_id = 1;
  const r4 = await validatePokemonMintRecord(badSpecies, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r4.ok, false);
  assert.match(r4.errors.join(' | '), /species_id .* does not match RAM slot/);

  const badLevel = clone(validMint);
  badLevel.level = 99;
  const r5 = await validatePokemonMintRecord(badLevel, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r5.ok, false);
  assert.match(r5.errors.join(' | '), /level .* does not match RAM slot/);

  const badShiny = clone(validMint);
  badShiny.shiny = true;
  const r6 = await validatePokemonMintRecord(badShiny, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r6.ok, false);
  assert.match(r6.errors.join(' | '), /shiny .* does not match RAM-derived/);

  const badWitness = clone(validMint);
  badWitness.ram_witness_scheme = 'merkle:v1';
  const r7 = await validatePokemonMintRecord(badWitness, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r7.ok, false);
  assert.match(r7.errors.join(' | '), /ram_witness_scheme/);
});

test('v1.5 validatePokemonMintRecord rejects truncated / corrupted RAM snapshot', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const validMint = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });

  const truncated = clone(validMint);
  truncated.ram_snapshot = privateReveal.ram_snapshot_base64.slice(0, 100);
  const r1 = await validatePokemonMintRecord(truncated, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /ram_snapshot must decode to 8192/);

  // Modify one byte in decoded snapshot → re-encode → hash mismatch
  const decoded = Buffer.from(privateReveal.ram_snapshot_base64, 'base64');
  decoded[0] ^= 0xff;
  const corrupted = clone(validMint);
  corrupted.ram_snapshot = decoded.toString('base64');
  const r2 = await validatePokemonMintRecord(corrupted, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /ram_snapshot does not match commit hash/);
});

test('v1.5 buildCaptureCommitRecord requires romSha256 (forbids null)', async () => {
  const catalog = loadCatalog();
  const cyndaquil = getSpeciesByDexNo(catalog, 155);
  const { memory, slotIndex } = buildMemoryForSpecies(cyndaquil, 5);
  const readByte = (a) => memory[a];
  await assert.rejects(
    buildCaptureCommitRecord(readByte, {
      network: 'bells-testnet',
      signedInWallet: 'tb1ptest',
      sessionSequenceNumber: 1,
      blockHashAtCapture: 'a'.repeat(64),
      partySlotIndex: slotIndex,
      ivsSaltBytes: TEST_SALT_BYTES,
      // no romSha256
    }),
    /romSha256 must be 64-char hex/,
  );
});

test('v1.5 buildCaptureCommitRecord derives IVs from RAM slot (ignores options.ivs)', async () => {
  const catalog = loadCatalog();
  const cyndaquil = getSpeciesByDexNo(catalog, 155);
  const { memory, slotIndex, slotBase } = buildMemoryForSpecies(cyndaquil, 5);
  const readByte = (a) => memory[a];

  // RAM has atkDef=0xAB → ATK=10, DEF=11; spdSpc=0xCD → SPE=12, SPD=13
  const realDvs = parseGbcDvs(
    memory[slotBase + PARTY_OFFSETS.attackDefenseDv],
    memory[slotBase + PARTY_OFFSETS.speedSpecialDv],
  );
  assert.deepEqual(realDvs, { atk: 10, def: 11, spe: 12, spd: 13 });

  // Try to pass fake IVs — builder must ignore them.
  const { commitRecord, privateReveal } = await buildCaptureCommitRecord(readByte, {
    network: 'bells-testnet',
    signedInWallet: 'tb1ptest',
    sessionSequenceNumber: 1,
    blockHashAtCapture: 'a'.repeat(64),
    partySlotIndex: slotIndex,
    ivsSaltBytes: TEST_SALT_BYTES,
    romSha256: 'b'.repeat(64),
    ivs: { atk: 15, def: 15, spe: 15, spd: 15 }, // caller-supplied LIE
  });

  // The privateReveal.ivs must be the RAM-derived real DVs, not the lie.
  assert.deepEqual(privateReveal.ivs, realDvs);

  // The commitment must match the REAL DVs + salt, not the lie + salt.
  const expectedCommitment = await computeIvsCommitment(realDvs, TEST_SALT_BYTES);
  assert.equal(commitRecord.ivs_commitment, expectedCommitment);
});

test('v1.5 validateCaptureCommitRecord rejects missing/invalid game_rom_sha256', async () => {
  const { commitRecord } = await makeValidV15();
  const noRom = { ...commitRecord, game_rom_sha256: null };
  const r1 = await validateCaptureCommitRecord(noRom);
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /game_rom_sha256/);

  const badRom = { ...commitRecord, game_rom_sha256: 'not-hex' };
  const r2 = await validateCaptureCommitRecord(badRom);
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /game_rom_sha256/);
});

test('v1.5 validatePokemonMintRecord catches ivs forged against fake commitment', async () => {
  // Attack scenario GPT described: construct commit manually with
  // ivs_commitment hashing FAKE perfect IVs. Build mint with those fake
  // IVs + matching salt + real RAM snapshot. Current v1.5 check must
  // reject because mint.ivs !== slot.dvs.
  const catalog = loadCatalog();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const { commitRecord, privateReveal, slotIndex } = await makeValidV15();

  const fakeIvs = { atk: 15, def: 15, spe: 15, spd: 15 };
  const fakeSalt = new Uint8Array(32).fill(0x77);
  const fakeCommitment = await computeIvsCommitment(fakeIvs, fakeSalt);

  // Replace commit's ivs_commitment with the fake. In a real attack the
  // commit inscription would have this fake value.
  const tamperedCommit = {
    ...commitRecord,
    ivs_commitment: fakeCommitment,
  };
  // Re-attestation so the commit itself still validates (the attacker
  // would build a commit with consistent attestation over the fake
  // commitment).
  tamperedCommit.attestation = await computeCaptureAttestationV2_1({
    blockHashAtCapture: tamperedCommit.block_hash_at_capture,
    ramSnapshotHashHex: tamperedCommit.ram_snapshot_hash,
    svbk: tamperedCommit.svbk_at_capture,
    signedInWallet: tamperedCommit.signed_in_wallet,
    sessionSequenceNumber: tamperedCommit.session_sequence_number,
    ivsCommitmentHex: fakeCommitment,
    partySlotIndex: tamperedCommit.party_slot_index,
  });

  // Attacker-constructed mint: publishes fake IVs matching the fake
  // commitment, but keeps the real RAM snapshot (so ram_snapshot_hash
  // still matches). Everything else copied from a legit mint.
  const legitMint = buildPokemonMintRecord({
    commitRecord: tamperedCommit,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal: { ...privateReveal, ivs_salt_hex: bytesToHexFix(fakeSalt) },
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });
  const attackMint = {
    ...legitMint,
    ivs: fakeIvs,
    ivs_salt_hex: bytesToHexFix(fakeSalt),
    derived_ivs: { hp: deriveGbcHpIv(fakeIvs) },
    shiny: isGen2Shiny(fakeIvs),
  };

  // Validator must reject because slot.dvs !== fakeIvs (slot has
  // 10/11/12/13, attack claims 15/15/15/15).
  const result = await validatePokemonMintRecord(attackMint, tamperedCommit, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /mint\.ivs does not match the DVs in the RAM slot/);
});

test('v1.5 validatePokemonMintRecord catches lies about moves/held_item/friendship/status', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const valid = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });

  const badMoves = clone(valid);
  badMoves.moves = [99, 99, 99, 99];
  const r1 = await validatePokemonMintRecord(badMoves, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /mint\.moves does not match/);

  const badPp = clone(valid);
  badPp.pp = [10, 10, 10, 10];
  const r2 = await validatePokemonMintRecord(badPp, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /mint\.pp does not match/);

  const badHeld = clone(valid);
  badHeld.held_item = 99;
  const r3 = await validatePokemonMintRecord(badHeld, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r3.ok, false);
  assert.match(r3.errors.join(' | '), /held_item/);

  const badFriend = clone(valid);
  badFriend.friendship = 255;
  const r4 = await validatePokemonMintRecord(badFriend, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r4.ok, false);
  assert.match(r4.errors.join(' | '), /friendship/);

  const badPokerus = clone(valid);
  badPokerus.pokerus = 1;
  const r5 = await validatePokemonMintRecord(badPokerus, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r5.ok, false);
  assert.match(r5.errors.join(' | '), /pokerus/);

  const badStatus = clone(valid);
  badStatus.status = 'Burned';
  const r6 = await validatePokemonMintRecord(badStatus, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r6.ok, false);
  assert.match(r6.errors.join(' | '), /status/);

  const badHpIv = clone(valid);
  badHpIv.derived_ivs = { hp: 15 }; // real is 5
  const r7 = await validatePokemonMintRecord(badHpIv, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r7.ok, false);
  assert.match(r7.errors.join(' | '), /derived_ivs\.hp/);

  const badName = clone(valid);
  badName.species_name = 'Mewtwo';
  const r8 = await validatePokemonMintRecord(badName, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r8.ok, false);
  assert.match(r8.errors.join(' | '), /species_name/);

  const badEvs = clone(valid);
  badEvs.evs = { hp: 9999, atk: 9999, def: 9999, spe: 9999, spc: 9999 };
  const r9 = await validatePokemonMintRecord(badEvs, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r9.ok, false);
  assert.match(r9.errors.join(' | '), /mint\.evs\./);

  const badCatch = clone(valid);
  badCatch.catch_rate = 255;
  const r10 = await validatePokemonMintRecord(badCatch, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(r10.ok, false);
  assert.match(r10.errors.join(' | '), /catch_rate/);
});

// Small inline helper for the test above — bytesToHex is internal to the
// module and not re-exported as `bytesToHex`. Mirror the canonical
// encoding the salt uses in privateReveal.
function bytesToHexFix(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

test('v1.5 validatePokemonMintRecord rejects lies about name / image / attributes', async () => {
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const valid = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });
  const opts = { speciesResolver, resolveSpriteImage: v15SpriteResolver };

  // Name ment
  const badName = clone(valid);
  badName.name = 'Mewtwo Legendary';
  const r1 = await validatePokemonMintRecord(badName, commitRecord, opts);
  assert.equal(r1.ok, false);
  assert.match(r1.errors.join(' | '), /mint\.name .* must equal/);

  // Image ment (pointe une sprite shiny alors que Pokémon non-shiny)
  const badImage = clone(valid);
  badImage.image = '/content/sprite_150_si0'; // Mewtwo shiny
  const r2 = await validatePokemonMintRecord(badImage, commitRecord, opts);
  assert.equal(r2.ok, false);
  assert.match(r2.errors.join(' | '), /mint\.image .* must equal canonical/);

  // Attributes ment sur l'IV Attack → marketplace afficherait 15 au lieu de 10
  const badAttrIv = clone(valid);
  badAttrIv.attributes = valid.attributes.map((a) =>
    a.trait_type === 'IV Attack' ? { trait_type: 'IV Attack', value: 15 } : a,
  );
  const r3 = await validatePokemonMintRecord(badAttrIv, commitRecord, opts);
  assert.equal(r3.ok, false);
  assert.match(r3.errors.join(' | '), /mint\.attributes\[7\] mismatch/);

  // Attributes ment sur le nom du species
  const badAttrName = clone(valid);
  badAttrName.attributes = valid.attributes.map((a) =>
    a.trait_type === 'Pokemon' ? { trait_type: 'Pokemon', value: 'Mewtwo' } : a,
  );
  const r4 = await validatePokemonMintRecord(badAttrName, commitRecord, opts);
  assert.equal(r4.ok, false);
  assert.match(r4.errors.join(' | '), /mint\.attributes\[1\] mismatch/);

  // Attributes ajoute une entrée parasite (longueur différente)
  const badAttrExtra = clone(valid);
  badAttrExtra.attributes = [...valid.attributes, { trait_type: 'Rarity', value: 'Legendary' }];
  const r5 = await validatePokemonMintRecord(badAttrExtra, commitRecord, opts);
  assert.equal(r5.ok, false);
  assert.match(r5.errors.join(' | '), /attributes length/);

  // Attributes retire une entrée
  const badAttrMissing = clone(valid);
  badAttrMissing.attributes = valid.attributes.slice(0, -1);
  const r6 = await validatePokemonMintRecord(badAttrMissing, commitRecord, opts);
  assert.equal(r6.ok, false);
  assert.match(r6.errors.join(' | '), /attributes length/);

  // derived_ivs manquant
  const noDerived = clone(valid);
  delete noDerived.derived_ivs;
  const r7 = await validatePokemonMintRecord(noDerived, commitRecord, opts);
  assert.equal(r7.ok, false);
  assert.match(r7.errors.join(' | '), /derived_ivs must be an object/);

  // evs manquant
  const noEvs = clone(valid);
  delete noEvs.evs;
  const r8 = await validatePokemonMintRecord(noEvs, commitRecord, opts);
  assert.equal(r8.ok, false);
  assert.match(r8.errors.join(' | '), /evs must be an object/);
});

test('v1.5 validatePokemonMintRecord rejects when sprite resolver returns null', async () => {
  // Mainnet hardening: a missing sprite mapping must NOT silently fall back
  // to "any image string". Without this, an attacker-friendly indexer that
  // didn't bind the sprite manifest would accept arbitrary image URLs.
  const { catalog, commitRecord, privateReveal } = await makeValidV15();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;
  const valid = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId: `${'d'.repeat(64)}i0`,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });
  const result = await validatePokemonMintRecord(valid, commitRecord, {
    speciesResolver,
    resolveSpriteImage: () => null, // simulates missing sprite mapping
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /canonical sprite for species .* not found in resolver/);
});

test('v1.5 end-to-end: commit + mint round-trip validates fully', async () => {
  const catalog = loadCatalog();
  const speciesResolver = (id) => catalog.byInternalId.get(id) ?? null;

  const { commitRecord, privateReveal } = await makeValidV15({ dexNo: 197, level: 24 }); // Umbreon

  const commitValidation = await validateCaptureCommitRecord(commitRecord);
  assert.equal(commitValidation.ok, true, JSON.stringify(commitValidation.errors));

  const commitInscriptionId = `${'e'.repeat(64)}i0`;
  const mint = buildPokemonMintRecord({
    commitRecord,
    commitInscriptionId,
    privateReveal,
    speciesResolver,
    resolveSpriteImage: v15SpriteResolver,
  });

  const mintValidation = await validatePokemonMintRecord(mint, commitRecord, { speciesResolver, resolveSpriteImage: v15SpriteResolver });
  assert.equal(mintValidation.ok, true, JSON.stringify(mintValidation.errors));

  assert.equal(mint.species_id, 197);
  assert.equal(mint.species_name, 'Umbreon');
  assert.equal(mint.level, 24);
  assert.equal(mint.signed_in_wallet, commitRecord.signed_in_wallet);
});
