// ─── One-time script: Generate a Solana master escrow wallet ───
// Run: node generate-solana-wallet.js
// Then add the output to your bot/.env file

const { Keypair } = require('@solana/web3.js');

async function main() {
  const keypair = Keypair.generate();
  const privateKeyJson = JSON.stringify(Array.from(keypair.secretKey));

  console.log('\n🔐 ═══════════════════════════════════════════════');
  console.log('   SafeP2P Solana Escrow Wallet Generated!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('Add these lines to your bot/.env file:\n');
  console.log(`SOLANA_WALLET_ADDRESS=${keypair.publicKey.toString()}`);
  console.log(`SOLANA_PRIVATE_KEY='${privateKeyJson}'`);
  console.log(`SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`);
  console.log('\n═══════════════════════════════════════════════════');
  console.log('⚠️  IMPORTANT SAFETY RULES:');
  console.log('═══════════════════════════════════════════════════');
  console.log('1. SAVE the private key somewhere safe (password manager)');
  console.log('2. NEVER share the private key with anyone');
  console.log('3. Fund this wallet with ~0.1 SOL for gas fees');
  console.log('4. This wallet will hold ALL escrowed SOL');
  console.log('5. If private key is lost = ALL funds are lost');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
