import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Star, Shield, Clock, TrendingUp, Award, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Profile() {
  const { id } = useParams();
  const { users, trades, currentUser } = useApp();
  const user = users[id] || users['me'];
  const isMe = id === 'me' || id === currentUser.id;

  const userTrades = trades.filter(t => t.buyerId === id || t.sellerId === id);
  const completedTrades = userTrades.filter(t => t.status === 'completed');
  const totalVolume = completedTrades.reduce((sum, t) => sum + t.inrAmount, 0);

  const reviews = [
    { id: 1, from: 'Ravi K.', rating: 5, comment: 'Very fast and trustworthy. Payment confirmed within 5 minutes!', date: '2024-03-15' },
    { id: 2, from: 'Priya S.', rating: 5, comment: 'Smooth trade, good communication. Highly recommended.', date: '2024-03-10' },
    { id: 3, from: 'Amit M.', rating: 4, comment: 'Good trader, took a bit longer than expected but all good.', date: '2024-02-28' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl font-bold">
              {user.avatar}
            </div>
            {user.online && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-gray-900"></div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{user.name}</h1>
              {user.kycVerified && (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
                  <CheckCircle size={12} /> KYC Verified
                </span>
              )}
              {!user.kycVerified && (
                <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full">
                  KYC Pending
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">Member since {user.joined}</p>

            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} size={16} className={s <= Math.round(user.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                ))}
                <span className="text-white font-semibold ml-1">{user.rating}</span>
              </div>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400 text-sm">{user.trades} completed trades</span>
            </div>
          </div>

          {isMe && (
            <div className="flex gap-2">
              <button className="flex items-center gap-2 border border-white/10 text-gray-300 hover:border-emerald-500/50 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
                <Upload size={14} /> Complete KYC
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Stats */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-gray-400 text-sm font-medium mb-4">Trade Stats</h3>
            <div className="space-y-4">
              {[
                { icon: TrendingUp, label: 'Total Trades', value: user.trades },
                { icon: Award, label: 'Completed', value: completedTrades.length },
                { icon: Clock, label: 'Avg. Time', value: '18 min' },
                { icon: Shield, label: 'Safety Score', value: '96%' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Icon size={14} />
                    {label}
                  </div>
                  <span className="text-white font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-gray-400 text-sm font-medium mb-4">Volume</h3>
            <div className="text-2xl font-bold text-emerald-400">₹{(totalVolume || 1543000).toLocaleString()}</div>
            <p className="text-gray-500 text-xs mt-1">Total traded volume</p>
          </div>

          {/* KYC Status */}
          <div className={`rounded-2xl p-5 border ${user.kycVerified ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Shield size={16} className={user.kycVerified ? 'text-emerald-400' : 'text-amber-400'} />
              KYC Status
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'PAN Card', done: true },
                { label: 'Aadhaar', done: user.kycVerified },
                { label: 'Selfie', done: user.kycVerified },
                { label: 'Bank Account', done: user.kycVerified },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    {done && <CheckCircle size={10} className="text-white" />}
                  </div>
                  <span className={done ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
                </div>
              ))}
            </div>
            {!user.kycVerified && (
              <button className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                Complete Verification
              </button>
            )}
          </div>
        </div>

        {/* Right: Reviews + Trade History */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Recent Reviews</h3>
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="border-b border-white/5 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{r.from}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                        ))}
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs">{r.date}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Trade History</h3>
            {userTrades.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No trades yet.</p>
            ) : (
              <div className="space-y-2">
                {userTrades.map(t => (
                  <Link key={t.id} to={`/trade/${t.id}`} className="flex items-center justify-between p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${t.buyerId === 'me' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {t.buyerId === 'me' ? 'BUY' : 'SELL'}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{t.cryptoAmount} {t.crypto}</div>
                        <div className="text-gray-500 text-xs">{t.createdAt}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm font-medium">₹{t.inrAmount.toLocaleString()}</div>
                      <div className={`text-xs ${t.status === 'completed' ? 'text-emerald-400' : t.status === 'escrow' ? 'text-amber-400' : 'text-blue-400'}`}>
                        {t.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
