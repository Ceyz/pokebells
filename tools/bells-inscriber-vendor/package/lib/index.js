var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { script as bscript, networks, payments, Psbt, } from "belcoinjs-lib";
import { MAX_CHUNK_LEN, SERVICE_FEE, SERVICE_FEE_MAINNET_ADDRESS, SERVICE_FEE_TESTNET_ADDRESS, UTXO_MIN_VALUE, } from "./consts.js";
import { getAddressType, getWintessUtxo, toXOnly } from "./utils.js";
function calcFeeForFundPsbt(psbt, feeRate, signPsbt) {
    return __awaiter(this, void 0, void 0, function* () {
        psbt.addOutput({ address: psbt.txOutputs[0].address, value: 0 });
        const signedPsbt = Psbt.fromBase64(yield signPsbt(psbt.toBase64()));
        const virtualSize = signedPsbt.extractTransaction(true).virtualSize();
        return virtualSize * feeRate;
    });
}
function calcFeeForRevealPsbt(payment, feeRate, address, xOnlyPubKey, signPsbt, network) {
    return __awaiter(this, void 0, void 0, function* () {
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
        psbt.addOutput({ address, value: UTXO_MIN_VALUE });
        const signedPsbt = Psbt.fromBase64(yield signPsbt(psbt.toBase64(), true));
        const virtualSize = signedPsbt.extractTransaction(true).virtualSize();
        return virtualSize * feeRate;
    });
}
export function inscribe(_a) {
    return __awaiter(this, arguments, void 0, function* ({ toAddress, contentType, data, feeRate, getUtxos, publicKey, signPsbt, network, fromAddress, }) {
        const xOnlyPubKey = toXOnly(publicKey);
        const addressType = getAddressType(fromAddress, network);
        const txs = [];
        const scriptChunks = [
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
            let end = Math.min(i + MAX_CHUNK_LEN, data.length);
            scriptChunks.push(data.subarray(i, end));
        }
        scriptChunks.push(bscript.OPS.OP_ENDIF);
        const inscriptionScript = bscript.compile(scriptChunks);
        const payment = payments.p2tr({
            internalPubkey: xOnlyPubKey,
            redeem: {
                output: inscriptionScript,
                redeemVersion: 192,
            },
            scriptTree: [
                {
                    output: inscriptionScript,
                },
                {
                    output: inscriptionScript,
                },
            ],
            network,
        });
        const requiredAmount = (yield calcFeeForRevealPsbt(payment, feeRate, toAddress, xOnlyPubKey, signPsbt, network)) + UTXO_MIN_VALUE;
        const utxos = yield getUtxos(requiredAmount + SERVICE_FEE);
        if (!utxos || !Array.isArray(utxos)) {
            throw new Error("Insufficient funds");
        }
        if (utxos.length > 500) {
            throw new Error("Too many UTXOs. You need to consolidate them first.");
        }
        let totalValue = utxos.reduce((acc, val) => (acc += val.value), 0);
        const fundPsbt = new Psbt({ network });
        utxos.forEach((utxo) => {
            fundPsbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: getWintessUtxo(utxo, addressType, publicKey, network),
                nonWitnessUtxo: Buffer.from(utxo.hex, "hex"),
            });
        });
        fundPsbt.addOutput({
            address: payment.address,
            value: requiredAmount,
        });
        fundPsbt.addOutput({
            address: network.bech32 === networks.testnet.bech32
                ? SERVICE_FEE_TESTNET_ADDRESS
                : SERVICE_FEE_MAINNET_ADDRESS,
            value: SERVICE_FEE,
        });
        const txFee = yield calcFeeForFundPsbt(fundPsbt.clone(), feeRate, signPsbt);
        const change = totalValue - SERVICE_FEE - requiredAmount - txFee;
        if (change >= 1000) {
            fundPsbt.addOutput({
                address: fromAddress,
                value: change,
            });
        }
        else if (change < 0) {
            throw new Error("Insufficient funds");
        }
        const signedFundPsbt = Psbt.fromBase64(yield signPsbt(fundPsbt.toBase64()));
        const fundTx = signedFundPsbt.extractTransaction(true);
        txs.push(fundTx.toHex());
        const revealPsbt = new Psbt({ network });
        revealPsbt.addInput({
            hash: fundTx.getId(),
            index: 0,
            witnessUtxo: {
                script: payment.output,
                value: requiredAmount,
            },
            tapLeafScript: [
                {
                    leafVersion: 192,
                    script: inscriptionScript,
                    controlBlock: payment.witness[payment.witness.length - 1],
                },
            ],
            tapInternalKey: xOnlyPubKey,
        });
        revealPsbt.addOutput({
            address: toAddress,
            value: UTXO_MIN_VALUE,
        });
        const signedRevealpsbt = Psbt.fromBase64(yield signPsbt(revealPsbt.toBase64(), true));
        const revealTx = signedRevealpsbt.extractTransaction(true);
        txs.push(revealTx.toHex());
        return txs;
    });
}
//# sourceMappingURL=index.js.map