import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCw, 
  ExternalLink,
  WifiOff,
  Sparkles,
  Archive
} from 'lucide-react';
import { api } from '../../services/api';
import { WhatsAppRecord, User } from '../../types';
import { translations, Language } from '../../translations';

interface WhatsAppHistoryViewProps {
  user: User | null;
  lang: Language;
}

export const WhatsAppHistoryView: React.FC<WhatsAppHistoryViewProps> = ({ user, lang }) => {
  const t = translations[lang];

  const [records, setRecords] = useState<WhatsAppRecord[]>([]);
  const [queuePendingCount, setQueuePendingCount] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Tab: Active WhatsApp vs Historical SMS Archive
  const [viewMode, setViewMode] = useState<'whatsapp' | 'sms_archive'>('whatsapp');
  const [smsArchiveRecords, setSmsArchiveRecords] = useState<any[]>([]);

  // Test WhatsApp State
  const [testMobile, setTestMobile] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'whatsapp') {
        const res = await api.getWhatsAppLogs({ search: search.trim() || undefined, limit: 100 });
        setRecords(res.records || []);
        setQueuePendingCount(res.queuePendingCount || 0);
      } else {
        const res = await api.getSmsArchive({ search: search.trim() || undefined, limit: 100 });
        setSmsArchiveRecords(res.records || []);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [search, viewMode]);

  const handleSendTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMobile.trim()) return;

    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.sendTestWhatsApp(testMobile.trim());
      if (res.success) {
        setTestResult('Test WhatsApp message delivered successfully to WhatsApp bot!');
      } else {
        setTestResult(`WhatsApp Bot Notice: ${res.error || res.message || 'Queued or error'}`);
      }
      loadData();
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleResend = async (record: WhatsAppRecord) => {
    if (!record.bill_id) return;
    try {
      await api.sendBillWhatsApp(record.bill_id);
      loadData();
    } catch (e: any) {
      alert('Resend failed: ' + e.message);
    }
  };

  const isOwner = user?.role === 'owner';

  const filteredRecords = records.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-smn-gold" />
            <span>{t.whatsappHistory}</span>
          </h2>
          <p className="text-xs text-gray-500">
            Node.js WhatsApp bot dispatch logs, customer invoice delivery records, and offline queue status
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="bg-white border border-smn-beige-dark rounded-xl p-0.5 flex text-xs">
            <button
              onClick={() => setViewMode('whatsapp')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'whatsapp'
                  ? 'bg-smn-maroon text-white shadow-sm'
                  : 'text-gray-500 hover:text-smn-brown'
              }`}
            >
              WhatsApp Logs
            </button>
            <button
              onClick={() => setViewMode('sms_archive')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                viewMode === 'sms_archive'
                  ? 'bg-smn-maroon text-white shadow-sm'
                  : 'text-gray-500 hover:text-smn-brown'
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>SMS Archive</span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-smn-beige-dark hover:bg-gray-50 rounded-xl text-xs font-semibold text-smn-brown transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-smn-maroon" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Offline Queue Notice if messages are waiting */}
      {viewMode === 'whatsapp' && queuePendingCount > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <div>
              <span className="font-bold">{queuePendingCount} WhatsApp messages currently queued in offline persistence table.</span>
              <p className="text-[11px] text-amber-800">
                The background worker will automatically dispatch these messages as soon as connectivity to your Node.js WhatsApp bot restores.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg font-bold font-mono text-[11px]">
            QUEUED
          </span>
        </div>
      )}

      {/* Test WhatsApp Card for Owner */}
      {isOwner && viewMode === 'whatsapp' && (
        <div className="p-4 bg-white rounded-2xl border border-smn-beige-dark shadow-sm">
          <form onSubmit={handleSendTestWhatsApp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Sparkles className="w-4 h-4 text-smn-gold flex-shrink-0" />
              <span className="text-xs font-bold text-smn-brown whitespace-nowrap">Test WhatsApp Bot:</span>
              <input
                type="text"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
                placeholder="Enter 10-digit mobile number to verify WhatsApp bot sending..."
                className="flex-1 px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
              />
            </div>
            <button
              type="submit"
              disabled={testSending || !testMobile.trim()}
              className="px-4 py-2 bg-gradient-to-r from-smn-maroon to-smn-red text-white text-xs font-bold rounded-xl shadow-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-smn-gold-light" />
              <span>{testSending ? 'Sending via Bot...' : 'Send Test WhatsApp'}</span>
            </button>
          </form>

          {testResult && (
            <p className="text-xs text-smn-maroon font-semibold mt-2 pl-6">
              {testResult}
            </p>
          )}
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              viewMode === 'whatsapp'
                ? "Search logs by Mobile number, Bill number, or Customer name..."
                : "Search historical SMS archive..."
            }
            className="w-full pl-10 pr-4 py-2 bg-white border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
          />
        </div>

        {viewMode === 'whatsapp' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Logs' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'sent', label: 'Sent' },
              { id: 'queued', label: 'Queued' },
              { id: 'failed', label: 'Failed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === f.id
                    ? 'bg-smn-maroon text-white font-bold'
                    : 'bg-white text-smn-brown hover:bg-amber-50 border border-smn-beige-dark'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          {viewMode === 'whatsapp' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3 pl-6">Bill No</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Recipient Mobile</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Delivery Status</th>
                  <th className="p-3">Bot Message ID</th>
                  <th className="p-3">Message Preview / Details</th>
                  <th className="p-3 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((rec) => {
                    const isSuccess = rec.status === 'sent' || rec.status === 'delivered';
                    const isFailed = rec.status === 'failed';

                    return (
                      <tr key={rec.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-3 pl-6 font-mono font-bold text-smn-maroon">
                          {rec.bill_number || `Bill #${rec.bill_id}`}
                        </td>
                        <td className="p-3 font-semibold text-smn-brown">
                          {rec.customer_name || 'Walk-in'}
                        </td>
                        <td className="p-3 font-mono text-gray-600">
                          +91 {rec.mobile_number}
                        </td>
                        <td className="p-3 text-gray-500 whitespace-nowrap">
                          {new Date(rec.created_at).toLocaleDateString('en-IN')}{' '}
                          <span className="text-[10px] text-gray-400">
                            {new Date(rec.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                            rec.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'sent'
                              ? 'bg-blue-100 text-blue-800'
                              : isFailed
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isFailed && <AlertCircle className="w-3 h-3 text-rose-600" />}
                            {!isSuccess && !isFailed && <Clock className="w-3 h-3 text-amber-600" />}
                            <span>{rec.status}</span>
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-500">
                          {rec.provider_message_id || '—'}
                        </td>
                        <td className="p-3 max-w-xs truncate text-gray-600 text-[11px]">
                          {rec.error_message ? (
                            <span className="text-rose-600 font-mono">{rec.error_message}</span>
                          ) : (
                            <span className="text-gray-500 truncate block font-sans">
                              {rec.message ? rec.message.split('\n')[0] : '—'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-6 text-right whitespace-nowrap">
                          {rec.bill_id && (
                            <button
                              onClick={() => handleResend(rec)}
                              title="Resend this bill's WhatsApp invoice"
                              className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-smn-brown transition-colors inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3 text-emerald-600" />
                              <span>Resend</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      {loading ? 'Loading WhatsApp delivery logs...' : 'No WhatsApp logs found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Historical SMS Archive Table (Preserved safely) */
            <table className="w-full text-left text-xs">
              <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3 pl-6">Archive ID</th>
                  <th className="p-3">Bill No</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Recipient Mobile</th>
                  <th className="p-3">Legacy Gateway</th>
                  <th className="p-3">Sent Timestamp</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-6">Archive Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {smsArchiveRecords.length > 0 ? (
                  smsArchiveRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors opacity-80">
                      <td className="p-3 pl-6 font-mono text-gray-400">#{rec.id}</td>
                      <td className="p-3 font-mono font-bold text-gray-700">{rec.bill_number || `Bill #${rec.bill_id}`}</td>
                      <td className="p-3 font-semibold text-gray-700">{rec.customer_name || 'Walk-in'}</td>
                      <td className="p-3 font-mono text-gray-600">+91 {rec.mobile_number}</td>
                      <td className="p-3 uppercase font-mono text-[10px] text-gray-500">{rec.provider}</td>
                      <td className="p-3 text-gray-500">{new Date(rec.created_at).toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-3 pr-6 font-mono text-[10px] text-gray-400 truncate max-w-xs">
                        {rec.error_message || rec.message?.split('\n')[0] || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      {loading ? 'Loading historical archive...' : 'No historical SMS records in archive.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

