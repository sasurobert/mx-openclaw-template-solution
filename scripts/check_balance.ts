import { ApiNetworkProvider, UserSigner } from '@multiversx/sdk-core';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const walletPath =
    process.env.MULTIVERSX_PRIVATE_KEY ||
    path.resolve(__dirname, '../wallet.pem');

  try {
    const pemContent = await fs.readFile(walletPath, 'utf8');
    const signer = UserSigner.fromPem(pemContent);
    const address = signer.getAddress();

    const providerUrl =
      process.env.MULTIVERSX_API_URL || 'https://devnet-api.multiversx.com';
    const provider = new ApiNetworkProvider(providerUrl);

    const account = await provider.getAccount(address);

    console.log(`\n🔍 Checking Balance for: ${address.toBech32()}`);
    console.log(`🌍 Network: ${providerUrl}`);
    console.log(
      `💰 Balance: ${(BigInt(account.balance.toString()) / 1000000000000000000n).toString()} EGLD`,
    );
    console.log(`🔢 Nonce: ${account.nonce}`);
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

void main();
