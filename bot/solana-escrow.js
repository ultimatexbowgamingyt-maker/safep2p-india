// ─── Solana On-Chain Escrow — SOL native ───
const {
  Connection, PublicKey, Keypair, SystemProgram,
  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

function getConnection() {
  return new Connection(SOLANA_RPC, 'confirmed');
}

function getKeypair() {
  const pk = process.env.SOLANA_PRIVATE_KEY;
  if (!pk) return null;
  try {
    // Try JSON array format first (solana-keygen output)
    const arr = JSON.parse(pk);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    try {
      // Try base58 format (Phantom wallet export)
      const bs58 = require('bs58');
      return Keypair.fromSecretKey(bs58.decode(pk));
    } catch (e) {
      console.error('⚠️ Solana keypair init failed:', e.message);
      return null;
    }
  }
}

function getMasterAddress() {
  return process.env.SOLANA_WALLET_ADDRESS;
}

// Generate unique escrow amount — micro-SOL offset for unique matching
function generateUniqueAmount(baseAmount) {
  const micro = Math.floor(Math.random() * 9999) + 1;
  return parseFloat((baseAmount + micro / 1000000).toFixed(6));
}

// Get SOL balance of master wallet
async function getSOLBalance() {
  try {
    const connection = getConnection();
    const pubkey = new PublicKey(getMasterAddress());
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (e) {
    console.error('Solana balance check error:', e.message);
    return 0;
  }
}

// Check if a specific SOL amount was deposited since a given timestamp
async function checkDeposit(expectedAmount, sinceTimestamp) {
  try {
    const connection = getConnection();
    const masterPubkey = new PublicKey(getMasterAddress());

    const signatures = await connection.getSignaturesForAddress(masterPubkey, { limit: 30 });

    for (const sigInfo of signatures) {
      // Skip old transactions
      if (sigInfo.blockTime && sigInfo.blockTime * 1000 < sinceTimestamp) continue;
      if (sigInfo.err) continue;

      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || tx.meta?.err) continue;

      // Find master wallet index in account keys
      const staticKeys = tx.transaction.message.staticAccountKeys ||
                         tx.transaction.message.getAccountKeys?.()?.staticAccountKeys || [];
      const masterIdx = staticKeys.findIndex(k => k.toString() === getMasterAddress());
      if (masterIdx < 0) continue;

      const preBalance = tx.meta.preBalances[masterIdx];
      const postBalance = tx.meta.postBalances[masterIdx];
      const receivedSol = (postBalance - preBalance) / LAMPORTS_PER_SOL;

      // Match by unique amount
      if (receivedSol > 0 && Math.abs(receivedSol - expectedAmount) < 0.000001) {
        return {
          txId: sigInfo.signature,
          amount: receivedSol,
          timestamp: (sigInfo.blockTime || 0) * 1000,
          confirmed: true,
        };
      }
    }
    return null;
  } catch (e) {
    console.error('Solana deposit check error:', e.message);
    return null;
  }
}

// Send SOL from master wallet to buyer
async function sendSOL(toAddress, amount) {
  try {
    const keypair = getKeypair();
    if (!keypair) throw new Error('Solana wallet not configured — check SOLANA_PRIVATE_KEY in .env');

    const connection = getConnection();
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair], {
      commitment: 'confirmed',
    });

    return { success: true, txId: signature };
  } catch (e) {
    console.error('Send SOL error:', e.message);
    return { success: false, error: e.message };
  }
}

// Validate a Solana address (base58, 32-44 chars)
function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getMasterAddress,
  generateUniqueAmount,
  getSOLBalance,
  checkDeposit,
  sendSOL,
  isValidSolanaAddress,
};
