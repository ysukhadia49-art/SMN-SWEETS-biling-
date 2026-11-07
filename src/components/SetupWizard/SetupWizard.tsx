import React, { useState } from 'react';
import { Sparkles, Store, Phone, MapPin, Receipt, MessageSquare, ArrowRight, Check } from 'lucide-react';
import { api } from '../../services/api';
import { Settings } from '../../types';
import { Language } from '../../translations';

interface SetupWizardProps {
  onComplete: () => void;
  lang: Language;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, lang }) => {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState("SMN SWEET'S");
  const [address, setAddress] = useState("Opp. Town Hall, Station Road, Ahmedabad, Gujarat - 380001");
  const [mobile, setMobile] = useState("+91 98250 12345");
  const [estYear, setEstYear] = useState("1984");
  const [billPrefix, setBillPrefix] = useState("SMN-");
  const [whatsappBotUrl, setWhatsappBotUrl] = useState("http://127.0.0.1:3001/api/send");
  const [whatsappBotToken, setWhatsappBotToken] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        shop_name: shopName,
        shop_address: address,
        shop_mobile: mobile,
        est_year: estYear,
        bill_prefix: billPrefix,
        whatsapp_enabled: '1',
        whatsapp_bot_url: whatsappBotUrl,
        whatsapp_bot_token: whatsappBotToken,
        setup_completed: '1'
      });
      onComplete();
    } catch (e) {
      console.error('Setup save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-smn-gold/40 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Wizard Header */}
        <div className="bg-gradient-to-r from-smn-maroon via-smn-maroon-dark to-smn-maroon text-white p-6 border-b-2 border-smn-gold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-smn-gold/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-smn-gold-light" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-smn-gold-soft">Welcome to SMN SWEET'S</h2>
              <p className="text-xs text-amber-200">First-Time Setup & Configuration Wizard</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-white/10 px-2.5 py-1 rounded-full text-amber-200 border border-white/10">
            Step {step} of 3
          </span>
        </div>

        {/* Wizard Steps Content */}
        <div className="p-8 bg-smn-cream space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-bold text-sm text-smn-brown flex items-center gap-2">
                <Store className="w-4 h-4 text-smn-maroon" />
                <span>Shop Identity & Business Details</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm font-semibold text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Mobile / Contact</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Establishment Year</label>
                  <input
                    type="text"
                    value={estYear}
                    onChange={(e) => setEstYear(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-bold text-sm text-smn-brown flex items-center gap-2">
                <Receipt className="w-4 h-4 text-smn-maroon" />
                <span>Invoice Formatting & Pricing</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bill Number Prefix</label>
                <input
                  type="text"
                  value={billPrefix}
                  onChange={(e) => setBillPrefix(e.target.value)}
                  placeholder="e.g. SMN-"
                  className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm font-mono font-bold text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Invoices will automatically generate as: <span className="font-mono font-bold text-smn-maroon">{billPrefix}000001</span>
                </p>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">✓ Standard Retail Pricing Enforced</p>
                <p className="text-gray-600">
                  All sweet products display final selling prices calculated directly by weight or unit.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-bold text-sm text-smn-brown flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-smn-maroon" />
                <span>Node.js WhatsApp Bot (Optional / Can Configure Later)</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp Bot API URL</label>
                <input
                  type="text"
                  value={whatsappBotUrl}
                  onChange={(e) => setWhatsappBotUrl(e.target.value)}
                  placeholder="http://127.0.0.1:3001/api/send"
                  className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm font-mono text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bot Auth Bearer Token (Optional)</label>
                <input
                  type="password"
                  value={whatsappBotToken}
                  onChange={(e) => setWhatsappBotToken(e.target.value)}
                  placeholder="Enter bot authorization token or leave empty"
                  className="w-full px-3.5 py-2 bg-white border border-smn-beige-dark rounded-xl text-sm font-mono text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  You can finish setup now. Offline billing, calculations, and PDF generation work seamlessly even without an active bot.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 px-8 bg-smn-beige/50 border-t border-smn-beige-dark flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white"
            >
              Back
            </button>
          ) : <div></div>}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 bg-smn-maroon text-white rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white rounded-xl text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-smn-gold-light" />
              <span>{saving ? 'Saving...' : 'Finish Setup & Start Billing'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

