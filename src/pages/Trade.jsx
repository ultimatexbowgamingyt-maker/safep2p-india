import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Send, Shield, Lock, CheckCircle, Clock, AlertTriangle, ChevronRight, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';

const STATUS_STEPS = ['escrow', 'paid', 'completed'];
const STATUS_LABELS = { escrow: 'Awaiting Payment', paid: 'Payment Sent — Awaiting Release', completed: 'Trade Complete' };

export default function Trade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { offers, trades, messages, users, currentUser, startTrade, sendMessage, confirmPayment, releaseCrypto } = useApp();

  // Check if it's an offer ID (starting trade) or trade ID (viewing trade)
  const existingTrade = trades.find(t => t.id === id);
  const offer = offers.find(o => o.id === id) || (existingTrade && offers.find(o => o.id === existingTrade.offerId));

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [started, setStarted] = useState(!!existingTrade);
  const [tradeId, setTradeId] = useState(existingTrade?.id || null);
  const [msg, setMsg] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const chatEndRef = useRef(null);

  const trade = trades.find(t => t.id === tradeId);
  const tradeMessages = messages[tradeId] || [];
  const counterparty = trade ? users[trade.sellerId === 'me' ? trade.buyerId : trade.sellerId] : null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tradeMessages]);

  if (!offer) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-gray-400">Offer not found.</p>
        <Link to="/market" className="text-emerald-400 mt-4 inline-block">← Back to Market</Link>
      </div>
    );
  }

  const seller = users[offer.sellerId];
  const inrValue = amount ? Math.round(parseFloat(amount) * offer.rate) : 0;

  function handleStart() {
    const newId = startTrade(offer, parseFloat(amount), paymentMethod);
    setTradeId(newId);
    setStarted(true);
  }

  function handleSend() {
    if (!msg.trim()) return;
    sendMessage(tradeId, msg.trim());
    setMsg('');
  }

  function handleConfirmPayment() {
    confirmPayment(tradeId);
  }

  function handleRelease() {
    releaseCrypto(tradeId);
    setShowRating(true);
  }

  if (showRating && trade?.status === 'completed') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-emerald-400" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Trade Complete!</h2>
        <p className="text-gray-400 mb-8">₹{trade.inrAmount.toLocaleString()} → {trade.cryptoAmount} {trade.crypto}</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <p className="text-white font-medium mb-4">Rate your experience with {counterparty?.name}</p>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)}>
                <Star size={32} className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/dashboard')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors">
            Submit & Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/market" className="text-gray-400 hover:text-white text-sm mb-6 inline-flex items-center gap-1">
          ← Back to Market
        </Link>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Offer info */}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                  {seller.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{seller.name}</span>
                    {seller.kycVerified && <CheckCircle size={14} className="text-emerald-400" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400" /> {seller.rating}</span>
                    <span>{seller.trades} trades</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {offer.completionTime}min avg</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white font-semibold">₹{offer.rate.toLocaleString()} / {offer.crypto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Limits</span>
                  <span className="text-white">₹{offer.minLimit.toLocaleString()} – ₹{offer.maxLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment</span>
                  <span className="text-white">{offer.paymentMethods.join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                <Lock size={16} /> Escrow Protection Active
              </div>
              <p className="text-gray-300 text-sm">
                {offer.type === 'sell' ? `${seller.name}'s ${offer.crypto}` : 'Your crypto'} will be locked in escrow before any payment is made. Your funds are safe.
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={14} />
                <p className="text-amber-200 text-xs">In transfer remarks, write only your name — never mention crypto, BTC, ETH, or any coin name to avoid bank flags.</p>
              </div>
            </div>
          </div>

          {/* Trade form */}
          <div className="md:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sticky top-24">
              <h3 className="text-white font-semibold mb-4">{offer.type === 'sell' ? 'Buy' : 'Sell'} {offer.crypto}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Amount ({offer.crypto})</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={`Min: ${offer.minLimit / offer.rate}`}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder-gray-600 text-sm"
                  />
                  {inrValue > 0 && (
                    <p className="text-emerald-400 text-xs mt-1">≈ ₹{inrValue.toLocaleString()}</p>
                  )}
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm">
                    <option value="">Select method</option>
                    {offer.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <button
                  onClick={handleStart}
                  disabled={!amount || !paymentMethod || inrValue < offer.minLimit || inrValue > offer.maxLimit}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Lock size={14} /> Start Trade (Escrow)
                </button>
                {amount && inrValue < offer.minLimit && (
                  <p className="text-red-400 text-xs text-center">Minimum ₹{offer.minLimit.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active trade view
  const stepIndex = STATUS_STEPS.indexOf(trade?.status || 'escrow');
  const isBuyer = trade?.buyerId === 'me';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-bold text-xl">Active Trade #{tradeId?.slice(-6)}</h2>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${trade?.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : trade?.status === 'paid' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {STATUS_LABELS[trade?.status || 'escrow']}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {STATUS_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stepIndex ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                {i < stepIndex ? <CheckCircle size={14} /> : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && <div className={`h-0.5 w-12 ${i < stepIndex ? 'bg-emerald-500' : 'bg-white/10'}`}></div>}
            </div>
          ))}
          <span className="text-gray-400 text-xs ml-2">{STATUS_LABELS[trade?.status]}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Trade details + actions */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Trade Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Crypto</span><span className="text-white font-semibold">{trade?.cryptoAmount} {trade?.crypto}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">INR Amount</span><span className="text-white font-semibold">₹{trade?.inrAmount?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Payment</span><span className="text-white">{trade?.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Counterparty</span><span className="text-white">{counterparty?.name}</span></div>
            </div>
          </div>

          {/* Escrow status */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <Lock size={14} /> Escrow Locked
            </div>
            <p className="text-gray-300">{trade?.cryptoAmount} {trade?.crypto} is securely locked until both parties confirm.</p>
          </div>

          {/* Action buttons */}
          {trade?.status === 'escrow' && isBuyer && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-white text-sm font-medium">Send ₹{trade.inrAmount.toLocaleString()} via {trade.paymentMethod}</p>
              <div className="bg-black/30 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                <p>• Send to counterparty's UPI/bank details (ask in chat)</p>
                <p className="text-amber-300">• Do NOT write "crypto" in remarks</p>
                <p>• Take a screenshot of transfer confirmation</p>
              </div>
              <button onClick={handleConfirmPayment} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <CheckCircle size={14} /> I've Sent Payment
              </button>
            </div>
          )}

          {trade?.status === 'paid' && !isBuyer && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-white text-sm font-medium">Buyer has confirmed payment</p>
              <p className="text-gray-400 text-xs">Verify that ₹{trade.inrAmount.toLocaleString()} has arrived in your account, then release the crypto.</p>
              <button onClick={handleRelease} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <ChevronRight size={14} /> Release {trade.cryptoAmount} {trade.crypto}
              </button>
            </div>
          )}

          {trade?.status === 'paid' && isBuyer && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-sm">
              <p className="text-blue-300">Payment confirmed. Waiting for seller to verify and release crypto...</p>
            </div>
          )}

          {trade?.status === 'escrow' && !isBuyer && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm">
              <p className="text-amber-200">Waiting for buyer to send ₹{trade?.inrAmount?.toLocaleString()} via {trade?.paymentMethod}...</p>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="md:col-span-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl flex flex-col h-[500px]">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
                {counterparty?.avatar}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{counterparty?.name}</div>
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Online
                </div>
              </div>
              <div className="ml-auto">
                <Shield size={16} className="text-emerald-400" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-center text-xs text-gray-500 bg-black/20 rounded-lg py-2 px-4">
                Trade started. Messages are private. Never share OTP or passwords.
              </div>
              {tradeMessages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.senderId === 'me' ? 'bg-emerald-500 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                    <p>{m.text}</p>
                    <p className={`text-xs mt-1 ${m.senderId === 'me' ? 'text-emerald-100' : 'text-gray-500'}`}>{m.time}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                disabled={trade?.status === 'completed'}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-gray-600 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || trade?.status === 'completed'}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 text-white p-2.5 rounded-xl transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
