const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

// ─── User / Profile ───
async function getOrCreateUser(telegramUser) {
  const tgId = String(telegramUser.id);

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', tgId)
    .single();

  if (existing) {
    await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('telegram_id', tgId);
    return existing;
  }

  const name = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'Trader';
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      telegram_id: tgId,
      name,
      avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      username: telegramUser.username || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getProfile(tgId) {
  const { data } = await supabase.from('profiles').select('*').eq('telegram_id', String(tgId)).single();
  return data;
}

async function getProfileById(id) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
  return data;
}

async function updateProfile(tgId, updates) {
  const { data } = await supabase.from('profiles').update(updates).eq('telegram_id', String(tgId)).select().single();
  return data;
}

// ─── Offers ───
async function createOffer(userId, offerData) {
  const { data, error } = await supabase
    .from('offers')
    .insert({ user_id: userId, ...offerData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getActiveOffers(filters = {}) {
  let query = supabase.from('offers').select('*, seller:profiles!user_id(*)').eq('is_active', true);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.crypto) query = query.eq('crypto', filters.crypto);
  query = query.order('created_at', { ascending: false }).limit(20);
  const { data } = await query;
  return data || [];
}

async function getOffer(offerId) {
  const { data } = await supabase.from('offers').select('*, seller:profiles!user_id(*)').eq('id', offerId).single();
  return data;
}

async function getUserOffers(userId) {
  const { data } = await supabase.from('offers').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false });
  return data || [];
}

async function deactivateOffer(offerId) {
  await supabase.from('offers').update({ is_active: false }).eq('id', offerId);
}

// ─── Trades ───
async function createTrade(tradeData) {
  const { data, error } = await supabase.from('trades').insert(tradeData).select().single();
  if (error) throw error;
  return data;
}

async function getTrade(tradeId) {
  const { data } = await supabase
    .from('trades')
    .select('*, buyer:profiles!buyer_id(*), seller:profiles!seller_id(*), offer:offers(*)')
    .eq('id', tradeId)
    .single();
  return data;
}

async function getUserTrades(userId) {
  const { data } = await supabase
    .from('trades')
    .select('*, buyer:profiles!buyer_id(*), seller:profiles!seller_id(*)')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

async function updateTrade(tradeId, updates) {
  const { data } = await supabase.from('trades').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', tradeId).select().single();
  return data;
}

// ─── Reviews ───
async function addReview(reviewData) {
  const { data, error } = await supabase.from('reviews').insert(reviewData).select().single();
  if (error) throw error;
  // Update user rating
  const { data: reviews } = await supabase.from('reviews').select('rating').eq('reviewed_id', reviewData.reviewed_id);
  if (reviews && reviews.length > 0) {
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await supabase.from('profiles').update({ rating: avg.toFixed(2), total_trades: reviews.length }).eq('id', reviewData.reviewed_id);
  }
  return data;
}

async function getUserReviews(userId) {
  const { data } = await supabase.from('reviews').select('*, reviewer:profiles!reviewer_id(name)').eq('reviewed_id', userId).order('created_at', { ascending: false }).limit(10);
  return data || [];
}

async function getAdminStats() {
  const [users, offers, trades, completed] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('offers').select('id', { count: 'exact', head: true }),
    supabase.from('trades').select('id', { count: 'exact', head: true }),
    supabase.from('trades').select('inr_amount, fee_amount').eq('status', 'completed'),
  ]);

  const completedTrades = completed.data || [];
  const totalVolume = completedTrades.reduce((s, t) => s + Number(t.inr_amount), 0);
  const totalFees = completedTrades.reduce((s, t) => s + Number(t.fee_amount || 0), 0);

  return {
    totalUsers: users.count || 0,
    totalOffers: offers.count || 0,
    totalTrades: trades.count || 0,
    completedTrades: completedTrades.length,
    totalVolume,
    totalFees,
  };
}

// ─── Escrow helpers ───
async function getPendingDeposits() {
  const { data } = await supabase
    .from('trades')
    .select('*')
    .eq('status', 'awaiting_deposit')
    .order('created_at', { ascending: true });
  return data || [];
}

async function markDepositReceived(tradeId, depositTxId) {
  const { data } = await supabase
    .from('trades')
    .update({
      status: 'crypto_locked',
      crypto_deposited: true,
      deposit_tx_id: depositTxId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();
  return data;
}

async function markTradeReleased(tradeId, releaseTxId) {
  const { data } = await supabase
    .from('trades')
    .update({
      status: 'completed',
      release_tx_id: releaseTxId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();
  return data;
}

async function markTradeRefunded(tradeId, refundTxId) {
  const { data } = await supabase
    .from('trades')
    .update({
      status: 'refunded',
      release_tx_id: refundTxId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();
  return data;
}

module.exports = {
  supabase,
  getOrCreateUser, getProfile, getProfileById, updateProfile,
  createOffer, getActiveOffers, getOffer, getUserOffers, deactivateOffer,
  createTrade, getTrade, getUserTrades, updateTrade,
  addReview, getUserReviews, getAdminStats,
  getPendingDeposits, markDepositReceived, markTradeReleased, markTradeRefunded,
};
