// ─── Real On-Chain Escrow — USDT TRC20 on TRON ───
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // TRC20 USDT mainnet

let tronWeb;
try {
  tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {},
    privateKey: process.env.TRON_PRIVATE_KEY,
  });
} catch (e) {
  console.error('⚠️ TronWeb init failed:', e.message);
}

function getMasterAddress() {
  return process.env.TRON_WALLET_ADDRESS;
}

// Generate unique escrow amount — adds random micro-decimals so each deposit is identifiable
function generateUniqueAmount(baseAmount) {
  const micro = Math.floor(Math.random() * 9999) + 1; // 0001–9999
  return parseFloat((baseAmount + micro / 1000000).toFixed(6));
}

// Check USDT balance of master wallet
async function getUSDTBalance() {
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.balanceOf(getMasterAddress()).call();
    return Number(balance) / 1e6;
  } catch (e) {
    console.error('Balance check error:', e.message);
    return 0;
  }
}

// Check TRX balance of master wallet (needed for gas)
async function getTRXBalance() {
  try {
    const balance = await tronWeb.trx.getBalance(getMasterAddress());
    return balance / 1e6; // TRX uses 6 decimals
  } catch (e) {
    console.error('TRX balance check error:', e.message);
    return 0;
  }
}

// Check if a specific USDT amount was deposited to master wallet since a given timestamp
async function checkDeposit(expectedAmount, sinceTimestamp) {
  try {
    const masterAddr = getMasterAddress();
    const url = `https://api.trongrid.io/v1/accounts/${masterAddr}/transactions/trc20?limit=50&contract_address=${USDT_CONTRACT}&only_to=true&min_timestamp=${sinceTimestamp}`;

    const headers = {};
    if (process.env.TRONGRID_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!data.data || data.data.length === 0) return null;

    // Find matching deposit by exact amount (unique micro-decimals)
    for (const tx of data.data) {
      const amount = Number(tx.value) / 1e6;
      // Match within 0.000001 tolerance
      if (tx.to === masterAddr && Math.abs(amount - expectedAmount) < 0.000001) {
        return {
          txId: tx.transaction_id,
          amount,
          from: tx.from,
          timestamp: tx.block_timestamp,
          confirmed: true,
        };
      }
    }
    return null;
  } catch (e) {
    console.error('Deposit check error:', e.message);
    return null;
  }
}

// Send USDT from master wallet to a recipient (buyer or refund to seller)
async function sendUSDT(toAddress, amount) {
  try {
    if (!tronWeb) throw new Error('TronWeb not initialized');

    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const amountSun = Math.floor(amount * 1e6); // USDT has 6 decimals

    const tx = await contract.transfer(toAddress, amountSun).send({
      feeLimit: 100_000_000, // 100 TRX max fee
      shouldPollResponse: false,
    });

    return { success: true, txId: tx };
  } catch (e) {
    console.error('Send USDT error:', e.message);
    return { success: false, error: e.message };
  }
}

// Validate a TRON address
function isValidTronAddress(address) {
  try {
    return TronWeb.isAddress ? TronWeb.isAddress(address) : /^T[a-zA-Z0-9]{33}$/.test(address);
  } catch {
    return /^T[a-zA-Z0-9]{33}$/.test(address);
  }
}

module.exports = {
  getMasterAddress,
  generateUniqueAmount,
  getUSDTBalance,
  getTRXBalance,
  checkDeposit,
  sendUSDT,
  isValidTronAddress,
};
