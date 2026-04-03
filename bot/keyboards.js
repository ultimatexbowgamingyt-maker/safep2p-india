const { InlineKeyboard, Keyboard } = require('grammy');

const CRYPTOS = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL'];
const PAYMENT_METHODS = ['UPI', 'IMPS', 'NEFT', 'Bank Transfer', 'PhonePe', 'GPay', 'Paytm'];

function mainMenu() {
  return new Keyboard()
    .text('🛒 Buy Crypto').text('💰 Sell Crypto').row()
    .text('📋 My Offers').text('🔄 My Trades').row()
    .text('👤 Profile').text('💡 Safety Tips').row()
    .resized();
}

function cryptoKeyboard(action) {
  const kb = new InlineKeyboard();
  CRYPTOS.forEach((c, i) => {
    kb.text(c, `${action}_${c}`);
    if ((i + 1) % 3 === 0) kb.row();
  });
  return kb;
}

function paymentKeyboard(selected = []) {
  const kb = new InlineKeyboard();
  PAYMENT_METHODS.forEach((p, i) => {
    const isSelected = selected.includes(p);
    kb.text(`${isSelected ? '✅' : '⬜'} ${p}`, `pay_${p}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text('✅ Done', 'pay_done');
  return kb;
}

function offerListKeyboard(offers) {
  const kb = new InlineKeyboard();
  offers.forEach(o => {
    const typeEmoji = o.type === 'sell' ? '🟢' : '🔵';
    const seller = o.seller;
    const label = `${typeEmoji} ${o.crypto} @ ₹${Number(o.rate).toLocaleString()} | ${seller?.name || 'Trader'} (⭐${seller?.rating || 0})`;
    kb.text(label, `view_offer_${o.id}`).row();
  });
  return kb;
}

function tradeActionsKeyboard(trade, userId) {
  const kb = new InlineKeyboard();
  const isBuyer = trade.buyer_id === userId;
  const isSeller = trade.seller_id === userId;

  if (trade.status === 'escrow' && isBuyer) {
    kb.text('💳 I Have Paid', `trade_paid_${trade.id}`).row();
  }
  if (trade.status === 'paid' && isSeller) {
    kb.text('✅ Release Crypto', `trade_release_${trade.id}`).row();
  }
  if (['escrow', 'paid'].includes(trade.status)) {
    kb.text('⚠️ Dispute', `trade_dispute_${trade.id}`).row();
    kb.text('❌ Cancel Trade', `trade_cancel_${trade.id}`).row();
  }
  if (trade.status === 'completed') {
    kb.text('⭐ Rate Trader', `trade_rate_${trade.id}`).row();
  }
  kb.text('💬 Send Message', `trade_msg_${trade.id}`).row();
  kb.text('🔄 Refresh', `trade_refresh_${trade.id}`);
  return kb;
}

function ratingKeyboard(tradeId) {
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 5; i++) {
    kb.text('⭐'.repeat(i), `rate_${tradeId}_${i}`);
  }
  return kb;
}

function confirmKeyboard(action, id) {
  return new InlineKeyboard()
    .text('✅ Confirm', `confirm_${action}_${id}`)
    .text('❌ Cancel', `cancel_action`);
}

module.exports = {
  CRYPTOS, PAYMENT_METHODS,
  mainMenu, cryptoKeyboard, paymentKeyboard, offerListKeyboard,
  tradeActionsKeyboard, ratingKeyboard, confirmKeyboard,
};
