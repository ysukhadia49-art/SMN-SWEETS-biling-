import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Receipt, 
  MessageSquare, 
  Lock, 
  Save, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Globe,
  Shield,
  KeyRound,
  Cloud,
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';
import { api } from '../../services/api';
import { Settings, User, GcpDiagnostics } from '../../types';
import { translations, Language } from '../../translations';

interface SettingsViewProps {
  user: User | null;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  lang,
  onLanguageChange
}) => {
  const t = translations[lang];

  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<'business' | 'invoice' | 'whatsapp' | 'cloud' | 'security'>('business');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WhatsApp Bot Configuration Fields
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappBotUrl, setWhatsappBotUrl] = useState('http://127.0.0.1:3001/api/send');
  const [whatsappBotToken, setWhatsappBotToken] = useState('');
  const [testMobile, setTestMobile] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<any>(null);

  // Google Cloud Diagnostics & Sync
  const [gcpDiagnostics, setGcpDiagnostics] = useState<GcpDiagnostics | null>(null);
  const [syncingGcp, setSyncingGcp] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Form Fields
  const [shopName, setShopName] = useState('');
  const [shopTagline, setShopTagline] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopMobile, setShopMobile] = useState('');
  const [shopWhatsapp, setShopWhatsapp] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [estYear, setEstYear] = useState('1984');
  const [billFooter, setBillFooter] = useState('');
  const [billFooterGujarati, setBillFooterGujarati] = useState('');

  const [billPrefix, setBillPrefix] = useState('SMN-');
  const [defaultPdfFormat, setDefaultPdfFormat] = useState<'format_a' | 'format_b'>('format_a');
  const [receiptWidth, setReceiptWidth] = useState<'58mm' | '80mm'>('80mm');
  const [invoiceBaseUrl, setInvoiceBaseUrl] = useState('http://127.0.0.1:4000');

  // Password Change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const s = await api.getSettings();
        setSettings(s);
        setShopName(s.shop_name || "SMN SWEET'S");
        setShopTagline(s.shop_tagline || 'Traditional Taste & Purity');
        setShopAddress(s.shop_address || 'Opp. Town Hall, Station Road, Ahmedabad, Gujarat');
        setShopMobile(s.shop_mobile || '+91 98250 12345');
        setShopWhatsapp(s.shop_whatsapp || '+91 98250 12345');
        setShopEmail(s.shop_email || 'contact@smnsweets.in');
        setEstYear(s.est_year || '1984');
        setBillFooter(s.bill_footer || "Thank you for shopping at SMN SWEET'S! Visit Again!");
        setBillFooterGujarati(s.bill_footer_gujarati || 'એસએમએન સ્વીટ્સની મુલાકાત બદલ આભાર! ફરી પધારશો!');

        setBillPrefix(s.bill_prefix || 'SMN-');
        setDefaultPdfFormat(s.default_pdf_format || 'format_a');
        setReceiptWidth(s.receipt_width || '80mm');
        setInvoiceBaseUrl(s.invoice_base_url || 'http://127.0.0.1:4000');

        setWhatsappEnabled(s.whatsapp_enabled !== '0');
        setWhatsappBotUrl(s.whatsapp_bot_url || 'http://127.0.0.1:3001/api/send');
        setWhatsappBotToken(s.whatsapp_bot_token || '');

        api.getWhatsAppStatus().then(setBotStatus).catch(() => null);
        api.getGcpDiagnostics().then(setGcpDiagnostics).catch(() => null);
      } catch (e) {
        console.error('Settings load error:', e);
      }
    }
    fetchSettings();
  }, []);

  const handleSyncGcpNow = async () => {
    setSyncingGcp(true);
    setSyncMessage(null);
    try {
      const res = await api.syncGcpNow();
      setSyncMessage(res.message || 'Synchronization batch executed!');
      const diag = await api.getGcpDiagnostics();
      setGcpDiagnostics(diag);
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncingGcp(false);
    }
  };

  const handleSendTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMobile.trim()) return;

    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.sendTestWhatsApp(testMobile.trim());
      if (res.success) {
        setTestResult('Test WhatsApp message delivered successfully to your bot!');
      } else {
        setTestResult(`Bot response: ${res.error || res.message || 'Queued / error'}`);
      }
    } catch (err: any) {
      setTestResult(`Error sending test WhatsApp: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await api.updateSettings({
        shop_name: shopName,
        shop_tagline: shopTagline,
        shop_address: shopAddress,
        shop_mobile: shopMobile,
        shop_whatsapp: shopWhatsapp,
        shop_email: shopEmail,
        est_year: estYear,
        bill_footer: billFooter,
        bill_footer_gujarati: billFooterGujarati,
        bill_prefix: billPrefix,
        default_pdf_format: defaultPdfFormat,
        receipt_width: receiptWidth,
        invoice_base_url: invoiceBaseUrl,
        whatsapp_enabled: whatsappEnabled ? '1' : '0',
        whatsapp_bot_url: whatsappBotUrl,
        whatsapp_bot_token: whatsappBotToken
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }

    try {
      await api.changePassword({ oldPassword, newPassword });
      setPassSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(false), 3000);
    } catch (err: any) {
      setPassError(err.message || 'Failed to change password');
    }
  };

  const isOwner = user?.role === 'owner';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-y-auto">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-smn-gold" />
          <span>{t.settings}</span>
        </h2>
        <p className="text-xs text-gray-500">
          Configure shop branding, invoice formatting, Node.js WhatsApp bot integration, and account access
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-smn-beige-dark gap-2">
        {[
          { id: 'business', label: 'Business Details', icon: Store },
          { id: 'invoice', label: 'Invoice & PDF', icon: Receipt },
          { id: 'whatsapp', label: 'WhatsApp Bot Integration', icon: Bot },
          { id: 'cloud', label: 'Google Cloud Sync', icon: Cloud },
          { id: 'security', label: 'Security & Access', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                isActive
                  ? 'border-smn-maroon text-smn-maroon bg-white/60 rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-smn-brown'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notification Alerts */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Settings saved successfully!</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Form Container */}
      <div className="bg-white rounded-2xl border border-smn-beige-dark shadow-sm p-6">
        {activeTab === 'business' && (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <h3 className="font-bold text-sm text-smn-brown pb-2 border-b border-gray-100">
              Traditional Sweet Shop Branding
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Name *</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-bold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tagline</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={shopTagline}
                  onChange={(e) => setShopTagline(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Shop Address</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Mobile</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={shopMobile}
                  onChange={(e) => setShopMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp Order Number</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={shopWhatsapp}
                  onChange={(e) => setShopWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  disabled={!isOwner}
                  value={shopEmail}
                  onChange={(e) => setShopEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Establishment Year</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={estYear}
                  onChange={(e) => setEstYear(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Footer Note (English)</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Footer Note (Gujarati)</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={billFooterGujarati}
                  onChange={(e) => setBillFooterGujarati(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-gujarati text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
              </div>
            </div>

            {isOwner && (
              <button
                type="submit"
                disabled={saving}
                className="mt-4 px-6 py-2.5 bg-smn-maroon text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-smn-gold-light" />
                <span>{saving ? 'Saving Changes...' : 'Save Business Settings'}</span>
              </button>
            )}
          </form>
        )}

        {activeTab === 'invoice' && (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <h3 className="font-bold text-sm text-smn-brown pb-2 border-b border-gray-100">
              Invoice Prefix, Formats & Hosting
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bill Number Prefix</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={billPrefix}
                  onChange={(e) => setBillPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
                <p className="text-[11px] text-gray-500 mt-1">Example: {billPrefix}000001</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default Invoice Layout</label>
                <select
                  disabled={!isOwner}
                  value={defaultPdfFormat}
                  onChange={(e: any) => setDefaultPdfFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-semibold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                >
                  <option value="format_a">Format A: Premium Customer Invoice (A4 / A5)</option>
                  <option value="format_b">Format B: Compact Thermal Receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Thermal Receipt Width</label>
                <select
                  disabled={!isOwner}
                  value={receiptWidth}
                  onChange={(e: any) => setReceiptWidth(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-semibold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                >
                  <option value="80mm">80mm Paper Width (Standard)</option>
                  <option value="58mm">58mm Paper Width (Compact)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Public Invoice Link Base URL</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={invoiceBaseUrl}
                  onChange={(e) => setInvoiceBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  URL sent in customer WhatsApp message: {invoiceBaseUrl}/invoice/token
                </p>
              </div>
            </div>

            {isOwner && (
              <button
                type="submit"
                disabled={saving}
                className="mt-4 px-6 py-2.5 bg-smn-maroon text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-smn-gold-light" />
                <span>Save Invoice Settings</span>
              </button>
            )}
          </form>
        )}

        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-smn-maroon" />
                  <h3 className="font-bold text-sm text-smn-brown">
                    Node.js WhatsApp Bot Configuration
                  </h3>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-smn-maroon cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner}
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="rounded text-smn-maroon focus:ring-smn-maroon"
                  />
                  <span>Enable Automatic WhatsApp Invoices</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    WhatsApp Bot HTTP Endpoint URL *
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={whatsappBotUrl}
                    onChange={(e) => setWhatsappBotUrl(e.target.value)}
                    placeholder="http://127.0.0.1:3001/api/send"
                    className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Target URL of your running Node.js WhatsApp bot (receives POST with recipient, invoice details, and PDF download link).
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bot Authorization Bearer Token (Optional)
                  </label>
                  <input
                    type="password"
                    disabled={!isOwner}
                    value={whatsappBotToken}
                    onChange={(e) => setWhatsappBotToken(e.target.value)}
                    placeholder="Enter bot authorization token or secret key"
                    className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon disabled:bg-gray-50"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Sent as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> header to prevent unauthorized bot dispatches.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Offline & Reliability Guarantee:</p>
                <p className="text-gray-600">
                  If the WhatsApp bot is temporarily offline or internet connectivity is lost, billing is never blocked. Customer invoices are committed to SQLite, PDFs are generated immediately, and messages are placed in the <code className="font-mono font-bold">whatsapp_queue</code> table for automatic background retry once connectivity is restored.
                </p>
              </div>

              {isOwner && (
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 px-6 py-2.5 bg-smn-maroon text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 flex items-center gap-2"
                >
                  <Save className="w-4 h-4 text-smn-gold-light" />
                  <span>{saving ? 'Saving...' : 'Save WhatsApp Bot Settings'}</span>
                </button>
              )}
            </form>

            {/* Test WhatsApp Bot Dispatch */}
            {isOwner && (
              <div className="pt-4 border-t border-gray-100">
                <h4 className="font-bold text-xs text-smn-brown uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-smn-gold" />
                  <span>Verify Bot Connectivity with a Test Message</span>
                </h4>
                <form onSubmit={handleSendTestWhatsApp} className="flex gap-2">
                  <input
                    type="text"
                    value={testMobile}
                    onChange={(e) => setTestMobile(e.target.value)}
                    placeholder="Enter 10-digit customer mobile number..."
                    className="flex-1 px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono outline-none focus:ring-1 focus:ring-smn-maroon"
                  />
                  <button
                    type="submit"
                    disabled={testSending || !testMobile.trim()}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testSending ? 'Sending...' : 'Send Test WhatsApp'}</span>
                  </button>
                </form>

                {testResult && (
                  <p className="text-xs text-smn-maroon font-semibold mt-2">
                    {testResult}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-sm text-smn-brown">
                  Google Cloud Storage & Real-Time Sync Diagnostics
                </h3>
                <p className="text-xs text-gray-500">
                  Local-first billing resilience with durable Google Cloud outbox synchronization
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncGcpNow}
                disabled={syncingGcp}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-smn-maroon hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingGcp ? 'animate-spin' : ''}`} />
                <span>{syncingGcp ? 'Syncing Outbox...' : 'Sync Outbox Now'}</span>
              </button>
            </div>

            {syncMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-smn-cream rounded-xl border border-smn-beige-dark space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">GCP Project ID</span>
                <span className="font-mono font-bold text-sm text-smn-maroon">
                  {gcpDiagnostics?.projectId || 'smn-sweets-pos'}
                </span>
                <p className="text-[10px] text-gray-400">Isolated tenant configuration</p>
              </div>

              <div className="p-4 bg-smn-cream rounded-xl border border-smn-beige-dark space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Invoice Storage Bucket</span>
                <span className="font-mono font-bold text-sm text-smn-brown truncate block">
                  {gcpDiagnostics?.bucketName || 'smn-sweets-invoices'}
                </span>
                <p className="text-[10px] text-gray-400">gs://.../shops/smn_ahmedabad/invoices</p>
              </div>

              <div className="p-4 bg-smn-cream rounded-xl border border-smn-beige-dark space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Durable Outbox Queue</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-bold text-xl text-smn-maroon">
                    {gcpDiagnostics?.syncOutboxCount || 0}
                  </span>
                  <span className="text-[10px] text-gray-500">pending cloud sync</span>
                </div>
                <p className="text-[10px] text-emerald-700 font-medium">
                  {gcpDiagnostics?.recentSyncedCount || 0} operations acknowledged
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-smn-beige-dark space-y-2 text-xs">
              <h4 className="font-bold text-smn-brown">Offline Resilience Policy</h4>
              <p className="text-gray-600 leading-relaxed">
                Billing operations, weight calculations, PDF creation, and cashier flows are entirely local-first. When an internet connection is disconnected, bills are committed locally with zero blocking and queued into the persistent SQLite <code className="font-mono font-bold">sync_outbox</code>. When connectivity is restored, operations upload automatically without cashier intervention.
              </p>
              <div className="pt-2 text-[11px] text-gray-400 font-mono">
                Last Sync Diagnostics Checked: {gcpDiagnostics?.lastSyncCheck ? new Date(gcpDiagnostics.lastSyncCheck).toLocaleString('en-IN') : 'Just now'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <h3 className="font-bold text-sm text-smn-brown pb-2 border-b border-gray-100 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-smn-maroon" />
                <span>Change Your Password</span>
              </h3>

              {passSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200">
                  Password changed successfully!
                </div>
              )}
              {passError && (
                <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200">
                  {passError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-smn-maroon text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
