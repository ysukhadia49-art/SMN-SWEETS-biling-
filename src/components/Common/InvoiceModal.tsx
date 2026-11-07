import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Send, 
  Copy, 
  Check, 
  FileText,
  AlertCircle,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { Bill } from '../../types';
import { translations, Language } from '../../translations';

interface InvoiceModalProps {
  bill: Bill | null;
  onClose: () => void;
  onSendWhatsApp?: (billId: number) => Promise<void>;
  onResendSMS?: (billId: number) => Promise<void>;
  lang: Language;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bill,
  onClose,
  onSendWhatsApp,
  onResendSMS,
  lang
}) => {
  const t = translations[lang];
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  if (!bill) return null;

  const invoiceUrl = `http://127.0.0.1:4000/invoice/${bill.invoice_token}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.open(`http://127.0.0.1:4000/invoice/${bill.invoice_token}`, '_blank');
  };

  const handleDownload = () => {
    const downloadUrl = `http://127.0.0.1:4000/api/bills/${bill.id}/pdf`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${bill.bill_number}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenWhatsAppWeb = () => {
    const rawMobile = bill.customer_mobile_snapshot || '';
    const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10) {
      alert('Valid 10-digit mobile number required to send via WhatsApp Web');
      return;
    }
    const message = `✨ *Sukhadiya Manilal Nathalal (SMN SWEET'S) — Retail Invoice* ✨\n\nDear *${bill.customer_name_snapshot || 'Valued Customer'}*,\nThank you for visiting! Your bill #${bill.bill_number} for ₹${parseFloat(String(bill.final_amount)).toFixed(2)} is ready.\n\n📄 Download Invoice PDF:\n${invoiceUrl}\n\n*SMN SWEET'S Ahmedabad*\nContact: +91 8238773681\n_Visit again!_`;
    const waLink = `https://web.whatsapp.com/send?phone=91${cleanMobile}&text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  const triggerResend = async () => {
    setResending(true);
    setResendStatus(null);
    try {
      if (onSendWhatsApp) {
        await onSendWhatsApp(bill.id);
      } else if (onResendSMS) {
        await onResendSMS(bill.id);
      }
      setResendStatus('WhatsApp invoice dispatched successfully to customer!');
    } catch (e: any) {
      setResendStatus(`Failed to send WhatsApp invoice: ${e.message}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-smn-gold/30 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-smn-maroon text-white p-4 px-6 flex items-center justify-between border-b-2 border-smn-gold">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-smn-gold-light" />
            <div>
              <h3 className="font-serif font-bold text-lg text-smn-gold-soft leading-tight">
                {t.invoicePreview} — {bill.bill_number}
              </h3>
              <p className="text-xs text-amber-200">
                {new Date(bill.created_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Body (Format A preview) */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto bg-smn-cream">
          {/* Shop Header Banner */}
          <div className="bg-gradient-to-r from-smn-maroon via-smn-maroon-dark to-smn-maroon text-white p-4 rounded-xl shadow-sm border border-smn-gold/30 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img 
                src="/assets/smn-logo.png" 
                alt="SMN" 
                className="w-12 h-12 rounded-lg bg-white/10 p-1 object-contain"
                onError={(e: any) => { e.target.style.display = 'none'; }}
              />
              <div>
                <h2 className="font-serif font-bold text-xl text-smn-gold-soft">SMN SWEET'S</h2>
                <p className="text-xs text-amber-200 font-gujarati">શુદ્ધતા અને સ્વાદની પરંપરા</p>
                <p className="text-[11px] text-gray-300">Ahmedabad, Gujarat</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400 text-smn-brown">
                Retail Invoice
              </span>
              <p className="text-sm font-bold mt-1 text-white">{bill.bill_number}</p>
            </div>
          </div>

          {/* Customer & Cashier Info */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-white rounded-xl border border-smn-beige-dark text-xs">
            <div>
              <span className="text-gray-400 font-semibold uppercase text-[10px] block">Customer Details</span>
              <p className="font-bold text-smn-brown text-sm">{bill.customer_name_snapshot}</p>
              <p className="text-gray-600">
                {bill.customer_mobile_snapshot ? `+91 ${bill.customer_mobile_snapshot}` : 'Walk-in (No WhatsApp)'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-gray-400 font-semibold uppercase text-[10px] block">Payment Info</span>
              <p className="font-bold uppercase text-emerald-700">{bill.payment_method} • {bill.payment_status}</p>
              <p className="text-gray-500">Cashier: {bill.cashier_name}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-smn-beige-dark overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-smn-maroon text-white font-semibold">
                <tr>
                  <th className="p-2.5 pl-3">#</th>
                  <th className="p-2.5">Sweet Item</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(bill.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/40">
                    <td className="p-2.5 pl-3 text-gray-400">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-smn-brown">
                      {item.product_name_snapshot}
                      {item.gujarati_name_snapshot && (
                        <span className="text-gray-500 font-gujarati ml-1.5">({item.gujarati_name_snapshot})</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {item.unit === 'kg' && item.quantity < 1 ? `${Math.round(item.quantity * 1000)}g` : `${item.quantity} ${item.unit}`}
                    </td>
                    <td className="p-2.5 text-right text-gray-600 font-mono">
                      ₹{parseFloat(String(item.unit_price)).toFixed(2)}
                    </td>
                    <td className="p-2.5 pr-3 text-right font-bold font-mono text-smn-maroon">
                      ₹{parseFloat(String(item.line_total)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-white p-4 rounded-xl border border-smn-beige-dark space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">₹{parseFloat(String(bill.subtotal)).toFixed(2)}</span>
            </div>
            {bill.discount_amount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-medium">- ₹{parseFloat(String(bill.discount_amount)).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-smn-maroon pt-2 border-t border-dashed border-gray-200">
              <span>Net Total Amount:</span>
              <span className="font-mono">₹{parseFloat(String(bill.final_amount)).toFixed(2)}</span>
            </div>
          </div>

          {/* Resend Status notification if any */}
          {resendStatus && (
            <div className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
              resendStatus.includes('successfully') 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 flex-shrink-0 ${resendStatus.includes('successfully') ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>{resendStatus}</span>
              </div>
              {bill.customer_mobile_snapshot && !resendStatus.includes('successfully') && (
                <button
                  onClick={handleOpenWhatsAppWeb}
                  className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Send via WhatsApp Web</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-smn-beige/50 border-t border-smn-beige-dark flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium shadow-sm transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : t.copyLink}</span>
            </button>

            {bill.customer_mobile_snapshot && (
              <>
                <button
                  onClick={triggerResend}
                  disabled={resending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  title="Send automatically via Node.js WhatsApp Bot"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{resending ? 'Sending...' : (t.sendWhatsApp || 'Send WhatsApp Invoice')}</span>
                </button>

                <button
                  onClick={handleOpenWhatsAppWeb}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  title="Open directly in WhatsApp Web or WhatsApp Desktop"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                  <span>Open in WhatsApp</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>{t.downloadPdf}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white rounded-lg text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-smn-gold-light" />
              <span>{t.reprint} (F5)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

