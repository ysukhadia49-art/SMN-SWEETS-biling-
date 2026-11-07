import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Package, 
  History, 
  MessageSquare, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Database, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { translations, Language } from '../translations';
import { User } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  lang: Language;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  lang
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'billing', label: t.newBill, icon: Receipt, badge: 'F1', highlight: true },
    { id: 'customers', label: t.customers, icon: Users, badge: 'F7' },
    { id: 'products', label: t.products, icon: Package },
    { id: 'bills', label: t.bills, icon: History },
    { id: 'whatsapp', label: t.whatsappHistory, icon: MessageSquare },
    { id: 'reports', label: t.dailySales, icon: TrendingUp },
    { id: 'settings', label: t.settings, icon: SettingsIcon },
    { id: 'backup', label: t.backup, icon: Database },
  ];

  return (
    <aside className="w-64 bg-smn-maroon-dark text-white flex flex-col justify-between shadow-2xl z-20 border-r border-smn-maroon/40 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-smn-maroon/60 flex items-center gap-3 bg-gradient-to-r from-smn-maroon-dark via-smn-maroon to-smn-maroon-dark">
          <img 
            src="/assets/smn-logo.png" 
            alt="SMN Sweets Logo" 
            className="w-11 h-11 object-contain rounded-lg border border-smn-gold/40 shadow-md bg-white/5 p-0.5"
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h1 className="font-serif font-bold text-lg tracking-wide text-smn-gold-soft leading-tight">
              SMN SWEET'S
            </h1>
            <p className="text-[10px] text-amber-100 font-medium">
              Sukhadiya Manilal Nathalal
            </p>
            <p className="text-[10px] text-amber-200/80 font-gujarati tracking-wider">
              {lang === 'gu' ? 'સ્થાપના: ૧૮૪૯ • શુદ્ધ ઘીની મીઠાઈઓ' : 'Since 1849 • Pure Ghee Sweets'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-smn-red to-smn-maroon-light text-white shadow-lg border-l-4 border-smn-gold shadow-smn-maroon/50 font-semibold'
                    : 'text-amber-100/80 hover:bg-white/10 hover:text-white'
                } ${item.highlight && !isActive ? 'ring-1 ring-smn-gold/40 text-amber-200' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-smn-gold-light' : 'text-amber-300/70'}`} />
                  <span className={lang === 'gu' ? 'font-gujarati' : ''}>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-smn-gold text-smn-brown font-bold' : 'bg-black/30 text-amber-200/70'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout footer */}
      <div className="p-3 border-t border-smn-maroon/60 bg-black/20">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 mb-2">
          <div className="truncate">
            <p className="text-xs font-semibold text-white truncate">
              {user?.full_name || user?.username}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-smn-gold-light tracking-wider">
              <Sparkles className="w-2.5 h-2.5" />
              {user?.role === 'owner' ? t.roleOwner : t.roleCashier}
            </span>
          </div>
          <button
            onClick={onLogout}
            title={t.logout}
            className="p-1.5 text-amber-200 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-amber-200/50">
          SMN SWEET'S BILLING SOFTWARE • v1.0.0
        </p>
      </div>
    </aside>
  );
};

