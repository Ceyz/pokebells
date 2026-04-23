import { InscribeParams } from "./types.js";
export declare function inscribe({ toAddress, contentType, data, feeRate, getUtxos, publicKey, signPsbt, network, fromAddress, }: InscribeParams): Promise<string[]>;
