import {
  Blockfrost,
  Constr,
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  fromHex,
  toHex,
} from 'https://deno.land/x/lucid@0.8.3/mod.ts';
import * as cbor from 'https://deno.land/x/cbor@v1.4.1/index.js';

// import dotenv
import 'https://deno.land/x/dotenv@v3.2.2/load.ts';

const lucid = await Lucid.new(
  new Blockfrost(
    'https://cardano-preview.blockfrost.io/api/v0',
    Deno.env.get('BLOCKFROST_API_KEY')
  ),
  'Preview'
);

lucid.selectWalletFromPrivateKey(await Deno.readTextFile('./key.sk'));

const validator = await readValidator();

const publicKeyHash = lucid.utils.getAddressDetails(
  await lucid.wallet.address()
).paymentCredential?.hash;
console.log(publicKeyHash);

const datum = Data.to(new Constr(0, [publicKeyHash]));
console.log(datum);

const txHash = await lock(1000000n, { into: validator, owner: datum });

await lucid.awaitTx(txHash);

console.log(`1 tADA locked into the contract at:
      Tx ID: ${txHash}
      Datum: ${datum}
  `);

/*
1 tADA locked into the contract at:
      Tx ID: 1fb265b394e3dc35cc7c3657e372a9b10cb5926b097ddf909cd6b530bfa30230
      Datum: d8799f581c03d93c949a1c7d71e206a0e34b8228e40af951fb75c708b81fa5a420ff
*/

// --- Supporting functions

async function readValidator(): Promise<SpendingValidator> {
  const validator = JSON.parse(await Deno.readTextFile('plutus.json'))
    .validators[0];
  return {
    type: 'PlutusV2',
    script: toHex(cbor.encode(fromHex(validator.compiledCode))),
  };
}

async function lock(
  lovelace: bigint,
  { into, owner }: { into: SpendingValidator; owner: string }
): Promise<TxHash> {
  const contractAddress = lucid.utils.validatorToAddress(into);

  const tx = await lucid
    .newTx()
    .payToContract(contractAddress, { inline: owner }, { lovelace })
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}
