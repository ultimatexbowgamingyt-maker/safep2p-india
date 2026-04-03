export const CRYPTOS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];
export const PAYMENT_METHODS = ['UPI', 'IMPS', 'NEFT', 'Bank Transfer', 'PhonePe', 'GPay', 'Paytm'];

export const mockUsers = {
  u1: { id: 'u1', name: 'Ravi Kumar', avatar: 'RK', trades: 342, rating: 4.9, kycVerified: true, joined: 'Jan 2022', online: true },
  u2: { id: 'u2', name: 'Priya Sharma', avatar: 'PS', trades: 178, rating: 4.7, kycVerified: true, joined: 'Mar 2022', online: false },
  u3: { id: 'u3', name: 'Amit Singh', avatar: 'AS', trades: 89, rating: 4.5, kycVerified: true, joined: 'Aug 2022', online: true },
  u4: { id: 'u4', name: 'Neha Patel', avatar: 'NP', trades: 512, rating: 5.0, kycVerified: true, joined: 'Nov 2021', online: true },
  u5: { id: 'u5', name: 'Karan Mehta', avatar: 'KM', trades: 23, rating: 4.2, kycVerified: false, joined: 'Dec 2023', online: false },
  me: { id: 'me', name: 'You', avatar: 'YO', trades: 7, rating: 4.8, kycVerified: true, joined: 'Feb 2024', online: true },
};

export const mockOffers = [
  { id: 'o1', type: 'sell', crypto: 'USDT', amount: 50000, minLimit: 1000, maxLimit: 50000, rate: 87.2, currency: 'INR', paymentMethods: ['UPI', 'IMPS'], sellerId: 'u1', completionTime: 15, safetyScore: 98 },
  { id: 'o2', type: 'buy', crypto: 'BTC', amount: 2.5, minLimit: 5000, maxLimit: 200000, rate: 6850000, currency: 'INR', paymentMethods: ['Bank Transfer', 'NEFT'], sellerId: 'u2', completionTime: 30, safetyScore: 95 },
  { id: 'o3', type: 'sell', crypto: 'ETH', amount: 10, minLimit: 2000, maxLimit: 80000, rate: 245000, currency: 'INR', paymentMethods: ['UPI', 'PhonePe', 'GPay'], sellerId: 'u3', completionTime: 20, safetyScore: 92 },
  { id: 'o4', type: 'sell', crypto: 'USDT', amount: 200000, minLimit: 5000, maxLimit: 200000, rate: 86.9, currency: 'INR', paymentMethods: ['UPI', 'IMPS', 'Bank Transfer'], sellerId: 'u4', completionTime: 10, safetyScore: 99 },
  { id: 'o5', type: 'buy', crypto: 'USDT', amount: 30000, minLimit: 500, maxLimit: 30000, rate: 86.5, currency: 'INR', paymentMethods: ['UPI', 'Paytm'], sellerId: 'u5', completionTime: 25, safetyScore: 78 },
  { id: 'o6', type: 'sell', crypto: 'BNB', amount: 50, minLimit: 1000, maxLimit: 50000, rate: 55200, currency: 'INR', paymentMethods: ['UPI', 'IMPS'], sellerId: 'u1', completionTime: 15, safetyScore: 97 },
  { id: 'o7', type: 'buy', crypto: 'SOL', amount: 100, minLimit: 2000, maxLimit: 100000, rate: 13800, currency: 'INR', paymentMethods: ['UPI', 'GPay'], sellerId: 'u2', completionTime: 20, safetyScore: 94 },
];

export const mockTrades = [
  { id: 't1', offerId: 'o1', buyerId: 'me', sellerId: 'u1', crypto: 'USDT', cryptoAmount: 500, inrAmount: 43600, status: 'completed', createdAt: '2024-03-10', paymentMethod: 'UPI' },
  { id: 't2', offerId: 'o3', buyerId: 'u3', sellerId: 'me', crypto: 'ETH', cryptoAmount: 0.1, inrAmount: 24500, status: 'completed', createdAt: '2024-03-15', paymentMethod: 'UPI' },
  { id: 't3', offerId: 'o4', buyerId: 'me', sellerId: 'u4', crypto: 'USDT', cryptoAmount: 1000, inrAmount: 86900, status: 'escrow', createdAt: '2024-03-20', paymentMethod: 'IMPS' },
];

export const safetyTips = [
  { icon: '🔒', title: 'Small amounts only', desc: 'Keep individual trades under ₹50,000 to reduce bank scrutiny.' },
  { icon: '💬', title: 'Don\'t mention crypto', desc: 'In bank transfer remarks, use neutral descriptions like "personal transfer".' },
  { icon: '⏱️', title: 'Space out trades', desc: 'Avoid multiple large transfers in the same day or week.' },
  { icon: '✅', title: 'Trade with verified users', desc: 'Only trade with KYC-verified, high-reputation traders.' },
  { icon: '📋', title: 'Keep records', desc: 'Save trade history and receipts in case of bank inquiry.' },
  { icon: '🏦', title: 'Use UPI for small trades', desc: 'UPI is safer than NEFT for smaller amounts — less bank scrutiny.' },
];
