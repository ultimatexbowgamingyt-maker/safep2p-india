const { Bot, GrammyError, HttpError } = require('grammy');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const db = require('./db');
const kb = require('./keyboards');

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

// ─── Helper ───
function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function escrowStatusEmoji(status) {
  const map = { escrow: '🔒', paid: '💳', released: '📤', completed: '✅', disputed: '⚠️', cancelled: '❌' };
  return map[status] || '❓';
}

function tradeStatusText(trade, userId) {
  const isBuyer = trade.buyer_id === userId;
  const s = trade.status;
  if (s === 'escrow') return isBuyer ? '⏳ Waiting for your payment' : '🔒 Crypto locked in escrow, waiting for buyer payment';
  if (s === 'paid') return isBuyer ? '⏳ Payment sent, waiting for seller to release' : '💳 Buyer says paid! Verify and release crypto';
  if (s === 'completed') return '✅ Trade completed successfully!';
  if (s === 'disputed') return '⚠️ Trade is under dispute. Admin will review.';
  if (s === 'cancelled') return '❌ Trade was cancelled.';
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
    const verified = s?.kyc_verified ? '✅' : '';
    const online = s?.is_online ? '🟢' : '⚪';
    text += `*${i + 1}.* ${online} ${s?.name || 'Trader'} ${verified}\n`;
    text += `   💰 Rate: ${formatINR(o.rate)} per ${o.crypto}\n`;
    text += `   📊 Limit: ${formatINR(o.min_limit)} – ${formatINR(o.max_limit)}\n`;
    text += `   💳 ${o.payment_methods.join(', ')}\n`;
    text += `   ⭐ ${s?.rating || 0} | ${s?.total_trades || 0} trades\n\n`;
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

  ctx.session.step = 'enter_trade_amount';
  ctx.session.offerDraft = { offerId };

  await ctx.editMessageText(
    `💰 *Enter INR amount*\n\n` +
    `Rate: ${formatINR(offer.rate)} per ${offer.crypto}\n` +
    `Limit: ${formatINR(offer.min_limit)} – ${formatINR(offer.max_limit)}\n\n` +
    `Type the INR amount you want to trade (e.g. 5000):`,
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

  const text =
    `${escrowStatusEmoji(trade.status)} *Trade Details*\n\n` +
    `💰 *${trade.crypto_amount} ${trade.crypto}* for *${formatINR(trade.inr_amount)}*\n` +
    `📈 Rate: ${formatINR(trade.rate)} per ${trade.crypto}\n` +
    `💳 Payment: ${trade.payment_method}\n\n` +
    `👤 ${isBuyer ? 'Seller' : 'Buyer'}: *${counterparty?.name || 'Trader'}* ⭐${counterparty?.rating || 0}\n` +
    `${counterparty?.kyc_verified ? '✅ KYC Verified' : '❌ Not Verified'}\n\n` +
    `📊 *Status:* ${tradeStatusText(trade, user.id)}\n\n` +
    `${trade.status === 'escrow' && isBuyer ? '💡 *Send payment to the seller using the agreed method, then click "I Have Paid"*' : ''}` +
    `${trade.status === 'paid' && !isBuyer ? '💡 *Check your account for payment, then click "Release Crypto"*' : ''}`;

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

// Trade: release crypto
bot.callbackQuery(/^trade_release_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '✅ *Release Crypto*\n\n⚠️ Only release if you have confirmed receiving payment!\n\nThis action cannot be undone.',
    { parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard('release', ctx.match[1]) }
  );
});

bot.callbackQuery(/^confirm_release_(.+)$/, async (ctx) => {
  const tradeId = ctx.match[1];
  await db.updateTrade(tradeId, { status: 'completed' });
  await ctx.answerCallbackQuery('Crypto released!');

  const trade = await db.getTrade(tradeId);
  const buyer = trade.buyer;
  const fee = trade.fee_amount || calcFee(trade.inr_amount);

  // Notify buyer
  if (buyer?.telegram_id) {
    await bot.api.sendMessage(buyer.telegram_id,
      `🎉 *Trade Completed!*\n\n` +
      `*${trade.crypto_amount} ${trade.crypto}* has been released!\n\n` +
      `⭐ Please rate the seller:`,
      { parse_mode: 'Markdown', reply_markup: kb.ratingKeyboard(tradeId) }
    ).catch(() => {});
  }

  // Notify admin of fee earned
  if (process.env.ADMIN_CHAT_ID) {
    await bot.api.sendMessage(process.env.ADMIN_CHAT_ID,
      `💰 *Fee Earned!*\n\n` +
      `Trade: ${trade.crypto_amount} ${trade.crypto}\n` +
      `Trade Value: ${formatINR(trade.inr_amount)}\n` +
      `✅ Fee Collected: *${formatINR(fee)}*\n\n` +
      `Buyer: ${trade.buyer?.name}\n` +
      `Seller: ${trade.seller?.name}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  await ctx.editMessageText(
    `🎉 *Trade Completed!*\n\nCrypto released to buyer.\n\n⭐ Rate the buyer:`,
    { parse_mode: 'Markdown', reply_markup: kb.ratingKeyboard(tradeId) }
  );
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
  let text =
    `👤 *Your Profile*\n\n` +
    `📛 Name: *${user.name}*\n` +
    `${verified}\n` +
    `⭐ Rating: ${user.rating || 0}/5\n` +
    `🔄 Trades: ${user.total_trades || 0}\n` +
    `💰 Volume: ${formatINR(user.total_volume || 0)}\n` +
    `${user.upi_id ? `💳 UPI: ${user.upi_id}\n` : ''}` +
    `📅 Joined: ${new Date(user.created_at).toLocaleDateString('en-IN')}\n`;

  if (reviews.length > 0) {
    text += `\n📝 *Recent Reviews:*\n`;
    reviews.slice(0, 5).forEach(r => {
      text += `  ${'⭐'.repeat(r.rating)} by ${r.reviewer?.name || 'Trader'}\n`;
    });
  }

  const profileKb = new (require('grammy')).InlineKeyboard()
    .text('📝 Set UPI ID', 'set_upi').row()
    .text('🏦 Set Bank Details', 'set_bank').row()
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
  if (['🛒 Buy Crypto', '💰 Sell Crypto', '📋 My Offers', '🔄 My Trades', '👤 Profile', '💡 Safety Tips'].includes(text)) return;

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

    if (isNaN(amount) || amount < offer.min_limit || amount > offer.max_limit) {
      await ctx.reply(`❌ Amount must be between ${formatINR(offer.min_limit)} – ${formatINR(offer.max_limit)}:`);
      return;
    }

    const cryptoAmount = (amount / offer.rate).toFixed(8);
    const isBuying = offer.type === 'sell';
    const fee = calcFee(amount);
    const totalPayable = amount + fee;

    // Create trade
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
      status: 'escrow',
    });

    ctx.session.step = null;

    // Notify the offer creator
    const seller = offer.seller;
    if (seller?.telegram_id && seller.telegram_id !== String(ctx.from.id)) {
      await bot.api.sendMessage(seller.telegram_id,
        `🔔 *New Trade Started!*\n\n` +
        `${user.name} wants to ${isBuying ? 'buy' : 'sell'} *${cryptoAmount} ${offer.crypto}* for *${formatINR(amount)}*\n\n` +
        `🔒 Crypto is now in escrow.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new (require('grammy')).InlineKeyboard().text('📄 View Trade', `view_trade_${trade.id}`),
        }
      ).catch(() => {});
    }

    await ctx.reply(
      `🎉 *Trade Created!*\n\n` +
      `🔒 *${cryptoAmount} ${offer.crypto}* is now locked in escrow\n` +
      `💰 Trade Amount: *${formatINR(amount)}*\n` +
      `📊 Platform Fee (0.5%): *${formatINR(fee)}*\n` +
      `💵 Total to Pay: *${formatINR(totalPayable)}*\n` +
      `💳 Pay via: *${offer.payment_methods.join(' / ')}*\n\n` +
      `${isBuying ? '➡️ Send total amount to the seller, then confirm.' : '⏳ Wait for buyer to send payment.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: kb.tradeActionsKeyboard(trade, user.id),
      }
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

// Offer terms + create
bot.on('message:text', async (ctx) => {
  if (ctx.session.step !== 'offer_terms') return;

  const text = ctx.message.text.trim();
  const user = await db.getOrCreateUser(ctx.from);
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

// ─── Start bot ───
console.log('🛡️ SafeP2P India Bot starting...');
bot.start();
console.log('✅ Bot is running!');
