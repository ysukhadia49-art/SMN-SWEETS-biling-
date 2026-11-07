import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Globe, 
  Wifi, 
  WifiOff, 
  Clock, 
  Calendar as CalendarIcon,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { translations, Language } from '../translations';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  lang: Language;
  onToggleLang: () => void;
  onQuickBill: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  lang,
  onToggleLang,
  onQuickBill
}) => {
  const t = translations[lang];
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString(lang === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <header className="h-16 bg-white border-b border-smn-beige-dark/60 shadow-sm px-6 flex items-center justify-between z-10">
      {/* Left info: Store POS Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-smn-gold animate-pulse"></span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-smn-maroon">
              Sukhadiya Manilal Nathalal (SMN SWEET'S)
            </span>
            <span className="hidden xl:inline text-[11px] text-smn-brown/80 ml-2 font-medium">
              • Est. 1849 • Manek Chowk, Ahmedabad
            </span>
          </div>
        </div>
      </div>

      {/* Middle info: Live Clock & Date */}
      <div className="hidden md:flex items-center gap-5 text-sm text-smn-brown">
        <div className="flex items-center gap-1.5 font-medium">
          <CalendarIcon className="w-4 h-4 text-smn-gold-accent" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1.5 font-semibold font-mono text-smn-maroon">
          <Clock className="w-4 h-4 text-smn-gold-accent" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* Right controls: Quick Bill, Online indicator, Language Switcher, User Badge */}
      <div className="flex items-center gap-3">
        {/* Network status indicator */}
        <div 
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
          title={isOnline ? 'Online (SMS Gateway Active)' : 'Offline (Bills function locally, SMS queued)'}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Language switch */}
        <button
          onClick={onToggleLang}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-smn-beige-dark hover:bg-smn-beige/50 text-xs font-semibold text-smn-brown transition-colors"
          title="Switch Language / ભાષા બદલો"
        >
          <Globe className="w-3.5 h-3.5 text-smn-maroon" />
          <span>{lang === 'en' ? 'ગુજરાતી' : 'English'}</span>
        </button>

        {/* Quick New Bill Button */}
        <button
          onClick={onQuickBill}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md hover:brightness-110 active:scale-95 transition-all"
        >
          <Receipt className="w-3.5 h-3.5 text-smn-gold-light" />
          <span className={lang === 'gu' ? 'font-gujarati' : ''}>{t.newBill}</span>
          <span className="hidden sm:inline bg-black/20 text-[10px] px-1 py-0.2 rounded font-mono">F1</span>
        </button>
      </div>
    </header>
  );
};

