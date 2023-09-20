import {
  Blockfrost,
  OutRef,
  Redeemer,
  Constr,
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  fromHex,
  toHex,
  utf8ToHex,
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

const utxo: OutRef = { txHash: Deno.args[0], outputIndex: 0 };

const redeemer = Data.to(new Constr(0, [utf8ToHex('Hello, World!')]));

const txHash = await unlock(utxo, {
  from: validator,
  using: redeemer,
});

await lucid.awaitTx(txHash);

console.log(`1 tADA unlocked from the contract
      Tx ID:    ${txHash}
      Redeemer: ${redeemer}
  `);

/*
1 tADA unlocked from the contract
      Tx ID:    8af322dd5db624b3beb3852a222741714197bac7075c1edb1ede58fd2395a44a
      Redeemer: d8799f4d48656c6c6f2c20576f726c6421ff
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

async function unlock(
  ref: OutRef,
  { from, using }: { from: SpendingValidator; using: Redeemer }
): Promise<TxHash> {
  const [utxo] = await lucid.utxosByOutRef([ref]);

  const tx = await lucid
    .newTx()
    .collectFrom([utxo], using)
    .addSigner(await lucid.wallet.address())
    .attachSpendingValidator(from)
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}
