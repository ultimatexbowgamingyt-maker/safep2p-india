import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Star, Clock, Filter, Search, CheckCircle, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CRYPTOS, PAYMENT_METHODS } from '../data/mockData';

function SafetyBadge({ score }) {
  const color = score >= 95 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 85 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
      <Shield size={10} className="inline mr-1" />{score}% Safe
    </span>
  );
}

function OfferCard({ offer }) {
  const { users } = useApp();
  const trader = users[offer.sellerId];

  return (
    <div className="card-hover-glow glass rounded-2xl p-5 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold group-hover:scale-110 transition-transform duration-300">
            {trader.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">{trader.name}</span>
              {trader.kycVerified && <CheckCircle size={14} className="text-emerald-400" />}
              <span className={`w-2 h-2 rounded-full ${trader.online ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400" /> {trader.rating}</span>
              <span>{trader.trades} trades</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {offer.completionTime}min</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${offer.type === 'sell' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {offer.type === 'sell' ? 'SELL' : 'BUY'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-500 text-xs mb-1">Price per {offer.crypto}</div>
          <div className="text-white font-bold text-lg">₹{offer.rate.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Limit</div>
          <div className="text-white text-sm">₹{offer.minLimit.toLocaleString()} – ₹{offer.maxLimit.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {offer.paymentMethods.map(m => (
          <span key={m} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5 text-gray-300">{m}</span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <SafetyBadge score={offer.safetyScore} />
        <Link
          to={`/trade/${offer.id}`}
          className="btn-glow bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg flex items-center gap-1.5"
        >
          <Zap size={14} /> {offer.type === 'sell' ? 'Buy Now' : 'Sell Now'}
        </Link>
      </div>
    </div>
  );
}

export default function Market() {
  const { offers } = useApp();
  const [tab, setTab] = useState('all');
  const [crypto, setCrypto] = useState('all');
  const [payment, setPayment] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = offers.filter(o => {
    if (tab !== 'all' && o.type !== tab) return false;
    if (crypto !== 'all' && o.crypto !== crypto) return false;
    if (payment !== 'all' && !o.paymentMethods.includes(payment)) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-bold text-white mb-2">P2P Marketplace</h1>
        <p className="text-gray-400">Buy or sell crypto with verified Indian traders</p>
      </div>

      {/* Filters */}
      <div className="animate-fade-up delay-100 glass rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tab */}
          <div className="flex bg-black/40 rounded-xl p-1">
            {['all', 'sell', 'buy'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t === 'all' ? 'All' : t === 'sell' ? 'Buy Crypto' : 'Sell Crypto'}
              </button>
            ))}
          </div>

          <select
            value={crypto}
            onChange={e => setCrypto(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
          >
            <option value="all">All Crypto</option>
            {CRYPTOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={payment}
            onChange={e => setPayment(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
          >
            <option value="all">All Payments</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search traders..."
              className="bg-transparent text-white text-sm outline-none flex-1 placeholder-gray-500"
            />
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Filter size={14} />
            {filtered.length} offers
          </div>
        </div>
      </div>

      {/* Offer Grid */}
      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((offer, i) => (
            <div key={offer.id} className="animate-fade-up" style={{ animationDelay: `${(i + 2) * 80}ms` }}>
              <OfferCard offer={offer} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">🔍</div>
          <p>No offers match your filters.</p>
        </div>
      )}
    </div>
  );
}
