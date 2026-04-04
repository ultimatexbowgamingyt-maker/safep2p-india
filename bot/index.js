const { Bot, GrammyError, HttpError } = require('grammy');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const db = require('./db');
const kb = require('./keyboards');
const escrow = require('./escrow');
const solanaEscrow = require('./solana-escrow');

// Pick escrow module based on crypto
function getEscrow(crypto) {
  return crypto === 'SOL' ? solanaEscrow : escrow;
}

function getNetworkLabel(crypto) {
  return crypto === 'SOL' ? 'Solana' : 'TRON (TRC20)';
}

function getAddressLabel(crypto) {
  return crypto === 'SOL' ? 'Solana wallet address' : 'TRON (TRC20) wallet address';
}

function getAddressExample(crypto) {
  return crypto === 'SOL'
    ? '`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`'
    : '`TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`';
}

function isValidWalletAddress(crypto, address) {
  return crypto === 'SOL'
    ? solanaEscrow.isValidSolanaAddress(address)
    : escrow.isValidTronAddress(address);
}

const bot = new Bot(process.env.BOT_TOKEN);

// ─── In-memory session ───
const sessions = {};
function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = { step: null, offerDraft: null, tradeAmount: null, selectedPayments: [] };
  }
  return sessions[chatId];
}

bot.use((ctx, next) => {
  if (ctx.chat) ctx.session = getSession(ctx.chat.id);
  return next();
});

// ─── Fee config ───
const PLATFORM_FEE_PERCENT = 0.5; // 0.5% per trade
function calcFee(inrAmount) {
  return Math.round(inrAmount * PLATFORM_FEE_PERCENT / 100);
}

// ─── Trader Tier System ───
function getTraderTier(user) {
  const trades = user.total_trades || 0;
  const rating = parseFloat(user.rating || 0);

  if (trades === 0) return {
    tier: 'new', label: '🆕 New Trader',
    maxActiveTrades: 1, minTrade: 200, maxTrade: 2000,
    desc: 'First trade! Limit: ₹200–₹2,000, 1 trade at a time.',
  };
  if (trades < 5) return {
    tier: 'beginner', label: '🌱 Beginner',
    maxActiveTrades: 1, minTrade: 200, maxTrade: 5000,
    desc: 'Limit: ₹200–₹5,000, 1 trade at a time.',
  };
  if (trades < 20) return {
    tier: 'member', label: '⭐ Member',
    maxActiveTrades: 3, minTrade: 500, maxTrade: 50000,
    desc: 'Limit: ₹500–₹50,000, 3 trades at a time.',
  };
  if (trades < 50) return {
    tier: 'pro', label: '💎 Pro Trader',
    maxActiveTrades: 5, minTrade: 1000, maxTrade: 15000,
    desc: 'Limit: ₹1,000–₹15,000, 5 trades at a time.',
  };
  return {
    tier: 'elite', label: '👑 Elite Trader',
    maxActiveTrades: 10, minTrade: 1000, maxTrade: 15000,
    desc: 'Limit: ₹1,000–₹15,000, 10 trades at a time.',
  };
}

// ─── Badge System ───
function getBadges(user) {
  const badges = [];
  const trades = user.total_trades || 0;
  const rating = parseFloat(user.rating || 0);

  if (user.kyc_verified) badges.push('✅ KYC');
  if (rating >= 4.8 && trades >= 5) badges.push('🌟 Top Rated');
  else if (rating >= 4.5 && trades >= 3) badges.push('⭐ Trusted');
  if (trades >= 50) badges.push('👑 Elite');
  else if (trades >= 20) badges.push('💎 Pro');
  else if (trades >= 5) badges.push('⭐ Member');
  else badges.push('🆕 New');
  if (trades >= 100) badges.push('🔥 Veteran');

  return badges;
}

function getBadgeString(user) {
  return getBadges(user).join(' ');
}

// ─── Helper ───
function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function escrowStatusEmoji(status) {
  const map = {
    awaiting_deposit: '⏳', crypto_locked: '🔒', paid: '💳', released: '📤',
    completed: '✅', disputed: '⚠️', cancelled: '❌', refunded: '↩️', escrow: '🔒',
  };
  return map[status] || '❓';
}

function tradeStatusText(trade, userId) {
  const isBuyer = trade.buyer_id === userId;
  const s = trade.status;
  if (s === 'awaiting_deposit') return isBuyer ? '⏳ Waiting for seller to deposit USDT into escrow' : '⏳ Deposit your USDT to the escrow wallet';
  if (s === 'crypto_locked') return isBuyer ? '🔒 USDT locked in escrow! Send INR to the seller now' : '🔒 Your USDT is safely locked. Waiting for buyer to pay INR';
  if (s === 'escrow') return isBuyer ? '🔒 Crypto in escrow. Send INR payment' : '🔒 Crypto locked, waiting for buyer payment';
  if (s === 'paid') return isBuyer ? '⏳ Payment sent, waiting for seller to release' : '💳 Buyer says paid! Verify your bank and release crypto';
  if (s === 'completed') return '✅ Trade completed! USDT sent on-chain.';
  if (s === 'disputed') return '⚠️ Trade is under dispute. Admin will review.';
  if (s === 'cancelled') return '❌ Trade was cancelled.';
  if (s === 'refunded') return '↩️ USDT refunded to seller.';
  return s;
}

// ─── /start ───
bot.command('start', async (ctx) => {
  const user = await db.getOrCreateUser(ctx.from);

  await ctx.reply(
    `🛡️ *Welcome to SafeP2P India!*\n\n` +
    `Hey ${user.name}! India's safest P2P crypto trading bot.\n\n` +
    `🔒 *Escrow Protection* — Crypto locked until payment confirmed\n` +
    `✅ *Verified Traders* — KYC verified users only\n` +
    `⭐ *Reputation System* — Trade with trusted people\n` +
    `💡 *Safety Tips* — Avoid bank freezes\n\n` +
    `Use the menu below to start trading 👇`,
    { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
  );
});

// ─── MAIN MENU HANDLERS ───

// Buy Crypto
bot.hears('🛒 Buy Crypto', async (ctx) => {
  await ctx.reply('🛒 *Buy Crypto*\n\nSelect which crypto you want to buy:', {
    parse_mode: 'Markdown',
    reply_markup: kb.cryptoKeyboard('buy'),
  });
});

// Sell Crypto
bot.hears('💰 Sell Crypto', async (ctx) => {
  await ctx.reply('💰 *Sell Crypto*\n\nSelect which crypto you want to sell:', {
    parse_mode: 'Markdown',
    reply_markup: kb.cryptoKeyboard('sell'),
  });
});

// Browse offers by crypto
bot.callbackQuery(/^(buy|sell)_(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  const crypto = ctx.match[2];
  // If user wants to BUY, show SELL offers (and vice versa)
  const offerType = action === 'buy' ? 'sell' : 'buy';

  const offers = await db.getActiveOffers({ type: offerType, crypto });
  await ctx.answerCallbackQuery();

  if (offers.length === 0) {
    await ctx.editMessageText(
      `No ${offerType} offers for ${crypto} right now.\n\n` +
      `💡 *Tip:* Post your own ${action} offer and let traders come to you!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let text = `📋 *${crypto} ${offerType.toUpperCase()} Offers:*\n\n`;
  offers.forEach((o, i) => {
    const s = o.seller;
    const online = s?.is_online ? '🟢' : '⚪';
    const traderBadges = s ? getBadgeString(s) : '🆕';
    text += `*${i + 1}.* ${online} *${s?.name || 'Trader'}*\n`;
    text += `   ${traderBadges}\n`;
    text += `   💰 Rate: ${formatINR(o.rate)} per ${o.crypto}\n`;
    text += `   📊 Limit: ${formatINR(o.min_limit)} – ${formatINR(o.max_limit)}\n`;
    text += `   💳 ${o.payment_methods.join(', ')}\n`;
    text += `   ⭐ ${s?.rating || 0}/5 | ${s?.total_trades || 0} trades\n\n`;
  });

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: kb.offerListKeyboard(offers),
  });
});

// View single offer
bot.callbackQuery(/^view_offer_(.+)$/, async (ctx) => {
  const offerId = ctx.match[1];
  const offer = await db.getOffer(offerId);
  await ctx.answerCallbackQuery();

  if (!offer) {
    await ctx.editMessageText('❌ Offer not found or expired.');
    return;
  }

  const s = offer.seller;
  const verified = s?.kyc_verified ? '✅ KYC Verified' : '❌ Not Verified';
  const action = offer.type === 'sell' ? 'BUY' : 'SELL';

  const text =
    `🔍 *Offer Details*\n\n` +
    `👤 *Trader:* ${s?.name || 'Unknown'} ${s?.is_online ? '🟢 Online' : '⚪ Offline'}\n` +
    `${verified} | ⭐ ${s?.rating || 0} | ${s?.total_trades || 0} trades\n\n` +
    `💰 *${offer.crypto}* @ *${formatINR(offer.rate)}*\n` +
    `📊 Limit: ${formatINR(offer.min_limit)} – ${formatINR(offer.max_limit)}\n` +
    `💳 Payment: ${offer.payment_methods.join(', ')}\n` +
    `⏱️ Completion: ~${offer.completion_time} min\n` +
    `${offer.terms ? `📝 Terms: ${offer.terms}\n` : ''}` +
    `\n🔒 *Escrow protected* — Crypto locked until payment confirmed`;

  const actionKb = new (require('grammy')).InlineKeyboard()
    .text(`⚡ ${action} NOW`, `start_trade_${offerId}`)
    .row()
    .text('⬅️ Back to offers', `${offer.type === 'sell' ? 'buy' : 'sell'}_${offer.crypto}`);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: actionKb,
  });
});

// Start trade — ask amount
bot.callbackQuery(/^start_trade_(.+)$/, async (ctx) => {
  const offerId = ctx.match[1];
  const offer = await db.getOffer(offerId);
  const user = await db.getOrCreateUser(ctx.from);
  await ctx.answerCallbackQuery();

  if (!offer) { await ctx.editMessageText('❌ Offer expired.'); return; }
  if (offer.user_id === user.id) { await ctx.editMessageText('❌ You cannot trade with your own offer.'); return; }

  // ── Tier & safety checks ──
  const tier = getTraderTier(user);
  const activeTrades = await db.getActiveTradesCount(user.id);

  if (activeTrades >= tier.maxActiveTrades) {
    await ctx.editMessageText(
      `⛔ *Trade Limit Reached*\n\n` +
      `Your tier (${tier.label}) allows *${tier.maxActiveTrades} active trade(s)* at a time.\n\n` +
      `Complete your current trade(s) first before starting a new one.\n\n` +
      `💡 Complete more trades to unlock higher limits!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  ctx.session.step = 'enter_trade_amount';
  ctx.session.offerDraft = { offerId };

  const minTrade = Math.max(offer.min_limit, tier.minTrade);
  const maxTrade = tier.maxTrade ? Math.min(offer.max_limit, tier.maxTrade) : offer.max_limit;

  if (minTrade > maxTrade) {
    await ctx.editMessageText(
      `⛔ *Trade Not Available for Your Tier*\n\n` +
      `Your tier (${tier.label}) allows max *${formatINR(tier.maxTrade)}* per trade.\n` +
      `This offer starts at ${formatINR(offer.min_limit)}.\n\n` +
      `Complete more trades to unlock higher limits!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Store tier limits in session
  ctx.session.offerDraft = { offerId, minTrade, maxTrade };

  await ctx.editMessageText(
    `💰 *Enter INR amount*\n\n` +
    `Rate: ${formatINR(offer.rate)} per ${offer.crypto}\n` +
    `Offer limit: ${formatINR(offer.min_limit)} – ${formatINR(offer.max_limit)}\n` +
    `${tier.label} limit: ${formatINR(minTrade)} – ${formatINR(maxTrade)}\n\n` +
    `Type the INR amount (e.g. ${Math.min(5000, maxTrade)}):`,
    { parse_mode: 'Markdown' }
  );
});

// ─── MY OFFERS ───
bot.hears('📋 My Offers', async (ctx) => {
  const user = await db.getOrCreateUser(ctx.from);
  const offers = await db.getUserOffers(user.id);

  if (offers.length === 0) {
    await ctx.reply('📋 You have no active offers.\n\n💡 Post a buy or sell offer to start trading!');
    return;
  }

  let text = '📋 *Your Active Offers:*\n\n';
  offers.forEach((o, i) => {
    const typeEmoji = o.type === 'sell' ? '🟢 SELL' : '🔵 BUY';
    text += `*${i + 1}.* ${typeEmoji} ${o.crypto} @ ${formatINR(o.rate)}\n`;
    text += `   Limit: ${formatINR(o.min_limit)} – ${formatINR(o.max_limit)}\n`;
    text += `   💳 ${o.payment_methods.join(', ')}\n\n`;
  });

  const delKb = new (require('grammy')).InlineKeyboard();
  offers.forEach((o, i) => {
    delKb.text(`🗑️ Remove #${i + 1}`, `del_offer_${o.id}`).row();
  });

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: delKb });
});

bot.callbackQuery(/^del_offer_(.+)$/, async (ctx) => {
  await db.deactivateOffer(ctx.match[1]);
  await ctx.answerCallbackQuery('Offer removed!');
  await ctx.editMessageText('✅ Offer removed.');
});

// ─── MY TRADES ───
bot.hears('🔄 My Trades', async (ctx) => {
  const user = await db.getOrCreateUser(ctx.from);
  const trades = await db.getUserTrades(user.id);

  if (trades.length === 0) {
    await ctx.reply('🔄 No trades yet. Browse offers to start trading!');
    return;
  }

  let text = '🔄 *Your Trades:*\n\n';
  const tradeKb = new (require('grammy')).InlineKeyboard();

  trades.slice(0, 10).forEach((t, i) => {
    const isBuyer = t.buyer_id === user.id;
    const counterparty = isBuyer ? t.seller : t.buyer;
    text += `*${i + 1}.* ${escrowStatusEmoji(t.status)} ${t.crypto} ${formatINR(t.inr_amount)}\n`;
    text += `   ${isBuyer ? 'Bought from' : 'Sold to'}: ${counterparty?.name || 'Trader'}\n`;
    text += `   Status: *${t.status.toUpperCase()}*\n\n`;
    tradeKb.text(`📄 Trade #${i + 1}`, `view_trade_${t.id}`).row();
  });

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: tradeKb });
});

// View trade detail
bot.callbackQuery(/^view_trade_(.+)$/, async (ctx) => {
  const trade = await db.getTrade(ctx.match[1]);
  const user = await db.getOrCreateUser(ctx.from);
  await ctx.answerCallbackQuery();

  if (!trade) { await ctx.editMessageText('❌ Trade not found.'); return; }

  const isBuyer = trade.buyer_id === user.id;
  const counterparty = isBuyer ? trade.seller : trade.buyer;

  let text =
    `${escrowStatusEmoji(trade.status)} *Trade Details*\n\n` +
    `💰 *${trade.crypto_amount} ${trade.crypto}* for *${formatINR(trade.inr_amount)}*\n` +
    `📈 Rate: ${formatINR(trade.rate)} per ${trade.crypto}\n` +
    `💳 Payment: ${trade.payment_method}\n\n` +
    `👤 ${isBuyer ? 'Seller' : 'Buyer'}: *${counterparty?.name || 'Trader'}* ⭐${counterparty?.rating || 0}\n` +
    `${counterparty?.kyc_verified ? '✅ KYC Verified' : '❌ Not Verified'}\n\n`;

  // Show escrow details
  if (trade.escrow_usdt_amount) {
    text += `🔐 Escrow Amount: *${trade.escrow_usdt_amount} USDT*\n`;
    if (trade.deposit_tx_id) text += `📥 Deposit TX: \`${trade.deposit_tx_id.slice(0, 16)}...\`\n`;
    if (trade.release_tx_id) text += `📤 Release TX: \`${trade.release_tx_id.slice(0, 16)}...\`\n`;
    text += '\n';
  }

  text += `📊 *Status:* ${tradeStatusText(trade, user.id)}\n\n`;

  // Contextual help
  if (trade.status === 'awaiting_deposit' && !isBuyer) {
    text += `💡 *Send exactly \`${trade.escrow_usdt_amount}\` USDT (TRC20) to:*\n\`${escrow.getMasterAddress()}\`\n\nThen tap "I've Deposited"`;
  }
  if (trade.status === 'crypto_locked' && isBuyer) {
    text += `💡 *USDT is locked! Send ${formatINR(trade.inr_amount)} to the seller via ${trade.payment_method}, then click "I Have Paid INR"*`;
  }
  if (trade.status === 'paid' && !isBuyer) {
    text += `💡 *Check your bank for payment, then click "Release Crypto" to send USDT to buyer*`;
  }

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: kb.tradeActionsKeyboard(trade, user.id),
  });
});

// Trade: confirm payment
bot.callbackQuery(/^trade_paid_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '💳 *Confirm Payment*\n\nAre you sure you have sent the payment?',
    { parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard('paid', ctx.match[1]) }
  );
});

bot.callbackQuery(/^confirm_paid_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  await db.updateTrade(tradeId, { status: 'paid' });
  await ctx.answerCallbackQuery('Payment confirmed!');

  const trade = await db.getTrade(tradeId);
  const seller = trade.seller;

  // Notify seller
  if (seller?.telegram_id) {
    await bot.api.sendMessage(seller.telegram_id,
      `💳 *Payment Received Notification*\n\n` +
      `Buyer says they've paid *${formatINR(trade.inr_amount)}* for *${trade.crypto_amount} ${trade.crypto}*\n` +
      `Payment method: ${trade.payment_method}\n\n` +
      `⚡ Please verify payment and release crypto.`,
      { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('📄 View Trade', `view_trade_${tradeId}`) }
    ).catch(() => {});
  }

  await ctx.editMessageText('✅ Payment confirmed! Seller has been notified.\n\n⏳ Waiting for seller to release crypto...');
});

// ── Check deposit on blockchain ──
bot.callbackQuery(/^check_deposit_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  const trade = await db.getTrade(tradeId);
  await ctx.answerCallbackQuery();

  if (!trade) { await ctx.editMessageText('❌ Trade not found.'); return; }
  if (trade.status !== 'awaiting_deposit' && trade.status !== 'escrow') {
    await ctx.editMessageText('ℹ️ Deposit already confirmed for this trade.');
    return;
  }

  await ctx.editMessageText('🔍 *Checking blockchain for your deposit...*\n\nThis may take 30–60 seconds.', { parse_mode: 'Markdown' });

  const sinceTimestamp = new Date(trade.created_at).getTime();
  const escrowModule = getEscrow(trade.crypto);
  const deposit = await escrowModule.checkDeposit(trade.escrow_usdt_amount, sinceTimestamp);

  if (deposit) {
    // Deposit found! Lock trade
    await db.markDepositReceived(tradeId, deposit.txId);
    const updatedTrade = await db.getTrade(tradeId);
    const buyer = updatedTrade.buyer;
    const seller = updatedTrade.seller;

    // Notify buyer: crypto is locked, send INR now
    if (buyer?.telegram_id) {
      await bot.api.sendMessage(buyer.telegram_id,
        `🔒 *USDT Locked in Escrow!*\n\n` +
        `*${trade.escrow_usdt_amount} USDT* has been deposited and confirmed on-chain.\n` +
        `TX: \`${deposit.txId}\`\n\n` +
        `💳 Now send *${formatINR(trade.inr_amount)}* to the seller via *${trade.payment_method}*.\n` +
        `After payment, tap "I Have Paid INR".`,
        {
          parse_mode: 'Markdown',
          reply_markup: kb.tradeActionsKeyboard(updatedTrade, buyer.id),
        }
      ).catch(() => {});
    }

    // Confirm to seller
    await ctx.editMessageText(
      `✅ *Deposit Confirmed!*\n\n` +
      `🔒 *${trade.escrow_usdt_amount} USDT* is locked in escrow.\n` +
      `TX: \`${deposit.txId}\`\n\n` +
      `⏳ Waiting for buyer to send *${formatINR(trade.inr_amount)}* via ${trade.payment_method}.\n` +
      `You'll be notified when buyer pays.`,
      { parse_mode: 'Markdown', reply_markup: kb.tradeActionsKeyboard(updatedTrade, seller?.id) }
    );
  } else {
    // Deposit not found yet
    const masterAddr = escrow.getMasterAddress();
    await ctx.editMessageText(
      `❌ *Deposit Not Detected Yet*\n\n` +
      `Make sure you sent *exactly* \`${trade.escrow_usdt_amount}\` USDT (TRC20)\n` +
      `To: \`${masterAddr}\`\n\n` +
      `⏱️ TRON transactions take 1–3 minutes to confirm.\n` +
      `Tap the button to check again:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new (require('grammy')).InlineKeyboard()
          .text('🔄 Check Again', `check_deposit_${tradeId}`).row()
          .text('❌ Cancel Trade', `trade_cancel_${tradeId}`),
      }
    );
  }
});

// Trade: release crypto — NOW SENDS USDT ON-CHAIN
bot.callbackQuery(/^trade_release_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '✅ *Release Crypto*\n\n' +
    '⚠️ Only release if you have *confirmed receiving INR payment* in your bank!\n\n' +
    '🔒 This will send USDT from escrow to the buyer\'s wallet.\n' +
    'This action *cannot be undone*.',
    { parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard('release', ctx.match[1]) }
  );
});

bot.callbackQuery(/^confirm_release_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  const trade = await db.getTrade(tradeId);
  await ctx.answerCallbackQuery();

  if (!trade) { await ctx.editMessageText('❌ Trade not found.'); return; }
  if (!trade.buyer_wallet) {
    await ctx.editMessageText('❌ Buyer wallet address not set. Cannot release.');
    return;
  }

  const network = getNetworkLabel(trade.crypto);
  await ctx.editMessageText(`⏳ *Sending ${trade.crypto} to buyer's wallet...*\n\nPlease wait, confirming on ${network}.`, { parse_mode: 'Markdown' });

  // Calculate: send (escrow amount - fee) to buyer, fee stays in master wallet
  const feeUsdt = trade.escrow_usdt_amount * PLATFORM_FEE_PERCENT / 100;
  const sendAmount = parseFloat((trade.escrow_usdt_amount - feeUsdt).toFixed(6));

  const escrowModule = getEscrow(trade.crypto);
  const sendFn = trade.crypto === 'SOL' ? escrowModule.sendSOL : escrowModule.sendUSDT;
  const result = await sendFn(trade.buyer_wallet, sendAmount);

  if (result.success) {
    await db.markTradeReleased(tradeId, result.txId);
    const fee = trade.fee_amount || calcFee(trade.inr_amount);

    // Notify buyer
    if (trade.buyer?.telegram_id) {
      await bot.api.sendMessage(trade.buyer.telegram_id,
        `🎉 *Trade Completed — USDT Sent!*\n\n` +
        `*${sendAmount} USDT* sent to your wallet:\n` +
        `\`${trade.buyer_wallet}\`\n\n` +
        `TX: \`${result.txId}\`\n\n` +
        `⭐ Please rate the seller:`,
        { parse_mode: 'Markdown', reply_markup: kb.ratingKeyboard(tradeId) }
      ).catch(() => {});
    }

    // Notify admin of fee earned
    if (process.env.ADMIN_CHAT_ID) {
      await bot.api.sendMessage(process.env.ADMIN_CHAT_ID,
        `💰 *Fee Earned!*\n\n` +
        `Trade: ${trade.escrow_usdt_amount} USDT\n` +
        `Sent to buyer: ${sendAmount} USDT\n` +
        `✅ Fee kept: *${feeUsdt.toFixed(6)} USDT* (~${formatINR(fee)})\n` +
        `Release TX: \`${result.txId}\`\n\n` +
        `Buyer: ${trade.buyer?.name}\n` +
        `Seller: ${trade.seller?.name}`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    await ctx.editMessageText(
      `🎉 *Trade Completed!*\n\n` +
      `✅ *${sendAmount} USDT* sent to buyer on-chain.\n` +
      `TX: \`${result.txId}\`\n` +
      `💰 Fee earned: ${feeUsdt.toFixed(6)} USDT\n\n` +
      `⭐ Rate the buyer:`,
      { parse_mode: 'Markdown', reply_markup: kb.ratingKeyboard(tradeId) }
    );
  } else {
    // Send failed — don't mark as complete
    await ctx.editMessageText(
      `❌ *USDT Transfer Failed*\n\n` +
      `Error: ${result.error}\n\n` +
      `The trade is still active. This usually means:\n` +
      `• Not enough TRX for gas in escrow wallet\n` +
      `• Network congestion — try again in a few minutes\n\n` +
      `Tap Release again to retry:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new (require('grammy')).InlineKeyboard()
          .text('✅ Retry Release', `trade_release_${tradeId}`).row()
          .text('⚠️ Dispute', `trade_dispute_${tradeId}`),
      }
    );
  }
});

// Trade: dispute
bot.callbackQuery(/^trade_dispute_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  await db.updateTrade(tradeId, { status: 'disputed' });
  await ctx.answerCallbackQuery('Dispute opened!');

  // Notify admin
  if (process.env.ADMIN_CHAT_ID) {
    const trade = await db.getTrade(tradeId);
    await bot.api.sendMessage(process.env.ADMIN_CHAT_ID,
      `⚠️ *DISPUTE ALERT*\n\nTrade: ${tradeId}\nBuyer: ${trade.buyer?.name}\nSeller: ${trade.seller?.name}\nAmount: ${formatINR(trade.inr_amount)}\nCrypto: ${trade.crypto_amount} ${trade.crypto}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  await ctx.editMessageText('⚠️ *Dispute Opened*\n\nAn admin will review this trade. Both parties have been notified. Do not send any more payments.', { parse_mode: 'Markdown' });
});

// Trade: cancel
bot.callbackQuery(/^trade_cancel_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '❌ *Cancel Trade*\n\nAre you sure? Crypto will be returned to seller.',
    { parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard('cancel', ctx.match[1]) }
  );
});

bot.callbackQuery(/^confirm_cancel_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  const user = await db.getOrCreateUser(ctx.from);
  await db.updateTrade(tradeId, { status: 'cancelled', cancelled_by: user.id });
  await ctx.answerCallbackQuery('Trade cancelled.');
  await ctx.editMessageText('❌ Trade cancelled. Crypto returned to seller.');
});

// Trade: rate
bot.callbackQuery(/^rate_(.+)_(\d)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  const rating = parseInt(ctx.match[2]);
  const user = await db.getOrCreateUser(ctx.from);
  const trade = await db.getTrade(tradeId);
  await ctx.answerCallbackQuery();

  if (!trade) return;

  const reviewedId = trade.buyer_id === user.id ? trade.seller_id : trade.buyer_id;

  try {
    await db.addReview({ trade_id: tradeId, reviewer_id: user.id, reviewed_id: reviewedId, rating });
    await ctx.editMessageText(`⭐ Thanks! You rated ${'⭐'.repeat(rating)} (${rating}/5)\n\nYour feedback helps keep the community safe!`);
  } catch (e) {
    await ctx.editMessageText('You already rated this trade!');
  }
});

// Trade: send message
bot.callbackQuery(/^trade_msg_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  ctx.session.step = 'trade_message';
  ctx.session.offerDraft = { tradeId };
  await ctx.answerCallbackQuery();
  await ctx.reply('💬 Type your message to the other trader:');
});

// Refresh trade
bot.callbackQuery(/^trade_refresh_(.+)$/, async (ctx) => {
  // Re-trigger view
  ctx.match = [null, ctx.match[1]];
  const trade = await db.getTrade(ctx.match[1]);
  const user = await db.getOrCreateUser(ctx.from);
  await ctx.answerCallbackQuery('Refreshed!');

  if (!trade) return;

  const isBuyer = trade.buyer_id === user.id;
  const counterparty = isBuyer ? trade.seller : trade.buyer;

  const text =
    `${escrowStatusEmoji(trade.status)} *Trade Details*\n\n` +
    `💰 *${trade.crypto_amount} ${trade.crypto}* for *${formatINR(trade.inr_amount)}*\n` +
    `📈 Rate: ${formatINR(trade.rate)} per ${trade.crypto}\n` +
    `💳 Payment: ${trade.payment_method}\n\n` +
    `👤 ${isBuyer ? 'Seller' : 'Buyer'}: *${counterparty?.name || 'Trader'}* ⭐${counterparty?.rating || 0}\n\n` +
    `📊 *Status:* ${tradeStatusText(trade, user.id)}`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: kb.tradeActionsKeyboard(trade, user.id),
  });
});

bot.callbackQuery('cancel_action', async (ctx) => {
  await ctx.answerCallbackQuery('Cancelled');
  await ctx.editMessageText('❌ Action cancelled.');
});

// ─── PROFILE ───
bot.hears('👤 Profile', async (ctx) => {
  const user = await db.getOrCreateUser(ctx.from);
  const reviews = await db.getUserReviews(user.id);

  const verified = user.kyc_verified ? '✅ KYC Verified' : '❌ Not Verified';
  const tier = getTraderTier(user);
  const badges = getBadgeString(user);

  let text =
    `👤 *Your Profile*\n\n` +
    `📛 Name: *${user.name}*\n` +
    `🏅 Tier: *${tier.label}*\n` +
    `🎖️ Badges: ${badges}\n` +
    `${verified}\n` +
    `⭐ Rating: ${user.rating || 0}/5\n` +
    `🔄 Trades: ${user.total_trades || 0}\n` +
    `💰 Volume: ${formatINR(user.total_volume || 0)}\n` +
    `${user.upi_id ? `💳 UPI: ${user.upi_id}\n` : ''}` +
    `${user.tron_wallet ? `🔗 TRON Wallet: \`${user.tron_wallet}\`\n` : ''}` +
    `📅 Joined: ${new Date(user.created_at).toLocaleDateString('en-IN')}\n\n` +
    `📊 *Your Limits:* ${tier.desc}\n`;

  if (reviews.length > 0) {
    text += `\n📝 *Recent Reviews:*\n`;
    reviews.slice(0, 5).forEach(r => {
      text += `  ${'⭐'.repeat(r.rating)} by ${r.reviewer?.name || 'Trader'}\n`;
    });
  }

  const profileKb = new (require('grammy')).InlineKeyboard()
    .text('📝 Set UPI ID', 'set_upi').row()
    .text('🏦 Set Bank Details', 'set_bank').row()
    .text('🔗 Set TRON Wallet', 'set_tron_wallet').row()
    .text('🛡️ Complete KYC', 'start_kyc');

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: profileKb });
});

// Set UPI
bot.callbackQuery('set_upi', async (ctx) => {
  ctx.session.step = 'enter_upi';
  await ctx.answerCallbackQuery();
  await ctx.reply('💳 Enter your UPI ID (e.g. yourname@upi):');
});

// Set bank
bot.callbackQuery('set_bank', async (ctx) => {
  ctx.session.step = 'enter_bank';
  await ctx.answerCallbackQuery();
  await ctx.reply('🏦 Enter your bank details in this format:\n\nBank Name | Account Number | IFSC Code\n\nExample: SBI | 1234567890 | SBIN0001234');
});

// Set TRON wallet
bot.callbackQuery('set_tron_wallet', async (ctx) => {
  ctx.session.step = 'enter_tron_wallet';
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '🔗 Enter your TRON (TRC20) wallet address:\n\n' +
    'Example: `TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`\n\n' +
    '⚠️ This is where you\'ll receive USDT from trades.',
    { parse_mode: 'Markdown' }
  );
});

// KYC
bot.callbackQuery('start_kyc', async (ctx) => {
  const user = await db.getOrCreateUser(ctx.from);
  await ctx.answerCallbackQuery();

  if (user.kyc_verified) {
    await ctx.reply('✅ You are already KYC verified!');
    return;
  }

  ctx.session.step = 'kyc_pan';
  await ctx.reply(
    '🛡️ *KYC Verification*\n\n' +
    'This helps build trust with other traders.\n\n' +
    'Step 1/2: Enter your *PAN number* (e.g. ABCDE1234F):',
    { parse_mode: 'Markdown' }
  );
});

// ─── Admin stats ───
bot.command('stats', async (ctx) => {
  if (String(ctx.from.id) !== process.env.ADMIN_CHAT_ID) return;
  const stats = await db.getAdminStats();
  await ctx.reply(
    `📊 *SafeP2P India — Stats*\n\n` +
    `👥 Total Users: *${stats.totalUsers}*\n` +
    `📋 Total Offers: *${stats.totalOffers}*\n` +
    `🔄 Total Trades: *${stats.totalTrades}*\n` +
    `✅ Completed: *${stats.completedTrades}*\n` +
    `💰 Total Volume: *${formatINR(stats.totalVolume)}*\n` +
    `💵 Total Fees Earned: *${formatINR(stats.totalFees)}*`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Admin: escrow wallet balance ───
bot.command('balance', async (ctx) => {
  if (String(ctx.from.id) !== process.env.ADMIN_CHAT_ID) return;

  await ctx.reply('🔍 Checking escrow wallet balances...');

  const [usdtBal, trxBal, solBal] = await Promise.all([
    escrow.getUSDTBalance(),
    escrow.getTRXBalance(),
    solanaEscrow.getSOLBalance(),
  ]);

  await ctx.reply(
    `🏦 *Escrow Wallets Balance*\n\n` +
    `*TRON Escrow (USDT):*\n` +
    `💵 USDT: *${usdtBal.toFixed(2)}*\n` +
    `⛽ TRX (gas): *${trxBal.toFixed(2)}*\n` +
    `📍 \`${escrow.getMasterAddress()}\`\n` +
    `${trxBal < 10 ? '⚠️ Low TRX! Add TRX for gas.' : '✅ TRX OK'}\n\n` +
    `*Solana Escrow (SOL):*\n` +
    `🟣 SOL: *${solBal.toFixed(4)}*\n` +
    `📍 \`${solanaEscrow.getMasterAddress() || 'Not configured'}\`\n` +
    `${solBal < 0.05 ? '⚠️ Low SOL! Add SOL for gas.' : '✅ SOL OK'}`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Admin: refund USDT to seller (for cancelled/disputed trades) ───
bot.command('refund', async (ctx) => {
  if (String(ctx.from.id) !== process.env.ADMIN_CHAT_ID) return;
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    await ctx.reply('Usage: /refund <trade_id> <tron_address>\n\nRefunds escrowed USDT to the seller.');
    return;
  }

  const tradeId = args[1];
  const toAddress = args[2];

  if (!escrow.isValidTronAddress(toAddress)) {
    await ctx.reply('❌ Invalid TRON address.');
    return;
  }

  const trade = await db.getTrade(tradeId);
  if (!trade) { await ctx.reply('❌ Trade not found.'); return; }
  if (!['disputed', 'cancelled', 'crypto_locked', 'awaiting_deposit'].includes(trade.status)) {
    await ctx.reply('❌ Trade is not in a refundable state.');
    return;
  }

  await ctx.reply('⏳ Sending refund...');
  const refundModule = getEscrow(trade.crypto);
  const refundFn = trade.crypto === 'SOL' ? refundModule.sendSOL : refundModule.sendUSDT;
  const result = await refundFn(toAddress, trade.escrow_usdt_amount);

  if (result.success) {
    await db.markTradeRefunded(tradeId, result.txId);
    await ctx.reply(
      `✅ *Refund Sent!*\n\n` +
      `Amount: ${trade.escrow_usdt_amount} USDT\n` +
      `To: \`${toAddress}\`\n` +
      `TX: \`${result.txId}\``,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(`❌ Refund failed: ${result.error}`);
  }
});

// ─── SAFETY TIPS ───
bot.hears('💡 Safety Tips', async (ctx) => {
  await ctx.reply(
    `💡 *SafeP2P — Bank Freeze Prevention Guide*\n\n` +
    `🔒 *1. Small amounts only*\nKeep individual trades under ₹50,000 to reduce bank scrutiny.\n\n` +
    `💬 *2. Don't mention crypto*\nIn bank transfer remarks, use neutral descriptions like "personal transfer".\n\n` +
    `⏱️ *3. Space out trades*\nAvoid multiple large transfers in the same day or week.\n\n` +
    `✅ *4. Trade with verified users*\nOnly trade with KYC-verified, high-reputation traders.\n\n` +
    `📋 *5. Keep records*\nSave trade history and receipts in case of bank inquiry.\n\n` +
    `🏦 *6. Use UPI for small trades*\nUPI is safer than NEFT for smaller amounts — less bank scrutiny.\n\n` +
    `⚠️ *7. Separate bank account*\nConsider using a separate bank account for P2P trades.\n\n` +
    `🔄 *8. Don't rush*\nTake your time. Scammers pressure you to act fast.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── POST OFFER FLOW ───
// Users clicking Buy/Sell crypto from main menu and wanting to POST an offer
bot.command('post', async (ctx) => {
  ctx.session.step = 'offer_type';
  ctx.session.offerDraft = {};
  ctx.session.selectedPayments = [];

  await ctx.reply('📝 *Post a New Offer*\n\nDo you want to:', {
    parse_mode: 'Markdown',
    reply_markup: new (require('grammy')).InlineKeyboard()
      .text('🟢 Sell Crypto', 'post_sell')
      .text('🔵 Buy Crypto', 'post_buy'),
  });
});

bot.callbackQuery(/^post_(sell|buy)$/, async (ctx) => {
  ctx.session.offerDraft = { type: ctx.match[1] };
  ctx.session.step = 'offer_crypto';
  await ctx.answerCallbackQuery();
  await ctx.editMessageText('Select crypto:', {
    reply_markup: kb.cryptoKeyboard('post_crypto'),
  });
});

bot.callbackQuery(/^post_crypto_(.+)$/, async (ctx) => {
  ctx.session.offerDraft.crypto = ctx.match[1];
  ctx.session.step = 'offer_rate';
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`💰 Enter your rate per ${ctx.match[1]} in INR (e.g. 87.5):`);
});

// ─── TEXT INPUT HANDLER (conversation flow) ───
bot.on('message:text', async (ctx) => {
  const step = ctx.session.step;
  const text = ctx.message.text.trim();

  // Skip if main menu button
  if (['🛒 Buy Crypto', '💰 Sell Crypto', '📋 My Offers', '🔄 My Trades', '👤 Profile', '💡 Safety Tips', '❓ Help & Guide'].includes(text)) return;

  if (!step) return;

  const user = await db.getOrCreateUser(ctx.from);

  // ── Offer creation flow ──
  if (step === 'offer_rate') {
    const rate = parseFloat(text);
    if (isNaN(rate) || rate <= 0) { await ctx.reply('❌ Invalid rate. Enter a number (e.g. 87.5):'); return; }
    ctx.session.offerDraft.rate = rate;
    ctx.session.step = 'offer_amount';
    await ctx.reply(`📊 Enter total ${ctx.session.offerDraft.crypto} amount you want to ${ctx.session.offerDraft.type} (e.g. 1000):`);
    return;
  }

  if (step === 'offer_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) { await ctx.reply('❌ Invalid amount. Enter a number:'); return; }
    ctx.session.offerDraft.amount = amount;
    ctx.session.step = 'offer_min';
    await ctx.reply('📉 Enter *minimum* trade limit in INR (e.g. 1000):', { parse_mode: 'Markdown' });
    return;
  }

  if (step === 'offer_min') {
    const min = parseFloat(text);
    if (isNaN(min) || min <= 0) { await ctx.reply('❌ Invalid amount:'); return; }
    ctx.session.offerDraft.min_limit = min;
    ctx.session.step = 'offer_max';
    await ctx.reply('📈 Enter *maximum* trade limit in INR (e.g. 50000):', { parse_mode: 'Markdown' });
    return;
  }

  if (step === 'offer_max') {
    const max = parseFloat(text);
    if (isNaN(max) || max <= ctx.session.offerDraft.min_limit) {
      await ctx.reply('❌ Max must be greater than min limit:');
      return;
    }
    ctx.session.offerDraft.max_limit = max;
    ctx.session.step = 'offer_payment';
    ctx.session.selectedPayments = [];
    await ctx.reply('💳 Select accepted payment methods:', { reply_markup: kb.paymentKeyboard([]) });
    return;
  }

  // ── Trade amount flow ──
  if (step === 'enter_trade_amount') {
    const amount = parseFloat(text);
    const offer = await db.getOffer(ctx.session.offerDraft.offerId);
    if (!offer) { await ctx.reply('❌ Offer expired.'); ctx.session.step = null; return; }

    const minTrade = ctx.session.offerDraft.minTrade || offer.min_limit;
    const maxTrade = ctx.session.offerDraft.maxTrade || offer.max_limit;
    if (isNaN(amount) || amount < minTrade || amount > maxTrade) {
      await ctx.reply(`❌ Amount must be between ${formatINR(minTrade)} – ${formatINR(maxTrade)}:`);
      return;
    }

    // Save amount, ask for wallet
    const offerForCrypto = await db.getOffer(ctx.session.offerDraft.offerId);
    const crypto = offerForCrypto?.crypto || 'USDT';
    ctx.session.offerDraft.tradeAmount = amount;
    ctx.session.offerDraft.crypto = crypto;
    ctx.session.step = 'enter_buyer_wallet';
    await ctx.reply(
      `💰 Trade amount: *${formatINR(amount)}*\n\n` +
      `🔗 Enter your *${getAddressLabel(crypto)}* to receive ${crypto}:\n\n` +
      `Example: ${getAddressExample(crypto)}\n\n` +
      `⚠️ Double-check the address! ${crypto} will be sent here after trade completes.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Buyer enters wallet → create trade with real escrow ──
  if (step === 'enter_buyer_wallet') {
    const crypto = ctx.session.offerDraft.crypto || 'USDT';

    if (!isValidWalletAddress(crypto, text)) {
      const label = getAddressLabel(crypto);
      await ctx.reply(`❌ Invalid ${label}. Please check and try again:`);
      return;
    }

    const offer = await db.getOffer(ctx.session.offerDraft.offerId);
    if (!offer) { await ctx.reply('❌ Offer expired.'); ctx.session.step = null; return; }

    const amount = ctx.session.offerDraft.tradeAmount;
    const cryptoAmount = parseFloat((amount / offer.rate).toFixed(6));
    const isBuying = offer.type === 'sell';
    const fee = calcFee(amount);
    const escrowModule = getEscrow(offer.crypto);
    const escrowAmount = escrowModule.generateUniqueAmount(cryptoAmount);
    const masterAddr = escrowModule.getMasterAddress();
    const network = getNetworkLabel(offer.crypto);

    // Create trade with awaiting_deposit status
    const trade = await db.createTrade({
      offer_id: offer.id,
      buyer_id: isBuying ? user.id : offer.user_id,
      seller_id: isBuying ? offer.user_id : user.id,
      crypto: offer.crypto,
      crypto_amount: cryptoAmount,
      inr_amount: amount,
      fee_amount: fee,
      rate: offer.rate,
      payment_method: offer.payment_methods[0],
      status: 'awaiting_deposit',
      escrow_usdt_amount: escrowAmount,
      buyer_wallet: text,
    });

    ctx.session.step = null;
    ctx.session.offerDraft = null;

    const sellerProfile = isBuying ? offer.seller : user;
    const sellerTgId = sellerProfile?.telegram_id;

    // Notify seller to deposit crypto
    if (sellerTgId) {
      await bot.api.sendMessage(sellerTgId,
        `🔔 *New Trade — Deposit Required!*\n\n` +
        `A buyer wants *${cryptoAmount} ${offer.crypto}* for *${formatINR(amount)}*\n\n` +
        `🔐 *Send exactly:*\n\`${escrowAmount}\` ${offer.crypto} (${network})\n\n` +
        `📍 *To escrow wallet:*\n\`${masterAddr}\`\n\n` +
        `⚠️ Send the *EXACT* amount — this is how we match your deposit.\n\n` +
        `After sending, tap the button below:`,
        {
          parse_mode: 'Markdown',
          reply_markup: new (require('grammy')).InlineKeyboard()
            .text(`✅ I've Deposited ${offer.crypto}`, `check_deposit_${trade.id}`).row()
            .text('❌ Cancel', `trade_cancel_${trade.id}`),
        }
      ).catch(() => {});
    }

    // Confirm to buyer
    await ctx.reply(
      `🎉 *Trade Created — Waiting for Escrow Deposit*\n\n` +
      `💰 Amount: *${formatINR(amount)}* for *${cryptoAmount} ${offer.crypto}*\n` +
      `📊 Platform Fee (0.5%): *${formatINR(fee)}*\n` +
      `🔗 Your wallet: \`${text}\`\n` +
      `🌐 Network: *${network}*\n\n` +
      `⏳ Seller deposits *${escrowAmount} ${offer.crypto}* into escrow.\n\n` +
      `🔒 *You don't pay anything until crypto is locked on-chain!*`,
      { parse_mode: 'Markdown', reply_markup: kb.tradeActionsKeyboard(trade, user.id) }
    );
    return;
  }

  // ── Trade message ──
  if (step === 'trade_message') {
    const tradeId = ctx.session.offerDraft?.tradeId;
    ctx.session.step = null;
    if (!tradeId) return;

    const trade = await db.getTrade(tradeId);
    if (!trade) return;

    const recipientId = trade.buyer_id === user.id ? trade.seller?.telegram_id : trade.buyer?.telegram_id;

    if (recipientId) {
      await bot.api.sendMessage(recipientId,
        `💬 *Message from ${user.name}:*\n\n${text}\n\n_(Trade: ${trade.crypto_amount} ${trade.crypto} for ${formatINR(trade.inr_amount)})_`,
        {
          parse_mode: 'Markdown',
          reply_markup: new (require('grammy')).InlineKeyboard()
            .text('📄 View Trade', `view_trade_${tradeId}`)
            .text('💬 Reply', `trade_msg_${tradeId}`),
        }
      ).catch(() => {});
    }

    await ctx.reply('✅ Message sent!');
    return;
  }

  // ── Set UPI ──
  if (step === 'enter_upi') {
    await db.updateProfile(ctx.from.id, { upi_id: text });
    ctx.session.step = null;
    await ctx.reply(`✅ UPI ID set to: *${text}*`, { parse_mode: 'Markdown' });
    return;
  }

  // ── Set bank ──
  if (step === 'enter_bank') {
    const parts = text.split('|').map(s => s.trim());
    if (parts.length !== 3) {
      await ctx.reply('❌ Invalid format. Use: Bank Name | Account Number | IFSC Code');
      return;
    }
    await db.updateProfile(ctx.from.id, { bank_name: parts[0], bank_account: parts[1], bank_ifsc: parts[2] });
    ctx.session.step = null;
    await ctx.reply(`✅ Bank details saved!\n\n🏦 ${parts[0]}\n💳 ${parts[1]}\n🏷️ IFSC: ${parts[2]}`);
    return;
  }

  // ── Set TRON wallet ──
  if (step === 'enter_tron_wallet') {
    if (!escrow.isValidTronAddress(text)) {
      await ctx.reply('❌ Invalid TRON address. Must start with T and be 34 characters. Try again:');
      return;
    }
    await db.updateProfile(ctx.from.id, { tron_wallet: text });
    ctx.session.step = null;
    await ctx.reply(`✅ TRON wallet saved!\n\n🔗 \`${text}\``, { parse_mode: 'Markdown' });
    return;
  }

  // ── KYC ──
  if (step === 'kyc_pan') {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(text.toUpperCase())) {
      await ctx.reply('❌ Invalid PAN format. Example: ABCDE1234F');
      return;
    }
    ctx.session.offerDraft = { pan: text.toUpperCase() };
    ctx.session.step = 'kyc_aadhaar';
    await ctx.reply('Step 2/2: Enter your *Aadhaar number* (12 digits):', { parse_mode: 'Markdown' });
    return;
  }

  if (step === 'kyc_aadhaar') {
    const clean = text.replace(/\s/g, '');
    if (!/^\d{12}$/.test(clean)) {
      await ctx.reply('❌ Invalid Aadhaar. Must be 12 digits:');
      return;
    }

    await db.updateProfile(ctx.from.id, {
      kyc_verified: true,
      kyc_pan: ctx.session.offerDraft.pan,
      kyc_aadhaar: clean,
    });

    ctx.session.step = null;
    await ctx.reply(
      `✅ *KYC Verified!*\n\n` +
      `Your account is now verified. You'll get a ✅ badge on your offers.\n` +
      `Verified traders get more trades and higher trust!`,
      { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
    );
    return;
  }

  // ── Offer terms + create ──
  if (step === 'offer_terms') {
    const draft = ctx.session.offerDraft;
    draft.terms = text.toLowerCase() === 'skip' ? null : text;
    try {
      await db.createOffer(user.id, draft);
      ctx.session.step = null;
      ctx.session.offerDraft = null;
      await ctx.reply(
        `✅ *Offer Posted!*\n\n` +
        `${draft.type === 'sell' ? '🟢 SELL' : '🔵 BUY'} ${draft.crypto}\n` +
        `💰 Rate: ${formatINR(draft.rate)}\n` +
        `📊 Limit: ${formatINR(draft.min_limit)} – ${formatINR(draft.max_limit)}\n` +
        `💳 ${draft.payment_methods.join(', ')}\n\n` +
        `Your offer is now live! Traders can find it in the marketplace.`,
        { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
      );
    } catch (e) {
      await ctx.reply(`❌ Error creating offer: ${e.message}`);
    }
    return;
  }
});

// ── Payment method selection for offers ──
bot.callbackQuery(/^pay_(.+)$/, async (ctx) => {
  const val = ctx.match[1];
  await ctx.answerCallbackQuery();

  if (val === 'done') {
    if (ctx.session.selectedPayments.length === 0) {
      await ctx.answerCallbackQuery('Select at least one payment method!');
      return;
    }
    ctx.session.offerDraft.payment_methods = ctx.session.selectedPayments;
    ctx.session.step = 'offer_terms';
    await ctx.editMessageText('📝 Enter any terms/conditions for your offer (or type "skip"):');
    return;
  }

  const idx = ctx.session.selectedPayments.indexOf(val);
  if (idx > -1) ctx.session.selectedPayments.splice(idx, 1);
  else ctx.session.selectedPayments.push(val);

  await ctx.editMessageReplyMarkup({ reply_markup: kb.paymentKeyboard(ctx.session.selectedPayments) });
});

// ─── HELP & GUIDE SYSTEM ───

bot.hears('❓ Help & Guide', async (ctx) => {
  await ctx.reply(
    `❓ *SafeP2P India — Help Centre*\n\n` +
    `Welcome! Choose a topic below to learn how everything works 👇`,
    { parse_mode: 'Markdown', reply_markup: kb.helpMenuKeyboard() }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `❓ *SafeP2P India — Help Centre*\n\n` +
    `Welcome! Choose a topic below to learn how everything works 👇`,
    { parse_mode: 'Markdown', reply_markup: kb.helpMenuKeyboard() }
  );
});

bot.callbackQuery('help_how_to_trade', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `📖 *How to Trade on SafeP2P India*\n\n` +

    `*🛒 To BUY crypto:*\n` +
    `1. Tap *🛒 Buy Crypto* from the menu\n` +
    `2. Pick the coin (USDT, BTC, ETH…)\n` +
    `3. Browse available SELL offers from traders\n` +
    `4. Tap an offer → enter the INR amount you want to spend\n` +
    `5. A trade is created — crypto gets *locked in escrow*\n` +
    `6. Send the INR to the seller via UPI/bank\n` +
    `7. Tap ✅ *"I Have Paid"* in the trade\n` +
    `8. Seller verifies payment and releases crypto to you ✅\n\n` +

    `*💰 To SELL crypto:*\n` +
    `1. Type /post to create your sell offer\n` +
    `2. Set your rate, limits, payment methods\n` +
    `3. Wait for a buyer to start a trade\n` +
    `4. You'll get a notification — lock your crypto\n` +
    `5. Buyer sends you INR → you verify it\n` +
    `6. Tap ✅ *"Release Crypto"* to complete trade\n\n` +

    `*⚡ Quick commands:*\n` +
    `/post — Post a new offer\n` +
    `/help — This guide\n` +
    `/stats — Admin stats (owner only)`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_escrow', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🔒 *How Real On-Chain Escrow Works*\n\n` +
    `SafeP2P uses *real blockchain escrow* — not just a database status.\n\n` +

    `*The problem without escrow:*\n` +
    `❌ Buyer sends INR → Seller disappears\n` +
    `❌ Seller sends crypto → Buyer never pays\n\n` +

    `*How SafeP2P real escrow protects you:*\n\n` +
    `1️⃣ *Trade starts* → Seller deposits USDT to the bot's escrow wallet\n` +
    `   Bot verifies deposit *on the TRON blockchain*\n\n` +
    `2️⃣ *USDT locked* → Bot holds the USDT. Neither party can touch it.\n` +
    `   Buyer now sends INR to seller's UPI/bank\n\n` +
    `3️⃣ *Seller verifies INR* → Checks their bank for payment\n` +
    `   Taps "Release Crypto"\n\n` +
    `4️⃣ *Bot sends USDT* → USDT sent on-chain to buyer's TRON wallet ✅\n` +
    `   0.5% fee automatically kept by platform\n\n` +

    `*⚠️ What if there's a problem?*\n` +
    `Either party taps *"Dispute"* → Admin reviews\n` +
    `Admin can force-release to buyer OR refund to seller\n` +
    `USDT stays locked in escrow until resolved\n\n` +

    `*Nobody can steal your money!*\n` +
    `Seller's USDT is on the blockchain — verifiable by anyone.`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_fee', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `💰 *Platform Fee & How Owner Earns*\n\n` +

    `*SafeP2P charges a 0.5% fee per trade.*\n\n` +

    `*Example trade:*\n` +
    `🔄 You trade ₹10,000 worth of USDT\n` +
    `💵 Platform fee = ₹50 (0.5%)\n` +
    `💰 Buyer pays ₹10,050 total\n` +
    `✅ Seller receives ₹10,000\n` +
    `🏦 SafeP2P earns ₹50\n\n` +

    `*More trade examples:*\n` +
    `• ₹1,000 trade → ₹5 fee\n` +
    `• ₹50,000 trade → ₹250 fee\n` +
    `• ₹1,00,000 trade → ₹500 fee\n\n` +

    `*How to check earnings:*\n` +
    `Owner types /stats to see:\n` +
    `• Total trades completed\n` +
    `• Total trading volume (INR)\n` +
    `• Total fees collected 💸\n\n` +

    `*As the platform grows, so do your earnings!*\n` +
    `100 trades of ₹10,000 each = *₹5,000/month* in fees\n` +
    `1,000 trades of ₹10,000 each = *₹50,000/month* in fees 🚀`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_trust', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `⭐ *How to Trust Buyers & Sellers*\n\n` +
    `SafeP2P has 3 layers of trust protection:\n\n` +

    `*1️⃣ KYC Verification ✅*\n` +
    `• Traders verify their PAN + Aadhaar\n` +
    `• Verified users get a ✅ badge on offers\n` +
    `• Always prefer ✅ verified traders\n` +
    `• Unverified = higher risk, trade smaller amounts\n\n` +

    `*2️⃣ Star Rating ⭐*\n` +
    `• After every trade both parties rate 1–5 stars\n` +
    `• Rating shows on every offer (e.g. ⭐4.8)\n` +
    `• Check ratings before starting a trade:\n` +
    `  ⭐⭐⭐⭐⭐ = Very trusted, trade freely\n` +
    `  ⭐⭐⭐⭐ = Good, trade normally\n` +
    `  ⭐⭐⭐ = Caution, trade small amounts\n` +
    `  ⭐⭐ or less = Avoid or trade very small\n\n` +

    `*3️⃣ Trade Count 🔄*\n` +
    `• Shows how many trades completed\n` +
    `• New trader (0–5 trades): trade small, max ₹2,000\n` +
    `• Experienced (10+ trades): can trust more\n` +
    `• Veteran (50+ trades): very reliable\n\n` +

    `*🛡️ Golden Rules:*\n` +
    `✅ Always use escrow — NEVER trade outside the bot\n` +
    `✅ Verify payment in YOUR bank before releasing crypto\n` +
    `✅ Check rating + trade count before big trades\n` +
    `❌ Never trust screenshots of payment — check your bank app\n` +
    `❌ Never release crypto under pressure`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_safety', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🚨 *Stay Safe — Bank Freeze Prevention*\n\n` +
    `India's banks sometimes freeze accounts linked to crypto. Here's how to stay safe:\n\n` +

    `*1️⃣ Keep trades small*\n` +
    `Keep each trade under ₹50,000. Avoid large single transfers that trigger bank alerts.\n\n` +

    `*2️⃣ Don't mention crypto*\n` +
    `In UPI remarks, write "personal transfer" — never "USDT", "BTC", or "crypto".\n\n` +

    `*3️⃣ Space out your trades*\n` +
    `Avoid 5–10 transfers in one day. Spread across days and weeks.\n\n` +

    `*4️⃣ Use a separate bank account*\n` +
    `Dedicated account for P2P = your main account stays safe.\n\n` +

    `*5️⃣ Only trade with verified users*\n` +
    `Unverified traders may have "tainted" funds that trigger freezes on your account.\n\n` +

    `*6️⃣ Keep records*\n` +
    `Save screenshots of all trades in case your bank asks questions.\n\n` +

    `*7️⃣ Use UPI for small amounts*\n` +
    `UPI (under ₹10,000) attracts less scrutiny than NEFT/IMPS.\n\n` +

    `*8️⃣ Don't rush*\n` +
    `Scammers create urgency. Take your time. The escrow protects you.`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_commands', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `📋 *All Bot Commands*\n\n` +
    `*/start* — Welcome screen & main menu\n` +
    `*/post* — Post a new buy/sell offer\n` +
    `*/help* — Help & guide centre\n` +
    `*/stats* — Platform stats (admin only)\n\n` +

    `*Menu Buttons:*\n` +
    `🛒 *Buy Crypto* — Browse sell offers\n` +
    `💰 *Sell Crypto* — Browse buy offers\n` +
    `📋 *My Offers* — View/manage your offers\n` +
    `🔄 *My Trades* — Active & past trades\n` +
    `👤 *Profile* — KYC, UPI, bank, ratings\n` +
    `💡 *Safety Tips* — Bank freeze guide\n` +
    `❓ *Help & Guide* — This help centre\n\n` +

    `*In a trade:*\n` +
    `💳 I Have Paid — After sending INR\n` +
    `✅ Release Crypto — After verifying payment\n` +
    `⚠️ Dispute — If there's a problem\n` +
    `💬 Send Message — Chat with counterparty\n` +
    `⭐ Rate Trader — After trade completes`,
    { parse_mode: 'Markdown', reply_markup: new (require('grammy')).InlineKeyboard().text('« Back to Help', 'help_back') }
  );
});

bot.callbackQuery('help_back', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `❓ *SafeP2P India — Help Centre*\n\n` +
    `Welcome! Choose a topic below to learn how everything works 👇`,
    { parse_mode: 'Markdown', reply_markup: kb.helpMenuKeyboard() }
  );
});

// ─── Error handling ───
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error for ${ctx?.update?.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) console.error('Grammy error:', e.description);
  else if (e instanceof HttpError) console.error('HTTP error:', e);
  else console.error('Unknown error:', e);
});

// ─── Auto-timeout for stuck trades ───
async function checkExpiredTrades() {
  try {
    // 1. Cancel awaiting_deposit trades older than 30 minutes
    const expired = await db.getExpiredTrades(30 * 60 * 1000);
    for (const trade of expired) {
      await db.updateTrade(trade.id, { status: 'cancelled', cancel_reason: 'Auto-cancelled: deposit not received within 30 minutes' });

      // Notify buyer
      const fullTrade = await db.getTrade(trade.id);
      if (fullTrade?.buyer?.telegram_id) {
        await bot.api.sendMessage(fullTrade.buyer.telegram_id,
          `⏰ *Trade Auto-Cancelled*\n\nTrade expired — seller did not deposit ${trade.escrow_usdt_amount} ${trade.crypto} within 30 minutes.\n\nYou were NOT charged anything.`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
      if (fullTrade?.seller?.telegram_id) {
        await bot.api.sendMessage(fullTrade.seller.telegram_id,
          `⏰ *Trade Auto-Cancelled*\n\nYou didn't deposit within 30 minutes so the trade was cancelled.\n\nPlease deposit faster next time to avoid this.`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
      console.log(`⏰ Auto-cancelled expired trade: ${trade.id}`);
    }

    // 2. Alert admin about paid trades waiting > 2 hours (seller hasn't released)
    const overdue = await db.getOverduePaidTrades(120 * 60 * 1000);
    for (const trade of overdue) {
      if (process.env.ADMIN_CHAT_ID) {
        await bot.api.sendMessage(process.env.ADMIN_CHAT_ID,
          `⚠️ *Overdue Trade Alert*\n\nTrade has been in "paid" status for 2+ hours!\n\nTrade ID: \`${trade.id}\`\nBuyer: ${trade.buyer?.name}\nSeller: ${trade.seller?.name}\nAmount: ${formatINR(trade.inr_amount)}\n\nSeller may need assistance.`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Timeout monitor error:', e.message);
  }
}

// ─── Background deposit monitor (checks every 60s) ───
async function checkPendingDeposits() {
  try {
    const pending = await db.getPendingDeposits();
    for (const trade of pending) {
      if (!trade.escrow_usdt_amount) continue;
      const sinceTimestamp = new Date(trade.created_at).getTime();
      const escrowModule = getEscrow(trade.crypto);
      const deposit = await escrowModule.checkDeposit(trade.escrow_usdt_amount, sinceTimestamp);

      if (deposit) {
        await db.markDepositReceived(trade.id, deposit.txId);

        // Notify buyer
        const fullTrade = await db.getTrade(trade.id);
        const buyer = fullTrade?.buyer;
        if (buyer?.telegram_id) {
          await bot.api.sendMessage(buyer.telegram_id,
            `🔒 *USDT Locked in Escrow!*\n\n` +
            `*${trade.escrow_usdt_amount} USDT* confirmed on-chain.\n` +
            `TX: \`${deposit.txId}\`\n\n` +
            `💳 Now send *${formatINR(trade.inr_amount)}* to the seller via *${trade.payment_method}*.\n` +
            `After payment, tap "I Have Paid INR".`,
            {
              parse_mode: 'Markdown',
              reply_markup: kb.tradeActionsKeyboard(fullTrade, buyer.id),
            }
          ).catch(() => {});
        }

        // Notify seller
        const seller = fullTrade?.seller;
        if (seller?.telegram_id) {
          await bot.api.sendMessage(seller.telegram_id,
            `✅ *Deposit Confirmed!*\n\n` +
            `Your *${trade.escrow_usdt_amount} USDT* deposit has been detected.\n` +
            `TX: \`${deposit.txId}\`\n\n` +
            `⏳ Waiting for buyer to pay INR.`,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }

        console.log(`✅ Auto-detected deposit for trade ${trade.id}: ${deposit.txId}`);
      }
    }
  } catch (e) {
    console.error('Deposit monitor error:', e.message);
  }
}

// Run monitors
if (process.env.TRON_WALLET_ADDRESS || process.env.SOLANA_WALLET_ADDRESS) {
  setInterval(checkPendingDeposits, 60_000);   // check deposits every 60s
  setInterval(checkExpiredTrades, 2 * 60_000); // check expired trades every 2 min
  console.log('🔍 Background deposit monitor active (60s interval)');
  console.log('⏰ Auto-timeout monitor active (2min interval)');
  if (process.env.TRON_WALLET_ADDRESS) console.log('  ✅ TRON (USDT) escrow active');
  if (process.env.SOLANA_WALLET_ADDRESS) console.log('  ✅ Solana (SOL) escrow active');
} else {
  console.log('⚠️ No escrow wallet configured. Run: node generate-wallet.js or node generate-solana-wallet.js');
}

// ─── Start bot ───
console.log('🛡️ SafeP2P India Bot starting...');
bot.start();
console.log('✅ Bot is running!');
