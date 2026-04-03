import { ShieldCheck, Lock, Star, MessageCircle, Zap, TrendingUp, AlertTriangle, Send, Users, ArrowRight } from 'lucide-react';
import { safetyTips } from '../data/mockData';
import { useScrollReveal } from '../hooks/useScrollReveal';
import ParticleBackground from '../components/ParticleBackground';

const BOT_LINK = 'https://t.me/SafeP2PIndiaBot'; // Replace with your actual bot username

function RevealSection({ children, className = '', animation = 'animate-fade-up', delay = '' }) {
  const [ref, visible] = useScrollReveal(0.1);
  return (
    <div ref={ref} className={`${visible ? `${animation} ${delay}` : 'opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #0c1220 50%, #0f0f14 100%)' }}>
      <ParticleBackground />

      {/* Navbar */}
      <nav className="relative z-20 backdrop-blur-xl border-b border-white/10 animate-fade-in" style={{ background: 'rgba(15,15,20,0.85)' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <ShieldCheck className="text-emerald-400" size={28} />
            <span>SafeP2P <span className="text-emerald-400 text-sm font-normal">India</span></span>
          </div>
          <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="btn-glow bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <Send size={16} /> Open on Telegram
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="animate-fade-up inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-5 py-2 text-emerald-400 text-sm mb-8 animate-pulse-glow">
          <ShieldCheck size={14} className="animate-float" /> India's Safest P2P Crypto Trading Bot
        </div>

        <h1 className="animate-fade-up delay-100 text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
          Trade Crypto P2P<br />
          <span
            className="text-transparent bg-clip-text animate-gradient"
            style={{ backgroundImage: 'linear-gradient(90deg, #10b981, #06b6d4, #10b981)', backgroundSize: '200% 200%' }}
          >
            Without Bank Freeze Risk
          </span>
        </h1>

        <p className="animate-fade-up delay-200 text-gray-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Buy & sell crypto safely on Telegram. Escrow protection, KYC-verified traders, and smart tips to keep your bank account safe.
        </p>

        <div className="animate-fade-up delay-300 flex flex-col sm:flex-row gap-4 justify-center">
          <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="btn-glow bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-10 py-4 rounded-xl text-lg flex items-center justify-center gap-3">
            <Send size={22} /> Start Trading on Telegram
          </a>
        </div>

        {/* Telegram Bot Preview */}
        <div className="animate-scale-in delay-500 max-w-sm mx-auto mt-14">
          <div className="glass rounded-2xl p-5 text-left">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="text-emerald-400" size={20} />
              </div>
              <div>
                <div className="text-white font-medium text-sm">SafeP2P India Bot</div>
                <div className="text-emerald-400 text-xs">online</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-emerald-500/10 rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-200 max-w-[280px]">
                🛡️ <strong>Welcome to SafeP2P India!</strong><br /><br />
                India's safest P2P crypto trading bot.<br /><br />
                🔒 Escrow Protection<br />
                ✅ Verified Traders<br />
                ⭐ Reputation System
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                <div className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-xs text-gray-300">🛒 Buy Crypto</div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-xs text-gray-300">💰 Sell Crypto</div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-xs text-gray-300">📋 My Offers</div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-xs text-gray-300">👤 Profile</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
        <RevealSection className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-gray-400 text-lg">3 simple steps, all inside Telegram</p>
        </RevealSection>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '01', icon: Send, title: 'Open Bot', desc: 'Open SafeP2P bot on Telegram and hit /start. Auto-registration, no email needed.' },
            { step: '02', icon: TrendingUp, title: 'Find Offers', desc: 'Browse buy/sell offers by crypto. See ratings, limits, payment methods.' },
            { step: '03', icon: Lock, title: 'Trade with Escrow', desc: 'Start a trade — crypto gets locked in escrow. Pay, confirm, release.' },
            { step: '04', icon: Star, title: 'Rate & Repeat', desc: 'Rate your trader after each trade. Build reputation, trade more.' },
          ].map(({ step, icon: Icon, title, desc }, i) => (
            <RevealSection key={step} delay={`delay-${(i + 1) * 100}`}>
              <div className="card-hover-glow glass rounded-2xl p-6 text-center h-full group cursor-default">
                <div className="text-emerald-500/30 text-5xl font-bold mb-3 group-hover:text-emerald-500/50 transition-colors">{step}</div>
                <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/20 transition-all group-hover:scale-110 duration-300">
                  <Icon className="text-emerald-400" size={24} />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-gray-400 text-sm">{desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>

      {/* Safety Tips */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
        <RevealSection>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-8 md:p-12 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-amber-400" size={24} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">Stay Safe — Avoid Bank Freezes</h2>
            </div>
            <p className="text-gray-400 mb-8 text-lg">Follow these guidelines every Indian P2P trader should know:</p>
            <div className="grid md:grid-cols-3 gap-4">
              {safetyTips.map((tip, i) => (
                <RevealSection key={tip.title} delay={`delay-${(i + 1) * 100}`}>
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5 card-hover group h-full">
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300 inline-block">{tip.icon}</div>
                    <h4 className="text-white font-semibold mb-1">{tip.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{tip.desc}</p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </RevealSection>
      </div>

      {/* Features */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
        <RevealSection className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why SafeP2P India?</h2>
          <p className="text-gray-400 text-lg">Built from ground up for Indian P2P traders</p>
        </RevealSection>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Lock, title: 'Escrow Protection', desc: 'Crypto is locked until both parties confirm. No one runs away with your money.', color: 'from-emerald-500/20 to-cyan-500/20' },
            { icon: ShieldCheck, title: 'KYC Verified Traders', desc: 'Verify PAN & Aadhaar directly in the bot. Trade only with real people.', color: 'from-blue-500/20 to-emerald-500/20' },
            { icon: MessageCircle, title: 'In-Trade Messaging', desc: 'Chat with your trade partner directly in Telegram. No external apps needed.', color: 'from-purple-500/20 to-blue-500/20' },
            { icon: Star, title: 'Reputation System', desc: 'See ratings and trade history. High-rated traders = safer trades.', color: 'from-yellow-500/20 to-orange-500/20' },
            { icon: Zap, title: 'Fast UPI Settlements', desc: 'Most trades complete in under 15 minutes with instant UPI payments.', color: 'from-cyan-500/20 to-emerald-500/20' },
            { icon: Users, title: 'Growing Community', desc: 'Join a community of verified Indian traders. Post offers, find buyers & sellers.', color: 'from-amber-500/20 to-red-500/20' },
          ].map(({ icon: Icon, title, desc, color }, i) => (
            <RevealSection key={title} delay={`delay-${(i % 3 + 1) * 100}`}>
              <div className="card-hover-glow glass rounded-2xl p-6 h-full group cursor-default">
                <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="text-emerald-400" size={24} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 text-center">
        <RevealSection>
          <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-3xl p-14 animate-gradient relative overflow-hidden" style={{ backgroundSize: '200% 200%' }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer"></div>
            <div className="relative z-10">
              <div className="text-6xl mb-6">🛡️</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Start Trading Safely on Telegram</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">One tap to join. No signup forms, no email, no password. Just open the bot and start trading.</p>
              <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="btn-glow bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-12 py-4 rounded-xl text-lg inline-flex items-center gap-3">
                <Send size={20} /> Open SafeP2P Bot <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </RevealSection>
      </div>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        <p>© 2024 SafeP2P India · For educational purposes. Always comply with Indian tax laws on crypto gains.</p>
      </footer>
    </div>
  );
}
