import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, profile } = useAuth();
  const [offers, setOffers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [messages, setMessages] = useState({});
  const [loadingOffers, setLoadingOffers] = useState(true);

  // Fetch all active offers with seller profiles
  const fetchOffers = useCallback(async () => {
    setLoadingOffers(true);
    const { data } = await supabase
      .from('offers')
      .select('*, seller:profiles!user_id(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setOffers(data || []);
    setLoadingOffers(false);
  }, []);

  // Fetch user's trades
  const fetchTrades = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('trades')
      .select('*, buyer:profiles!buyer_id(*), seller:profiles!seller_id(*), offer:offers(*)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setTrades(data || []);
  }, [user]);

  // Fetch messages for a trade
  async function fetchMessages(tradeId) {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(name, avatar)')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true });
    setMessages(prev => ({ ...prev, [tradeId]: data || [] }));
    return data;
  }

  // Subscribe to real-time messages for a trade
  function subscribeToMessages(tradeId) {
    const channel = supabase
      .channel(`trade-messages-${tradeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trade_id=eq.${tradeId}`,
      }, async (payload) => {
        // Fetch sender profile for the new message
        const { data: sender } = await supabase
          .from('profiles')
          .select('name, avatar')
          .eq('id', payload.new.sender_id)
          .single();
        const newMsg = { ...payload.new, sender };
        setMessages(prev => ({
          ...prev,
          [tradeId]: [...(prev[tradeId] || []), newMsg],
        }));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  // Subscribe to trade status changes
  function subscribeToTrade(tradeId) {
    const channel = supabase
      .channel(`trade-status-${tradeId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trades',
        filter: `id=eq.${tradeId}`,
      }, (payload) => {
        setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...payload.new } : t));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  // Create a new offer
  async function addOffer(offerData) {
    const { data, error } = await supabase
      .from('offers')
      .insert({
        user_id: user.id,
        type: offerData.type,
        crypto: offerData.crypto,
        amount: offerData.amount,
        rate: offerData.rate,
        min_limit: offerData.minLimit,
        max_limit: offerData.maxLimit,
        payment_methods: offerData.paymentMethods,
        completion_time: offerData.completionTime,
        terms: offerData.terms || null,
      })
      .select()
      .single();
    if (error) throw error;
    await fetchOffers();
    return data.id;
  }

  // Start a trade
  async function startTrade(offer, cryptoAmount, paymentMethod) {
    const inrAmount = Math.round(cryptoAmount * offer.rate);
    const isBuying = offer.type === 'sell';

    const { data, error } = await supabase
      .from('trades')
      .insert({
        offer_id: offer.id,
        buyer_id: isBuying ? user.id : offer.user_id,
        seller_id: isBuying ? offer.user_id : user.id,
        crypto: offer.crypto,
        crypto_amount: cryptoAmount,
        inr_amount: inrAmount,
        rate: offer.rate,
        payment_method: paymentMethod,
        status: 'escrow',
        expires_at: new Date(Date.now() + offer.completion_time * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send system message
    await supabase.from('messages').insert({
      trade_id: data.id,
      sender_id: user.id,
      text: `Trade started: ${cryptoAmount} ${offer.crypto} for ₹${inrAmount.toLocaleString()} via ${paymentMethod}. Crypto is now in escrow.`,
      is_system: true,
    });

    await fetchTrades();
    return data.id;
  }

  // Send a chat message
  async function sendMessage(tradeId, text) {
    const { error } = await supabase.from('messages').insert({
      trade_id: tradeId,
      sender_id: user.id,
      text,
    });
    if (error) throw error;
  }

  // Confirm payment sent (buyer)
  async function confirmPayment(tradeId) {
    const { error } = await supabase
      .from('trades')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', tradeId);
    if (error) throw error;

    await supabase.from('messages').insert({
      trade_id: tradeId,
      sender_id: user.id,
      text: 'Payment sent! Please verify and release crypto.',
      is_system: true,
    });

    await fetchTrades();
  }

  // Release crypto (seller)
  async function releaseCrypto(tradeId) {
    const { error } = await supabase
      .from('trades')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', tradeId);
    if (error) throw error;

    await supabase.from('messages').insert({
      trade_id: tradeId,
      sender_id: user.id,
      text: 'Crypto released! Trade completed successfully.',
      is_system: true,
    });

    await fetchTrades();
  }

  // Submit review
  async function submitReview(tradeId, reviewedId, rating, comment) {
    const { error } = await supabase.from('reviews').insert({
      trade_id: tradeId,
      reviewer_id: user.id,
      reviewed_id: reviewedId,
      rating,
      comment,
    });
    if (error) throw error;
  }

  // Cancel trade
  async function cancelTrade(tradeId, reason) {
    const { error } = await supabase
      .from('trades')
      .update({ status: 'cancelled', cancelled_by: user.id, cancel_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', tradeId);
    if (error) throw error;
    await fetchTrades();
  }

  // Fetch reviews for a user
  async function fetchReviews(userId) {
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviewer_id(name, avatar)')
      .eq('reviewed_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  // Fetch a single profile
  async function fetchUserProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }

  // Set online status
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id).then();

    const handleBeforeUnload = () => {
      supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Initial fetch
  useEffect(() => { fetchOffers(); }, [fetchOffers]);
  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  return (
    <AppContext.Provider value={{
      offers, trades, messages, loadingOffers,
      addOffer, startTrade, sendMessage, confirmPayment, releaseCrypto,
      cancelTrade, submitReview, fetchReviews, fetchUserProfile,
      fetchMessages, subscribeToMessages, subscribeToTrade,
      fetchOffers, fetchTrades,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
