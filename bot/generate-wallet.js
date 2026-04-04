// ─── One-time script: Generate a TRON master escrow wallet ───
// Run: node generate-wallet.js
// Then add the output to your bot/.env file

const TronWeb = require('tronweb');

async function main() {
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
  const account = await tronWeb.createAccount();

  console.log('\n🔐 ═══════════════════════════════════════════════');
  console.log('   SafeP2P Master Escrow Wallet Generated!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('Add these lines to your bot/.env file:\n');
  console.log(`TRON_WALLET_ADDRESS=${account.address.base58}`);
  console.log(`TRON_PRIVATE_KEY=${account.privateKey}`);
  console.log(`TRONGRID_API_KEY=           # optional, get free key at trongrid.io`);
  console.log('\n═══════════════════════════════════════════════════');
  console.log('⚠️  IMPORTANT SAFETY RULES:');
  console.log('═══════════════════════════════════════════════════');
  console.log('1. SAVE the private key somewhere safe (password manager)');
  console.log('2. NEVER share the private key with anyone');
  console.log('3. Fund this wallet with ~100 TRX for gas fees');
  console.log('4. This wallet will hold ALL escrowed USDT');
  console.log('5. If private key is lost = ALL funds are lost');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
