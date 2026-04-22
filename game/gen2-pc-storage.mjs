// Gen 2 Crystal PC box storage — Phase 1 scaffolding.
//
// Pokemon Crystal's save file (SRAM) differs from Pokemon Red in layout, box
// count, box element size, and checksum algorithm. This file exposes the
// constants + API surface that shell.js expects, so that the rest of the
// bootloader + capture pipeline works against a Crystal ROM, but the actual
// write-back path (syncOwnedCollectionToPcBoxes) is intentionally a no-op:
// injecting owned Pokemon into Crystal's PC boxes at runtime is not yet
// implemented and must NOT silently corrupt the user's save.
//
// Values below are drawn from pret/pokecrystal:
//   constants/pokemon_data_constants.asm  -> struct / box sizes
//   engine/pokemon/sram.asm + ram/sram.asm -> save layout (banked)
//
// Once someone implements the full write-back, they should remove the no-op
// branch in syncOwnedCollectionToPcBoxes, port serializeBoxMon + writeBoxData
// to Crystal's 32-byte BOXMON struct, and add a Crystal checksum (rolling
// 16-bit sum over the save bank).

// PC-box write path is not yet implemented for Crystal. While this stays
// false, shell.js must NOT try to snapshot ext-ram / checksum the save file
// via binjgb - the placeholder TODO_CRYSTAL_SAVE offsets are bogus for
// Crystal's real layout, which causes binjgb's write_ext_ram to read past
// the Gen 1-derived offsets and OOB (observed on fresh-game boot).
export const PC_SYNC_ENABLED = false;

export const BANK_SIZE = 0x2000;
export const NAME_LENGTH = 11;          // OT / nickname (10 chars + 0x50 terminator)
export const MON_NAME_LENGTH = 11;
export const BOXMON_STRUCT_LENGTH = 32;  // Crystal BOXMON_STRUCT_LENGTH
export const PARTYMON_STRUCT_LENGTH = 48;
export const MONS_PER_BOX = 20;
export const NUM_BOXES = 14;

// BoxN (1-indexed) record layout:
//   byte 0                    : count
//   bytes 1..MONS_PER_BOX     : species bytes
//   byte  1+MONS_PER_BOX      : species terminator (0xFF)
//   BOXMON * MONS_PER_BOX     : 20 * 32 = 640 bytes
//   NAME_LENGTH * MONS_PER_BOX: 20 * 11 = 220 bytes (OT names)
//   MON_NAME_LENGTH * MONS_PER_BOX: 20 * 11 = 220 bytes (nicknames)
//   +2 pad                    : = BOX_LENGTH = 0x450 (1104 bytes)
export const BOX_DATA_SIZE =
  1 + MONS_PER_BOX + 1 + (BOXMON_STRUCT_LENGTH + NAME_LENGTH + MON_NAME_LENGTH) * MONS_PER_BOX + 2;

// Crystal save is split across SRAM banks 0, 1, 2, 3. Main game data lives in
// bank 1 (0x2000 bytes per bank). Boxes 1-7 in bank 2, boxes 8-14 in bank 3.
// These offsets are bank-relative (caller supplies the bank base).
export const CURRENT_BOX_INITIALIZED_FLAG = 0x80;
export const CURRENT_BOX_NUM_MASK = 0x7f;

// TODO_CRYSTAL_SAVE: the following offsets are placeholders. Actual values
// must be read from pokecrystal ram/sram.asm after building the ROM, because
// rgblink decides final bank-relative addresses. Once known, replace and
// re-enable the write-back path.
export const SAVE_DATA_BANK_OFFSET = BANK_SIZE;            // bank 1
export const GAME_DATA_OFFSET = SAVE_DATA_BANK_OFFSET;     // placeholder
export const GAME_DATA_LENGTH = 0x0f8b;                    // placeholder, same magnitude as Gen 1
export const CURRENT_BOX_NUM_OFFSET = SAVE_DATA_BANK_OFFSET; // placeholder
export const CURRENT_BOX_DATA_OFFSET = SAVE_DATA_BANK_OFFSET; // placeholder
export const MAIN_DATA_CHECKSUM_OFFSET = SAVE_DATA_BANK_OFFSET; // placeholder
export const SAVED_BOX_BANK_1_OFFSET = BANK_SIZE * 2;      // bank 2 (boxes 1-7)
export const SAVED_BOX_BANK_2_OFFSET = BANK_SIZE * 3;      // bank 3 (boxes 8-14)
export const MANAGED_BOX_START_INDEX = 10; // boxes 11-14 used for PokeBells-owned mons
export const MANAGED_BOX_COUNT = 4;

export const DEFAULT_TRAINER_NAME = 'PokeBells';
export const DEFAULT_OT_ID = 0x4242;
export const DEFAULT_MOVE_PP = 20;

// Crystal 16-bit rolling sum checksum over the main data block. The actual
// offset/length depend on TODO_CRYSTAL_SAVE above; until those are correct
// this function is never called by the no-op write path, but kept so that
// call sites can import it safely.
export function calcChecksum(buffer, offset, length) {
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum = (sum + (buffer[offset + i] ?? 0)) & 0xffff;
  }
  return sum;
}

export function boxOffsetForIndex(boxIndex) {
  if (!Number.isInteger(boxIndex) || boxIndex < 0 || boxIndex >= NUM_BOXES) {
    throw new Error(`boxIndex ${boxIndex} out of range [0..${NUM_BOXES - 1}]`);
  }
  // Boxes 1-7 (index 0-6) in bank 2, boxes 8-14 (index 7-13) in bank 3.
  if (boxIndex < 7) {
    return SAVED_BOX_BANK_1_OFFSET + boxIndex * BOX_DATA_SIZE;
  }
  return SAVED_BOX_BANK_2_OFFSET + (boxIndex - 7) * BOX_DATA_SIZE;
}

// Scaffolding no-op. Returning { written: 0, incomplete: true } signals the
// shell that we acknowledged the sync request but did nothing - the owned
// collection is still visible on the Trainer hub, just not inside the in-game
// PC (which was always a nice-to-have mirror, never the source of truth).
//
// Implementers porting this to Crystal should:
//   1. Resolve TODO_CRYSTAL_SAVE offsets from a built pokecrystal .sym file.
//   2. Implement serializeBoxMonGen2(pokemon, speciesInfo): Uint8Array(32).
//   3. Implement encodeGen2Text(name): Uint8Array(11) using Gen 2's charmap
//      (pokecrystal charmap.asm - distinct from Gen 1).
//   4. Write boxes MANAGED_BOX_START_INDEX..MANAGED_BOX_START_INDEX+COUNT-1.
//   5. Recompute main-data + box-bank checksums.
export function syncOwnedCollectionToPcBoxes(extRamBuffer, collection, catalog, options = {}) {
  const { log = null } = options;
  if (typeof log === 'function') {
    log('syncOwnedCollectionToPcBoxes: no-op (Crystal writer not implemented)');
  }
  return {
    written: 0,
    total: Array.isArray(collection) ? collection.length : 0,
    incomplete: true,
    reason: 'Crystal PC box writer not implemented (gen2-pc-storage.mjs TODO_CRYSTAL_SAVE)',
  };
}

const browserExports = {
  PC_SYNC_ENABLED,
  BANK_SIZE,
  BOXMON_STRUCT_LENGTH,
  BOX_DATA_SIZE,
  CURRENT_BOX_DATA_OFFSET,
  CURRENT_BOX_INITIALIZED_FLAG,
  CURRENT_BOX_NUM_MASK,
  CURRENT_BOX_NUM_OFFSET,
  DEFAULT_MOVE_PP,
  DEFAULT_OT_ID,
  DEFAULT_TRAINER_NAME,
  GAME_DATA_LENGTH,
  GAME_DATA_OFFSET,
  MAIN_DATA_CHECKSUM_OFFSET,
  MANAGED_BOX_COUNT,
  MANAGED_BOX_START_INDEX,
  MONS_PER_BOX,
  MON_NAME_LENGTH,
  NAME_LENGTH,
  NUM_BOXES,
  PARTYMON_STRUCT_LENGTH,
  SAVED_BOX_BANK_1_OFFSET,
  SAVED_BOX_BANK_2_OFFSET,
  boxOffsetForIndex,
  calcChecksum,
  syncOwnedCollectionToPcBoxes,
};

if (typeof window !== 'undefined') {
  window.PokeBellsGen2PcStorage = browserExports;
}
