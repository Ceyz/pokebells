// Browser entry point. Re-exports the patched inscribe() + the Bells
// network objects so callers can pick mainnet / testnet without importing
// belcoinjs-lib directly. Bundle this file with esbuild to produce a single
// self-contained ESM blob that runs in companion/pokebells/index.html.
import { networks } from "belcoinjs-lib";
import { inscribe } from "./inscribe.mjs";

export { inscribe };

export const BELLS_MAINNET = networks.bellcoin;
export const BELLS_TESTNET = networks.testnet;

export function networkForKey(key) {
  switch (String(key)) {
    case "bells-mainnet":
    case "bellsMainnet":
    case "mainnet":
      return BELLS_MAINNET;
    case "bells-testnet":
    case "bellsTestnet":
    case "testnet":
      return BELLS_TESTNET;
    default:
      throw new Error(`Unknown Bells network key: ${key}`);
  }
}
