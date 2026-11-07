import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Download, 
  Printer, 
  Wallet, 
  Smartphone, 
  CreditCard, 
  Tag, 
  XCircle, 
  IndianRupee,
  Package
} from 'lucide-react';
import { api } from '../../services/api';
import { translations, Language } from '../../translations';

interface DailySalesViewProps {
  lang: Language;
}

export const DailySalesView: React.FC<DailySalesViewProps> = ({ lang }) => {
  const t = translations[lang];

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.getDailySalesReport(selectedDate);
      setReport(res);
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDate]);

  const handleExportCSV = () => {
    window.location.href = `http://127.0.0.1:4000/api/reports/export-csv?from_date=${selectedDate}&to_date=${selectedDate}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = report?.summary || {};
  const itemSales = report?.itemSales || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-y-auto">
      {/* Header & Date Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-smn-gold" />
            <span>{t.dailySales}</span>
          </h2>
          <p className="text-xs text-gray-500">
            End-of-day sales auditing, payment mode breakdown, and item-wise volume
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-smn-beige-dark px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-smn-gold-accent" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-smn-brown outline-none bg-transparent cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-smn-beige-dark hover:bg-gray-50 rounded-xl text-xs font-semibold text-smn-brown shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-smn-maroon hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-smn-gold-light" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Net Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-smn-maroon flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-smn-maroon">
            ₹{summary.total_sales ? summary.total_sales.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">
            {summary.total_bills || 0} bills completed
          </span>
        </div>

        {/* Cash Sales */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Cash Received</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-800">
            ₹{summary.cash_sales ? summary.cash_sales.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">In drawer</span>
        </div>

        {/* UPI Sales */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">UPI / QR Digital</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-blue-900">
            ₹{summary.upi_sales ? summary.upi_sales.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">Bank transfer / UPI</span>
        </div>

        {/* Card Sales */}
        <div className="bg-white p-4 rounded-xl border border-smn-beige-dark shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Card / POS Swipe</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-purple-900">
            ₹{summary.card_sales ? summary.card_sales.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-gray-400 font-medium">Debit / Credit card</span>
        </div>
      </div>

      {/* Secondary metrics (Discounts, Cancelled) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-3 bg-white rounded-xl border border-smn-beige-dark flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600">
            <Tag className="w-4 h-4" />
            <span className="text-xs font-semibold">Total Discounts Given:</span>
          </div>
          <span className="font-mono font-bold text-sm text-rose-700">
            ₹{summary.total_discounts ? summary.total_discounts.toFixed(2) : '0.00'}
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-smn-beige-dark flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-semibold">Cancelled Bills:</span>
          </div>
          <span className="font-mono font-bold text-sm text-gray-700">
            {summary.cancelled_bills || 0}
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-smn-beige-dark flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold">Average Bill Value:</span>
          </div>
          <span className="font-mono font-bold text-sm text-amber-800">
            ₹{summary.total_bills > 0 ? (summary.total_sales / summary.total_bills).toFixed(2) : '0.00'}
          </span>
        </div>
      </div>

      {/* Item-wise Sales Volume Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 px-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-smn-maroon" />
            <h3 className="font-bold text-sm text-smn-brown">
              Sweet Sales Breakdown by Item ({new Date(selectedDate).toLocaleDateString('en-IN')})
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {itemSales.length} distinct items sold
          </span>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-3 pl-6">Sr.</th>
                <th className="p-3">Sweet Product Name</th>
                <th className="p-3 text-right">Total Quantity Sold</th>
                <th className="p-3">Unit</th>
                <th className="p-3 pr-6 text-right">Gross Sales (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itemSales.length > 0 ? (
                itemSales.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3 pl-6 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-smn-brown">
                      {item.product_name_snapshot}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-smn-brown">
                      {item.unit === 'kg' && item.total_quantity < 1
                        ? `${Math.round(item.total_quantity * 1000)}g`
                        : item.total_quantity}
                    </td>
                    <td className="p-3 font-mono text-gray-500">
                      {item.unit}
                    </td>
                    <td className="p-3 pr-6 text-right font-mono font-bold text-smn-maroon text-sm">
                      ₹{parseFloat(String(item.total_amount)).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    {loading ? 'Calculating daily sales figures...' : 'No sales recorded on this date.'}
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

