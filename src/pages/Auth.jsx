import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/market');
      } else {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        await signUp(email, password, name.trim());
        setSuccess('Account created! Check your email to verify, then login.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #0c1220 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <ShieldCheck className="text-emerald-400" size={36} />
          <span className="text-2xl font-bold text-white">SafeP2P <span className="text-emerald-400 text-sm font-normal">India</span></span>
        </Link>

        {/* Card */}
        <div className="animate-scale-in glass rounded-2xl p-8">
          {/* Tab */}
          <div className="flex bg-black/40 rounded-xl p-1 mb-8">
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${mode === m ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Full Name</label>
                <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500/50 transition-colors">
                  <User size={16} className="text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ravi Kumar"
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">Email</label>
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500/50 transition-colors">
                <Mail size={16} className="text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">Password</label>
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500/50 transition-colors">
                <Lock size={16} className="text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm">
                <ShieldCheck size={14} /> {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-glow bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  {mode === 'login' ? 'Login' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-500 text-xs">
            {mode === 'login' ? (
              <p>New here? <button onClick={() => setMode('signup')} className="text-emerald-400 hover:text-emerald-300">Create an account</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setMode('login')} className="text-emerald-400 hover:text-emerald-300">Login</button></p>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          By signing up you agree to comply with Indian tax regulations on crypto gains.
        </p>
      </div>
    </div>
  );
}
