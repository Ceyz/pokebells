import { Network } from "belcoinjs-lib";
import { AddressType, ApiUTXO } from "./types.js";
export declare function gptFeeCalculate(inputCount: number, outputCount: number, feeRate: number): number;
export declare const toXOnly: (pubKey: Buffer) => Buffer;
export declare const getWintessUtxo: (utxo: ApiUTXO, addressType: number | undefined, publicKey: Buffer, network: Network) => {
    script: Buffer;
    value: number;
};
export declare function getAddressType(addressStr: string, network: Network): AddressType.P2WPKH | AddressType.P2PKH | AddressType.P2TR | undefined;
