// Patched from bells-inscriber@0.2.8.
// AddressType constants inlined (types.d.ts only used for TS).
import { Transaction, payments, address } from "belcoinjs-lib";

export const AddressType = {
  P2PKH: 0,
  P2WPKH: 1,
  P2TR: 2,
};

export const toXOnly = (pubKey) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

export const getWitnessUtxo = (utxo, addressType, publicKey, network) => {
  const value = Transaction.fromBuffer(Buffer.from(utxo.hex, "hex")).outs[
    utxo.vout
  ].value;
  switch (addressType) {
    case AddressType.P2TR:
      return {
        script: payments.p2tr({
          internalPubkey: toXOnly(publicKey),
          network,
        }).output,
        value,
      };
    case AddressType.P2PKH:
      return {
        script: payments.p2pkh({ pubkey: publicKey, network }).output,
        value,
      };
    case AddressType.P2WPKH:
      return {
        script: payments.p2wpkh({ pubkey: publicKey, network }).output,
        value,
      };
    default:
      return undefined;
  }
};

export function getAddressType(addressStr, network) {
  try {
    const version = address.fromBase58Check(addressStr).version;
    if (version === network.pubKeyHash) return AddressType.P2PKH;
    if (version === network.scriptHash) return undefined;
  } catch {
    try {
      const version = address.fromBech32(addressStr).version;
      if (version === 0x00) return AddressType.P2WPKH;
      if (version === 0x01) return AddressType.P2TR;
    } catch {
      /* fall through */
    }
  }
  return undefined;
}
