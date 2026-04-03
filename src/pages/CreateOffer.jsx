import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CRYPTOS, PAYMENT_METHODS } from '../data/mockData';

export default function CreateOffer() {
  const { addOffer } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: 'sell',
    crypto: 'USDT',
    amount: '',
    rate: '',
    minLimit: '',
    maxLimit: '',
    paymentMethods: ['UPI'],
    completionTime: 15,
  });
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function togglePayment(m) {
    setForm(f => ({
      ...f,
      paymentMethods: f.paymentMethods.includes(m)
        ? f.paymentMethods.filter(x => x !== m)
        : [...f.paymentMethods, m],
    }));
  }

  function handleSubmit() {
    const offerId = addOffer({
      ...form,
      amount: parseFloat(form.amount),
      rate: parseFloat(form.rate),
      minLimit: parseFloat(form.minLimit),
      maxLimit: parseFloat(form.maxLimit),
    });
    setSubmitted(true);
    setTimeout(() => navigate('/market'), 2000);
  }

  const valid1 = form.type && form.crypto && form.amount && form.rate;
  const valid2 = form.minLimit && form.maxLimit && form.paymentMethods.length > 0;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-emerald-400" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Offer Posted!</h2>
        <p className="text-gray-400">Your offer is live on the marketplace. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Post an Offer</h1>
        <p className="text-gray-400">List your buy or sell offer on the marketplace</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'}`}>
              {s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 w-16 ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`}></div>}
          </div>
        ))}
        <div className="ml-4 text-gray-400 text-sm">
          {step === 1 ? 'Offer Details' : step === 2 ? 'Payment & Limits' : 'Safety Review'}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">I want to</label>
              <div className="flex gap-3">
                {['sell', 'buy'].map(t => (
                  <button
                    key={t}
                    onClick={() => set('type', t)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all capitalize ${form.type === t ? (t === 'sell' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-blue-500/20 border-blue-500 text-blue-400') : 'border-white/10 text-gray-400 hover:border-white/30'}`}
                  >
                    {t === 'sell' ? '🟢 Sell Crypto' : '🔵 Buy Crypto'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Cryptocurrency</label>
                <select value={form.crypto} onChange={e => set('crypto', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  {CRYPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Amount ({form.crypto})</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Rate (₹ per {form.crypto})</label>
              <input
                type="number"
                value={form.rate}
                onChange={e => set('rate', e.target.value)}
                placeholder="e.g. 87.5 for USDT"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder-gray-600"
              />
              {form.amount && form.rate && (
                <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                  <Info size={12} /> Total offer value: ₹{(parseFloat(form.amount) * parseFloat(form.rate)).toLocaleString()}
                </p>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!valid1}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Min Limit (₹)</label>
                <input type="number" value={form.minLimit} onChange={e => set('minLimit', e.target.value)} placeholder="500" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Max Limit (₹)</label>
                <input type="number" value={form.maxLimit} onChange={e => set('maxLimit', e.target.value)} placeholder="50000" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder-gray-600" />
              </div>
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-3 block">Accepted Payment Methods</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => togglePayment(m)}
                    className={`px-4 py-2 rounded-xl text-sm border transition-colors ${form.paymentMethods.includes(m) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Trade completion time</label>
              <select value={form.completionTime} onChange={e => set('completionTime', parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                {[10, 15, 20, 30, 45, 60].map(t => <option key={t} value={t}>{t} minutes</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-400 py-3 rounded-xl hover:border-white/30 transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={!valid2} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-white font-semibold text-lg">Review Your Offer</h3>

            <div className="bg-black/30 rounded-xl p-4 space-y-3">
              {[
                ['Type', form.type === 'sell' ? '🟢 Selling Crypto' : '🔵 Buying Crypto'],
                ['Crypto', form.crypto],
                ['Amount', `${form.amount} ${form.crypto}`],
                ['Rate', `₹${parseFloat(form.rate).toLocaleString()} per ${form.crypto}`],
                ['Limits', `₹${parseFloat(form.minLimit).toLocaleString()} – ₹${parseFloat(form.maxLimit).toLocaleString()}`],
                ['Payments', form.paymentMethods.join(', ')],
                ['Time limit', `${form.completionTime} minutes`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={16} />
                <div className="text-sm text-amber-200">
                  <strong>Safety reminder:</strong> Keep individual trades under ₹50,000. Do not mention "crypto" in bank transfer remarks. Stay compliant with Indian tax regulations.
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-white/10 text-gray-400 py-3 rounded-xl hover:border-white/30 transition-colors">Back</button>
              <button onClick={handleSubmit} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors">Post Offer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
