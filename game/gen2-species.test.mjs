import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NATIONAL_DEX_MAX,
  POKEDEX_SYMBOLS,
  SPECIES_DATA,
  TYPE_NAMES,
  formatSpeciesName,
  getGen2SpeciesCatalog,
  getSpeciesByDexNo,
  getSpeciesByInternalId,
} from './gen2-species.mjs';

test('gen2-species: catalog has exactly 251 entries', () => {
  assert.equal(NATIONAL_DEX_MAX, 251);
  assert.equal(POKEDEX_SYMBOLS.length, 251);
  assert.equal(SPECIES_DATA.length, 251);
});

test('gen2-species: dex number integrity', () => {
  for (let i = 0; i < SPECIES_DATA.length; i += 1) {
    assert.equal(SPECIES_DATA[i].dexNo, i + 1, `entry ${i} dexNo mismatch`);
  }
});

test('gen2-species: known-value sanity checks', () => {
  const pikachu = SPECIES_DATA[24]; // dex #25
  assert.equal(pikachu.symbol, 'PIKACHU');
  assert.equal(pikachu.baseHp, 35);
  assert.equal(pikachu.baseAtk, 55);
  assert.equal(pikachu.baseSat, 50);
  assert.equal(pikachu.baseSdf, 40);
  assert.equal(pikachu.catchRate, 190);

  const mewtwo = SPECIES_DATA[149]; // dex #150
  assert.equal(mewtwo.symbol, 'MEWTWO');
  assert.equal(mewtwo.catchRate, 3);
  assert.equal(mewtwo.baseExp, 220);

  const celebi = SPECIES_DATA[250]; // dex #251
  assert.equal(celebi.symbol, 'CELEBI');
  assert.equal(celebi.catchRate, 45);
});

test('gen2-species: Johto starters are at dex 152/155/158', () => {
  assert.equal(SPECIES_DATA[151].symbol, 'CHIKORITA');
  assert.equal(SPECIES_DATA[154].symbol, 'CYNDAQUIL');
  assert.equal(SPECIES_DATA[157].symbol, 'TOTODILE');
});

test('gen2-species: special name formatting', () => {
  assert.equal(formatSpeciesName('FARFETCH_D'), "Farfetch'd");
  assert.equal(formatSpeciesName('MR__MIME'), 'Mr. Mime');
  assert.equal(formatSpeciesName('HO_OH'), 'Ho-Oh');
  assert.equal(formatSpeciesName('NIDORAN_F'), 'Nidoran\u2640');
  assert.equal(formatSpeciesName('NIDORAN_M'), 'Nidoran\u2642');
  assert.equal(formatSpeciesName('PORYGON2'), 'Porygon2');
  assert.equal(formatSpeciesName('BULBASAUR'), 'Bulbasaur');
});

test('gen2-species: catalog getters', () => {
  const catalog = getGen2SpeciesCatalog();
  assert.equal(catalog.byDexNo.size, 251);
  assert.equal(catalog.byInternalId.size, 251);

  const byDex = getSpeciesByDexNo(catalog, 25);
  assert.equal(byDex.symbol, 'PIKACHU');

  // In Gen 2 Crystal, internal id == dex no, so the byInternalId lookup
  // returns the same entry as byDexNo.
  const byInternal = getSpeciesByInternalId(catalog, 25);
  assert.equal(byInternal.symbol, 'PIKACHU');

  assert.equal(getSpeciesByDexNo(catalog, 0), null);
  assert.equal(getSpeciesByDexNo(catalog, 252), null);
  assert.equal(getSpeciesByInternalId(catalog, -1), null);
});

test('gen2-species: type ids within expected range', () => {
  for (const entry of SPECIES_DATA) {
    assert.ok(entry.type1 >= 0 && entry.type1 < TYPE_NAMES.length, `bad type1 on #${entry.dexNo}`);
    assert.ok(entry.type2 >= 0 && entry.type2 < TYPE_NAMES.length, `bad type2 on #${entry.dexNo}`);
  }
});

test('gen2-species: Steel and Dark types are assigned to Gen 2 mons', () => {
  const steelId = TYPE_NAMES.indexOf('STEEL');
  const darkId = TYPE_NAMES.indexOf('DARK');
  const anySteel = SPECIES_DATA.some((e) => e.type1 === steelId || e.type2 === steelId);
  const anyDark = SPECIES_DATA.some((e) => e.type1 === darkId || e.type2 === darkId);
  assert.ok(anySteel, 'no species with STEEL type');
  assert.ok(anyDark, 'no species with DARK type');
});
