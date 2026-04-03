import { Link } from 'react-router-dom';
import { TrendingUp, Clock, CheckCircle, Lock, PlusCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const { trades, offers, currentUser, users } = useApp();

  const myTrades = trades.filter(t => t.buyerId === 'me' || t.sellerId === 'me');
  const activeTrades = myTrades.filter(t => t.status === 'escrow' || t.status === 'paid');
  const completedTrades = myTrades.filter(t => t.status === 'completed');
  const myOffers = offers.filter(o => o.sellerId === 'me');
  const totalVolume = completedTrades.reduce((sum, t) => sum + t.inrAmount, 0);

  const STATUS_COLOR = {
    escrow: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back, {currentUser.name}</p>
        </div>
        <Link to="/create" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
          <PlusCircle size={16} /> Post Offer
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: TrendingUp, label: 'Total Trades', value: myTrades.length, color: 'text-emerald-400' },
          { icon: Lock, label: 'Active Trades', value: activeTrades.length, color: 'text-amber-400' },
          { icon: CheckCircle, label: 'Completed', value: completedTrades.length, color: 'text-emerald-400' },
          { icon: Clock, label: 'Volume', value: `₹${(totalVolume / 1000).toFixed(0)}K`, color: 'text-cyan-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <Icon className={`${color} mb-3`} size={20} />
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-gray-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Trades */}
        <div>
          <h2 className="text-white font-semibold text-lg mb-4">Active Trades</h2>
          {activeTrades.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-400 text-sm">No active trades.</p>
              <Link to="/market" className="text-emerald-400 text-sm mt-2 inline-block hover:text-emerald-300">Browse marketplace →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTrades.map(t => {
                const counterparty = users[t.buyerId === 'me' ? t.sellerId : t.buyerId];
                return (
                  <Link key={t.id} to={`/trade/${t.id}`} className="block bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
                          {counterparty?.avatar}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{counterparty?.name}</div>
                          <div className="text-gray-500 text-xs">{t.createdAt}</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[t.status]}`}>
                        {t.status === 'escrow' ? 'Awaiting Payment' : 'Payment Sent'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-white font-semibold">{t.cryptoAmount} {t.crypto}</span>
                        <span className="text-gray-400 mx-2">↔</span>
                        <span className="text-white font-semibold">₹{t.inrAmount.toLocaleString()}</span>
                      </div>
                      <ArrowRight size={16} className="text-emerald-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* My Offers */}
        <div>
          <h2 className="text-white font-semibold text-lg mb-4">My Offers</h2>
          {myOffers.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-400 text-sm">You haven't posted any offers yet.</p>
              <Link to="/create" className="text-emerald-400 text-sm mt-2 inline-block hover:text-emerald-300">Post your first offer →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map(o => (
                <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${o.type === 'sell' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {o.type.toUpperCase()} {o.crypto}
                      </span>
                    </div>
                    <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded-lg">Live</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rate: <span className="text-white">₹{o.rate.toLocaleString()}</span></span>
                    <span className="text-gray-400">Limit: <span className="text-white">₹{o.minLimit.toLocaleString()}–₹{o.maxLimit.toLocaleString()}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade History */}
        <div className="md:col-span-2">
          <h2 className="text-white font-semibold text-lg mb-4">Recent Trade History</h2>
          {completedTrades.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">No completed trades yet.</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-gray-400 font-medium text-left p-4">Trade</th>
                    <th className="text-gray-400 font-medium text-left p-4">Crypto</th>
                    <th className="text-gray-400 font-medium text-left p-4">INR</th>
                    <th className="text-gray-400 font-medium text-left p-4">Method</th>
                    <th className="text-gray-400 font-medium text-left p-4">Date</th>
                    <th className="text-gray-400 font-medium text-left p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedTrades.map(t => {
                    const counterparty = users[t.buyerId === 'me' ? t.sellerId : t.buyerId];
                    return (
                      <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${t.buyerId === 'me' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {t.buyerId === 'me' ? 'B' : 'S'}
                            </div>
                            <span className="text-gray-300">{counterparty?.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-white font-medium">{t.cryptoAmount} {t.crypto}</td>
                        <td className="p-4 text-white">₹{t.inrAmount.toLocaleString()}</td>
                        <td className="p-4 text-gray-400">{t.paymentMethod}</td>
                        <td className="p-4 text-gray-400">{t.createdAt}</td>
                        <td className="p-4"><span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded-full">Completed</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
