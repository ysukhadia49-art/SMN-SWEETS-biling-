import React, { useState } from 'react';
import { Lock, User as UserIcon, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import { translations, Language } from '../../translations';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
  lang: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, lang }) => {
  const t = translations[lang];
  const [username, setUsername] = useState(localStorage.getItem('smn_remember_user') || 'owner');
  const [password, setPassword] = useState('smn@123');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ username, password });
      if (rememberMe) {
        localStorage.setItem('smn_remember_user', username);
      } else {
        localStorage.removeItem('smn_remember_user');
      }
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-smn-maroon-dark via-smn-maroon to-black p-4 select-none">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-smn-gold/40 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Brand Banner */}
        <div className="bg-gradient-to-b from-smn-maroon via-smn-maroon-dark to-smn-maroon text-white p-8 text-center relative overflow-hidden border-b-4 border-smn-gold">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-smn-gold/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <img 
            src="/assets/smn-logo.png" 
            alt="SMN Sweets" 
            className="w-16 h-16 mx-auto mb-3 object-contain rounded-xl shadow-lg border border-smn-gold/50 bg-white/10 p-1"
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
          <h2 className="font-serif font-bold text-2xl text-smn-gold-soft tracking-wide">
            SMN SWEET'S
          </h2>
          <p className="text-sm font-serif text-amber-100 font-semibold mt-0.5">
            Sukhadiya Manilal Nathalal
          </p>
          <p className="text-xs text-amber-200/90 font-gujarati mt-0.5">
            Since 1849 • શુદ્ધ ઘી ની મીઠાઈઓ અને કાજુની આઈટમ
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 bg-smn-cream">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-smn-brown uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-smn-beige-dark rounded-xl text-sm font-medium text-smn-brown focus:ring-2 focus:ring-smn-maroon focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-smn-brown uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-smn-beige-dark rounded-xl text-sm font-medium text-smn-brown focus:ring-2 focus:ring-smn-maroon focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-smn-maroon focus:ring-smn-maroon"
              />
              <span>Remember username</span>
            </label>
            <span className="text-[11px] text-gray-400 font-mono">Role: Owner / Cashier</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-smn-maroon to-smn-red text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Shield className="w-4 h-4 text-smn-gold-light" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Billing'}</span>
          </button>

          <div className="pt-2 text-center text-xs text-gray-500">
            <p>Default credentials: <span className="font-mono text-smn-maroon font-bold">owner / smn@123</span></p>
            <p className="mt-0.5">Cashier: <span className="font-mono text-smn-maroon font-bold">cashier / cashier@123</span></p>
          </div>
        </form>
      </div>
    </div>
  );
};

