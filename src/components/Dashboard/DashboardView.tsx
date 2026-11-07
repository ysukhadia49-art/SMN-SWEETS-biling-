import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  Receipt, 
  Users, 
  Send, 
  AlertCircle, 
  Package, 
  TrendingUp, 
  PlusCircle, 
  Clock, 
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Printer
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats, Bill } from '../../types';
import { translations, Language } from '../../translations';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenBill: (bill: Bill) => void;
  lang: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenBill,
  lang
}) => {
  const t = translations[lang];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [statsData, chartsData, billsData] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardCharts(),
        api.getBills({ limit: 6, filter: 'today' })
      ]);
      setStats(statsData);
      setCharts(chartsData);
      setRecentBills(billsData.bills || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleSync = () => loadDashboardData();
    window.addEventListener('smn-realtime-event', handleSync);
    const interval = setInterval(loadDashboardData, 30000);
    return () => {
      window.removeEventListener('smn-realtime-event', handleSync);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-smn-maroon via-smn-maroon-dark to-smn-maroon text-white p-6 rounded-2xl shadow-xl border border-smn-gold/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400 text-smn-brown">
              Traditional Taste & Purity
            </span>
            <span className="text-xs text-amber-200">Since 1984</span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-smn-gold-soft">
            SMN SWEET'S Billing & Sales Operations
          </h1>
          <p className="text-xs text-amber-100/90 font-gujarati mt-0.5">
            શુદ્ધ ઘીની અસલી મીઠાઈઓનું વિશ્વસનીય બિલિંગ મેનેજમેન્ટ
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('billing')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-smn-gold to-amber-500 text-smn-brown font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all text-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>Create New Bill (F1)</span>
          </button>
          <button
            onClick={() => onNavigate('customers')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 text-xs transition-colors"
          >
            <Users className="w-4 h-4 text-amber-200" />
            <span>Register Customer (F7)</span>
          </button>
        </div>
      </div>

      {/* 8 Real Database Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.todaySales}</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-smn-maroon flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-smn-maroon">
            ₹{stats ? stats.today_sales.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Real-time DB</span>
        </div>

        {/* 2. Today's Bills */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.todayBills}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-smn-gold flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-smn-brown">
            {stats ? stats.today_bills : 0}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">Completed today</span>
        </div>

        {/* 3. Average Bill Value */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.avgBillValue}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-800">
            ₹{stats ? stats.avg_bill_value.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">Per invoice</span>
        </div>

        {/* 4. New Customers Today */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.todayCustomers}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-smn-brown">
            {stats ? stats.today_customers : 0}
          </p>
          <span className="text-[11px] text-blue-600 font-medium">Unique mobile</span>
        </div>

        {/* 5. WhatsApp Sent */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.whatsappSent}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            {stats ? stats.today_whatsapp_sent : 0}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Delivered / Sent</span>
        </div>

        {/* 6. WhatsApp Failed / Queued */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.whatsappFailed}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-800">
            {stats ? stats.today_whatsapp_failed : 0}
          </p>
          <span className="text-[11px] text-amber-600 font-medium">Queued or Retryable</span>
        </div>

        {/* 7. Total Customers in DB */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.totalCustomers}</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-purple-900">
            {stats ? stats.total_customers : 0}
          </p>
          <span className="text-[11px] text-purple-600 font-medium">Registered</span>
        </div>

        {/* 8. Total Sweet Products */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">{t.totalProducts}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-smn-maroon flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-smn-maroon">
            {stats ? stats.total_products : 0}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">Active sweets</span>
        </div>
      </div>

      {/* Sales Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Last 7 Days Sales Trend */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-smn-beige-dark shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-smn-brown">{t.sevenDaysTrend}</h3>
              <p className="text-xs text-gray-500">Daily sales performance over the past week</p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-smn-maroon font-semibold hover:underline flex items-center gap-1"
            >
              <span>Detailed Report</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simple custom SVG chart for 7 days */}
          <div className="h-44 w-full flex items-end gap-3 pt-6 border-b border-gray-100">
            {charts && charts.last_7_days && charts.last_7_days.length > 0 ? (
              charts.last_7_days.map((day: any, idx: number) => {
                const max = Math.max(...charts.last_7_days.map((d: any) => d.total), 1000);
                const heightPercent = Math.max(12, Math.round((day.total / max) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      ₹{day.total}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-smn-maroon to-smn-red rounded-t-md hover:brightness-110 transition-all cursor-pointer relative"
                      title={`${day.sale_date}: ₹${day.total} (${day.bills_count} bills)`}
                    ></div>
                    <span className="text-[10px] font-mono text-gray-600 truncate w-full text-center">
                      {new Date(day.sale_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                No recent sales recorded yet this week.
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Action Shortcuts */}
        <div className="bg-white p-5 rounded-2xl border border-smn-beige-dark shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-smn-brown mb-1">{t.quickActions}</h3>
            <p className="text-xs text-gray-500 mb-4">Fast shortcuts for daily shop operations</p>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('billing')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-smn-cream hover:bg-amber-50 border border-smn-beige-dark text-xs font-semibold text-smn-brown transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-smn-maroon" />
                  <span>Start New Bill</span>
                </div>
                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200">F1</span>
              </button>

              <button
                onClick={() => onNavigate('customers')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-smn-cream hover:bg-amber-50 border border-smn-beige-dark text-xs font-semibold text-smn-brown transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-smn-gold" />
                  <span>Register Customer</span>
                </div>
                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200">F7</span>
              </button>

              <button
                onClick={() => onNavigate('products')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-smn-cream hover:bg-amber-50 border border-smn-beige-dark text-xs font-semibold text-smn-brown transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-emerald-700" />
                  <span>Manage Sweet Prices</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => onNavigate('whatsapp')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-smn-cream hover:bg-amber-50 border border-smn-beige-dark text-xs font-semibold text-smn-brown transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-emerald-700" />
                  <span>View WhatsApp Delivery Logs</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-smn-gold-accent flex-shrink-0" />
            <span>Retail Billing System active. All prices calculated with precision.</span>
          </div>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-smn-maroon" />
            <h3 className="font-bold text-sm text-smn-brown">{t.recentBills}</h3>
          </div>
          <button
            onClick={() => onNavigate('bills')}
            className="text-xs text-smn-maroon font-semibold hover:underline flex items-center gap-1"
          >
            <span>View All Bills</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3 pl-6">Bill No</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Mobile</th>
                <th className="p-3 text-right">Amount (₹)</th>
                <th className="p-3">Payment</th>
                <th className="p-3">WhatsApp Status</th>
                <th className="p-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentBills.length > 0 ? (
                recentBills.map((bill) => {
                  const waStatus = bill.whatsapp_status || bill.sms_status || 'none';
                  return (
                  <tr key={bill.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="p-3 pl-6 font-mono font-bold text-smn-maroon">
                      {bill.bill_number}
                    </td>
                    <td className="p-3 font-semibold text-smn-brown">
                      {bill.customer_name_snapshot}
                    </td>
                    <td className="p-3 font-mono text-gray-600">
                      {bill.customer_mobile_snapshot ? `+91 ${bill.customer_mobile_snapshot}` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-smn-brown">
                      ₹{parseFloat(String(bill.final_amount)).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                        {bill.payment_method}
                      </span>
                    </td>
                    <td className="p-3">
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
                    <td className="p-3 pr-6 text-right">
                      <button
                        onClick={() => onOpenBill(bill)}
                        className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-smn-brown transition-colors inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3 text-smn-maroon" />
                        <span>Invoice</span>
                      </button>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No bills generated today yet. Click "Create New Bill (F1)" to start billing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

