import {
  Blockfrost,
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  fromHex,
  toHex,
} from 'https://deno.land/x/lucid@0.8.3/mod.ts';
import * as cbor from 'https://deno.land/x/cbor@v1.4.1/index.js';

// dotenv
import 'https://deno.land/x/dotenv@v3.2.2/load.ts';

const lucid = await Lucid.new(
  new Blockfrost(
    'https://cardano-preview.blockfrost.io/api/v0',
    Deno.env.get('BLOCKFROST_API_KEY')
  ),
  'Preview'
);

lucid.selectWalletFromPrivateKey(await Deno.readTextFile('./owner.sk'));

const validator = await readValidator();

const ownerPublicKeyHash = lucid.utils.getAddressDetails(
  await lucid.wallet.address()
).paymentCredential?.hash!;

const beneficiaryPublicKeyHash = lucid.utils.getAddressDetails(
  await Deno.readTextFile('beneficiary.addr')
).paymentCredential?.hash!;

const Datum = Data.Object({
  lock_until: Data.BigInt, // this is POSIX time, you can check and set it here: https://www.unixtimestamp.com
  owner: Data.String, // we can pass owner's verification key hash as byte array but also as a string
  beneficiary: Data.String, // we can beneficiary's hash as byte array but also as a string
});

type Datum = Data.Static<typeof Datum>;

const datum = Data.to<Datum>(
  {
    lock_until: BigInt(Date.now() + 600000), // lock 10min
    owner: ownerPublicKeyHash, // our own wallet verification key hash
    beneficiary: beneficiaryPublicKeyHash,
  },
  Datum
);

const txLock = await lock(1000000n, { into: validator, datum: datum });
console.log('Tx Lock Hash: ', txLock);
console.log('1 tAda is locked to vesting contract for 5 minutes.');

/*
Tx Lock Hash:  1da6975f6bd49f0005c8b3f4267476ab31150195b753998694ff05ee05f606e0
1 tAda is locked to vesting contract for 5 minutes.

Tx Lock Hash:  6f7d55db9d6ddabfd5c0ecdd14dc398eac515a1b9f7ee5a609236ccfce247bd4
1 tAda is locked to vesting contract for 5 minutes.

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
  { into, datum }: { into: SpendingValidator; datum: string }
): Promise<TxHash> {
  const contractAddress = lucid.utils.validatorToAddress(into);

  const tx = await lucid
    .newTx()
    .payToContract(contractAddress, { inline: datum }, { lovelace })
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}
