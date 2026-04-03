import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, PlusCircle, User, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Navbar() {
  const { pathname } = useLocation();
  const { currentUser, trades } = useApp();
  const activeTrades = trades.filter(t => t.status === 'escrow' || t.status === 'paid').length;

  const links = [
    { to: '/market', label: 'Market', icon: TrendingUp },
    { to: '/create', label: 'Post Offer', icon: PlusCircle },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile/me', label: 'Profile', icon: User },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl animate-fade-in" style={{ background: 'rgba(15,15,20,0.85)' }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white group">
          <ShieldCheck className="text-emerald-400 group-hover:rotate-12 transition-transform duration-300" size={28} />
          <span>SafeP2P <span className="text-emerald-400 text-sm font-normal">India</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname.startsWith(to)
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 hover:scale-105'
              }`}
            >
              <Icon size={16} />
              {label}
              {label === 'Dashboard' && activeTrades > 0 && (
                <span className="bg-emerald-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeTrades}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-xs font-bold">
              {currentUser.avatar}
            </div>
            <div className="hidden md:block text-sm">
              <div className="text-white font-medium">{currentUser.name}</div>
              <div className="text-emerald-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> KYC Verified
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/10 flex" style={{ background: 'rgba(15,15,20,0.97)' }}>
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${pathname.startsWith(to) ? 'text-emerald-400' : 'text-gray-500'}`}>
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
