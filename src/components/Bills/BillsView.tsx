import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  Send, 
  XCircle, 
  Eye, 
  Calendar,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import { Bill, User } from '../../types';
import { translations, Language } from '../../translations';

interface BillsViewProps {
  onOpenBill: (bill: Bill) => void;
  user: User | null;
  lang: Language;
}

export const BillsView: React.FC<BillsViewProps> = ({
  onOpenBill,
  user,
  lang
}) => {
  const t = translations[lang];

  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Cancellation Modal
  const [cancelModalBill, setCancelModalBill] = useState<Bill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadBills = async () => {
    try {
      const res = await api.getBills({
        search: search.trim() || undefined,
        filter: filter !== 'custom' ? filter : undefined,
        from_date: filter === 'custom' ? fromDate : undefined,
        to_date: filter === 'custom' ? toDate : undefined,
        limit: 100
      });
      setBills(res.bills || []);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadBills, 250);
    return () => clearTimeout(timer);
  }, [search, filter, fromDate, toDate]);

  useEffect(() => {
    const handleSync = () => loadBills();
    window.addEventListener('smn-realtime-event', handleSync);
    return () => window.removeEventListener('smn-realtime-event', handleSync);
  }, []);

  const handleOpenCancelModal = (bill: Bill) => {
    setCancelModalBill(bill);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBill) return;
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancelling this bill');
      return;
    }

    setCancelling(true);
    try {
      await api.cancelBill(cancelModalBill.id, cancelReason.trim());
      setCancelModalBill(null);
      loadBills();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel bill');
    } finally {
      setCancelling(false);
    }
  };

  const isOwner = user?.role === 'owner';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <History className="w-6 h-6 text-smn-gold" />
            <span>{t.bills}</span>
          </h2>
          <p className="text-xs text-gray-500">
            Search, preview, reprint invoices, resend customer WhatsApp links and track cancellations
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Bill Number (e.g. SMN-000001), Customer Name, or Mobile..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'All Bills' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last_7_days', label: 'Last 7 Days' },
            { id: 'this_month', label: 'This Month' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-smn-maroon text-white font-bold'
                  : 'bg-white text-smn-brown hover:bg-amber-50 border border-smn-beige-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-3.5 pl-6">{t.billNumber}</th>
                <th className="p-3.5">{t.date}</th>
                <th className="p-3.5">{t.customer}</th>
                <th className="p-3.5">{t.mobileNumber}</th>
                <th className="p-3.5 text-right">{t.amount}</th>
                <th className="p-3.5">{t.paymentMethod}</th>
                <th className="p-3.5">WhatsApp Status</th>
                <th className="p-3.5">{t.status}</th>
                <th className="p-3.5 pr-6 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.length > 0 ? (
                bills.map((bill) => {
                  const isCancelled = bill.status === 'cancelled';
                  const waStatus = bill.whatsapp_status || bill.sms_status || 'none';

                  return (
                    <tr
                      key={bill.id}
                      className={`hover:bg-amber-50/40 transition-colors ${isCancelled ? 'bg-gray-50/60 opacity-70' : ''}`}
                    >
                      <td className="p-3.5 pl-6 font-mono font-bold text-smn-maroon">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span>{bill.bill_number}</span>
                          {bill.bill_type === 'wholesale' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto">
                              Wholesale (જથ્થાબંધ)
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                              Retail (છૂટક)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-600">
                        {new Date(bill.created_at).toLocaleDateString('en-IN')}{' '}
                        <span className="text-[11px] text-gray-400">
                          {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-smn-brown">
                        {bill.customer_name_snapshot}
                      </td>
                      <td className="p-3.5 font-mono text-gray-600">
                        {bill.customer_mobile_snapshot ? `+91 ${bill.customer_mobile_snapshot}` : 'Walk-in'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-sm text-smn-maroon">
                        ₹{parseFloat(String(bill.final_amount)).toFixed(2)}
                      </td>
                      <td className="p-3.5 font-bold uppercase text-[11px] text-gray-600">
                        {bill.payment_method}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          waStatus === 'sent' || waStatus === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : waStatus === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {waStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onOpenBill(bill)}
                          title="View & Reprint Invoice"
                          className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-smn-brown transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-smn-maroon" />
                          <span>Invoice</span>
                        </button>

                        {!isCancelled && isOwner && (
                          <button
                            onClick={() => handleOpenCancelModal(bill)}
                            title="Cancel Bill"
                            className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    {loading ? 'Loading bills...' : 'No invoices found matching criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Bill Modal */}
      {cancelModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-rose-300 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm border-b border-gray-100 pb-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>Cancel Invoice {cancelModalBill.bill_number}</span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This invoice will be marked as cancelled and deducted from sales figures. The original transaction snapshot and audit trail will remain recorded.
            </p>

            {cancelError && (
              <div className="p-2 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer returned items / Cashier billing error"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalBill(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

