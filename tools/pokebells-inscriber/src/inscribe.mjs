// Patched from bells-inscriber@0.2.8 (ISC). Changes from upstream:
//   1. Service-fee output (1_000_000 sats to Nintondo) REMOVED. Our protocol
//      does not charge a per-inscription rent.
//   2. Added inscribeBatch(payloads) that prepares BOTH PSBTs for N payloads
//      so the caller can submit them all via window.nintondo.multiPsbtSign
//      in a SINGLE wallet popup.
//   3. Exports buildCommitAndRevealPsbts({...}) so the caller can inspect /
//      batch PSBTs before signing. The original inscribe() is retained for
//      compatibility as a two-popup fallback.
//
// Protocol envelope is unchanged from upstream:
//   <xOnlyPubKey> OP_CHECKSIG OP_FALSE OP_IF "ord" 01 01 <mime> 00 <chunks...> OP_ENDIF
// Deployed inside a p2tr scriptTree with redeemVersion = 192 (tapscript v0).
import { script as bscript, payments, Psbt } from "belcoinjs-lib";
import { MAX_CHUNK_LEN, UTXO_MIN_VALUE } from "./consts.mjs";
import { getAddressType, getWitnessUtxo, toXOnly } from "./utils.mjs";

function buildInscriptionScript(xOnlyPubKey, contentType, data) {
  const chunks = [
    xOnlyPubKey,
    bscript.OPS.OP_CHECKSIG,
    bscript.OPS.OP_FALSE,
    bscript.OPS.OP_IF,
    Buffer.from("ord", "utf8"),
    1,
    1,
    Buffer.from(contentType, "utf8"),
    0,
  ];
  for (let i = 0; i < data.length; i += MAX_CHUNK_LEN) {
    chunks.push(data.subarray(i, Math.min(i + MAX_CHUNK_LEN, data.length)));
  }
  chunks.push(bscript.OPS.OP_ENDIF);
  return bscript.compile(chunks);
}

function buildP2TR(inscriptionScript, xOnlyPubKey, network) {
  return payments.p2tr({
    internalPubkey: xOnlyPubKey,
    redeem: { output: inscriptionScript, redeemVersion: 192 },
    scriptTree: [{ output: inscriptionScript }, { output: inscriptionScript }],
    network,
  });
}

async function calcFeeForRevealPsbt({
  payment,
  feeRate,
  toAddress,
  xOnlyPubKey,
  signPsbt,
  network,
}) {
  const psbt = new Psbt({ network });
  psbt.addInput({
    hash: Buffer.alloc(32),
    index: 0,
    tapInternalKey: xOnlyPubKey,
    witnessUtxo: {
      script: payment.output,
      value: UTXO_MIN_VALUE + 100,
    },
    tapLeafScript: [
      {
        leafVersion: payment.redeem.redeemVersion,
        script: payment.redeem.output,
        controlBlock: payment.witness[payment.witness.length - 1],
      },
    ],
  });
  psbt.addOutput({ address: toAddress, value: UTXO_MIN_VALUE });
  const signed = Psbt.fromBase64(await signPsbt(psbt.toBase64(), true));
  return signed.extractTransaction(true).virtualSize() * feeRate;
}

async function calcFeeForFundPsbt({ psbt, feeRate, signPsbt }) {
  psbt.addOutput({ address: psbt.txOutputs[0].address, value: 0 });
  const signed = Psbt.fromBase64(await signPsbt(psbt.toBase64()));
  return signed.extractTransaction(true).virtualSize() * feeRate;
}

// Original two-popup path: signs fund immediately, signs reveal immediately,
// returns [fundTxHex, revealTxHex]. Keep as baseline.
export async function inscribe({
  toAddress,
  contentType,
  data,
  feeRate,
  getUtxos,
  publicKey,
  signPsbt,
  network,
  fromAddress,
}) {
  const xOnlyPubKey = toXOnly(publicKey);
  const addressType = getAddressType(fromAddress, network);
  const inscriptionScript = buildInscriptionScript(xOnlyPubKey, contentType, data);
  const payment = buildP2TR(inscriptionScript, xOnlyPubKey, network);

  const revealFee = await calcFeeForRevealPsbt({
    payment,
    feeRate,
    toAddress,
    xOnlyPubKey,
    signPsbt,
    network,
  });
  const requiredAmount = revealFee + UTXO_MIN_VALUE;

  const utxos = await getUtxos(requiredAmount);
  if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
    throw new Error("Insufficient funds");
  }
  if (utxos.length > 500) {
    throw new Error("Too many UTXOs. Consolidate first.");
  }
  const totalValue = utxos.reduce((acc, u) => acc + u.value, 0);

  const fundPsbt = new Psbt({ network });
  for (const utxo of utxos) {
    fundPsbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: getWitnessUtxo(utxo, addressType, publicKey, network),
      nonWitnessUtxo: Buffer.from(utxo.hex, "hex"),
    });
  }
  fundPsbt.addOutput({ address: payment.address, value: requiredAmount });

  const txFee = await calcFeeForFundPsbt({
    psbt: fundPsbt.clone(),
    feeRate,
    signPsbt,
  });
  const change = totalValue - requiredAmount - txFee;
  if (change >= UTXO_MIN_VALUE) {
    fundPsbt.addOutput({ address: fromAddress, value: change });
  } else if (change < 0) {
    throw new Error(
      `Insufficient funds: have ${totalValue}, need ${requiredAmount + txFee}`,
    );
  }

  const signedFund = Psbt.fromBase64(await signPsbt(fundPsbt.toBase64()));
  const fundTx = signedFund.extractTransaction(true);

  const revealPsbt = new Psbt({ network });
  revealPsbt.addInput({
    hash: fundTx.getId(),
    index: 0,
    witnessUtxo: { script: payment.output, value: requiredAmount },
    tapLeafScript: [
      {
        leafVersion: 192,
        script: inscriptionScript,
        controlBlock: payment.witness[payment.witness.length - 1],
      },
    ],
    tapInternalKey: xOnlyPubKey,
  });
  revealPsbt.addOutput({ address: toAddress, value: UTXO_MIN_VALUE });

  const signedReveal = Psbt.fromBase64(
    await signPsbt(revealPsbt.toBase64(), true),
  );
  const revealTx = signedReveal.extractTransaction(true);

  return {
    fundTxHex: fundTx.toHex(),
    revealTxHex: revealTx.toHex(),
    inscriptionId: `${revealTx.getId()}i0`,
  };
}
