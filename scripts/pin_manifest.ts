/**
 * Pin manifest.json to IPFS.
 *
 * If PINATA_API_KEY (JWT) is set, pins via Pinata API.
 * Otherwise prompts user to paste the IPFS URI (manual pin via Pinata, web3.storage, etc.).
 *
 * Usage: npx ts-node scripts/pin_manifest.ts
 * Output: manifest URI (ipfs://... or https://...)
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<string> {
  const manifestPath = path.resolve('manifest.json');
  let manifestUri: string;

  try {
    await fs.access(manifestPath);
  } catch {
    console.error('❌ manifest.json not found. Run: npx ts-node scripts/build_manifest.ts');
    process.exit(1);
  }

  const pinataJwt = process.env.PINATA_API_KEY || process.env.PINATA_JWT;

  if (pinataJwt) {
    console.log('📌 Pinning to IPFS via Pinata...');
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      const formData = new FormData();
      formData.append('file', new Blob([content], { type: 'application/json' }), 'manifest.json');
      formData.append('pinataMetadata', JSON.stringify({ name: 'agent-manifest.json' }));

      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: formData,
      });
      const data = (await res.json()) as { IpfsHash?: string; cid?: string };
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }

      const cid = data.IpfsHash || data.cid;
      if (!cid) {
        throw new Error('No CID in Pinata response');
      }
      manifestUri = `ipfs://${cid}`;
      console.log(`✅ Pinned: ${manifestUri}`);
      console.log(`   Gateway: https://gateway.pinata.cloud/ipfs/${cid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Pinata pin failed:', msg);
      process.exit(1);
    }
  } else {
    console.log('📌 Pin manifest.json to IPFS manually:');
    console.log('   • Pinata: https://app.pinata.cloud/');
    console.log('   • web3.storage: https://web3.storage/');
    console.log('   • Or: ipfs add manifest.json');
    console.log('');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    manifestUri = await new Promise<string>(resolve => {
      rl.question('  Paste the manifest URI (ipfs://... or https://...): ', answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
    if (!manifestUri) {
      console.error('❌ No URI provided.');
      process.exit(1);
    }
    if (!manifestUri.startsWith('ipfs://') && !manifestUri.startsWith('https://')) {
      // CIDv0 (Qm...) or CIDv1 (bafy...)
      if (manifestUri.match(/^Qm[a-zA-Z0-9]{44,}$/) || manifestUri.match(/^baf[a-zA-Z0-9]{45,}$/)) {
        manifestUri = `ipfs://${manifestUri}`;
      } else {
        console.error('❌ URI must be ipfs://..., https://..., or a raw CID (Qm... or bafy...)');
        process.exit(1);
      }
    }
  }

  return manifestUri;
}

main()
  .then(async uri => {
    console.log('');
    console.log('Manifest URI:', uri);
    // Update agent.config.json with manifestUri for register.ts
    const configPath = path.resolve('agent.config.json');
    try {
      const raw = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(raw) as Record<string, unknown>;
      config.manifestUri = uri;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('✅ agent.config.json updated with manifestUri');
    } catch {
      console.warn('⚠️  Could not update agent.config.json — set manifestUri manually before registering');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
