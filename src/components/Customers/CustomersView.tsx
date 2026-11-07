import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Receipt, 
  IndianRupee, 
  Calendar, 
  History, 
  Edit, 
  ChevronRight, 
  X,
  Send,
  Download,
  Printer
} from 'lucide-react';
import { api } from '../../services/api';
import { Customer, Bill } from '../../types';
import { translations, Language } from '../../translations';

interface CustomersViewProps {
  onOpenBill: (bill: Bill) => void;
  lang: Language;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onOpenBill,
  lang
}) => {
  const t = translations[lang];

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Profile Drawer
  const [selectedProfile, setSelectedProfile] = useState<Customer | null>(null);
  const [profileBills, setProfileBills] = useState<Bill[]>([]);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // New / Edit Customer Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formSecondaryMobile, setFormSecondaryMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      const res = await api.getCustomers({ search: search.trim() });
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleSync = () => loadCustomers();
    window.addEventListener('smn-realtime-event', handleSync);
    return () => window.removeEventListener('smn-realtime-event', handleSync);
  }, []);

  const openProfile = async (customer: Customer) => {
    setSelectedProfile(customer);
    setLoadingProfile(true);
    try {
      const res = await api.getCustomerProfile(customer.id);
      setProfileBills(res.bills || []);
      setProfileStats(res.stats || {});
    } catch (e) {
      console.error('Error fetching customer profile:', e);
    } finally {
      setLoadingProfile(false);
    }
  };

  const openNewCustomerModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormMobile('');
    setFormSecondaryMobile('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setShowModal(true);
  };

  const openEditCustomerModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormMobile(c.mobile);
    setFormSecondaryMobile(c.secondary_mobile || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanMobile = formMobile.replace(/\D/g, '');
    const norm = cleanMobile.length === 12 && cleanMobile.startsWith('91') ? cleanMobile.slice(2) : cleanMobile;

    if (!formName.trim()) {
      setFormError('Customer full name is required');
      return;
    }
    if (norm.length !== 10) {
      setFormError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, {
          name: formName.trim(),
          mobile: norm,
          secondary_mobile: formSecondaryMobile.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null
        });
      } else {
        await api.registerCustomer({
          name: formName.trim(),
          mobile: norm,
          secondary_mobile: formSecondaryMobile.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null
        });
      }

      setShowModal(false);
      loadCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <Users className="w-6 h-6 text-smn-gold" />
            <span>{t.customers}</span>
          </h2>
          <p className="text-xs text-gray-500">
            Registered customer mobile database, visit frequency & invoice history
          </p>
        </div>

        <button
          onClick={openNewCustomerModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4 text-smn-gold-light" />
          <span>{t.registerCustomer} (F7)</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchCustomers}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon shadow-sm"
        />
      </div>

      {/* Customers Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-3.5 pl-6">{t.customerId}</th>
                <th className="p-3.5">{t.customerName}</th>
                <th className="p-3.5">{t.mobileNumber}</th>
                <th className="p-3.5 text-right">{t.totalBills}</th>
                <th className="p-3.5 text-right">{t.totalSpent}</th>
                <th className="p-3.5">{t.lastPurchase}</th>
                <th className="p-3.5 pr-6 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3.5 pl-6 font-mono font-bold text-smn-maroon">
                      {c.customer_code}
                    </td>
                    <td className="p-3.5 font-bold text-smn-brown">
                      {c.name}
                    </td>
                    <td className="p-3.5 font-mono text-gray-600">
                      +91 {c.normalized_mobile}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-smn-brown">
                      {c.total_bills || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-smn-maroon">
                      ₹{parseFloat(String(c.total_spent || 0)).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-gray-500">
                      {c.last_purchase_at
                        ? new Date(c.last_purchase_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="p-3.5 pr-6 text-right space-x-2">
                      <button
                        onClick={() => openEditCustomerModal(c)}
                        title="Edit Customer"
                        className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openProfile(c)}
                        className="px-2.5 py-1 bg-smn-cream hover:bg-amber-100/70 text-smn-maroon border border-smn-beige-dark rounded-lg font-semibold inline-flex items-center gap-1"
                      >
                        <span>History</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    {loading ? 'Loading customer records...' : 'No customers found matching search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile Side Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-smn-gold/40 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 bg-smn-maroon text-white flex items-center justify-between border-b-2 border-smn-gold">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-200">Customer Profile</span>
                <h3 className="font-serif font-bold text-lg text-smn-gold-soft">{selectedProfile.name}</h3>
                <p className="text-xs text-amber-100 font-mono">+91 {selectedProfile.normalized_mobile}</p>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-amber-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Statistics & Bill History */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto bg-smn-cream">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-smn-beige-dark shadow-sm">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Total Spent</span>
                  <p className="text-lg font-bold font-mono text-smn-maroon">
                    ₹{profileStats?.total_spent ? parseFloat(profileStats.total_spent).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-smn-beige-dark shadow-sm">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Total Invoices</span>
                  <p className="text-lg font-bold font-mono text-smn-brown">
                    {profileStats?.total_bills || 0}
                  </p>
                </div>
              </div>

              {/* Invoices List */}
              <div>
                <h4 className="font-bold text-xs text-smn-brown uppercase mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-smn-maroon" />
                  <span>Purchase & Invoices History</span>
                </h4>

                <div className="space-y-2">
                  {profileBills.length > 0 ? (
                    profileBills.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 bg-white rounded-xl border border-smn-beige-dark shadow-sm flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-mono font-bold text-smn-maroon">{b.bill_number}</p>
                          <p className="text-[11px] text-gray-500">
                            {new Date(b.created_at).toLocaleDateString('en-IN')} • {b.payment_method.toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-sm text-smn-brown">
                            ₹{parseFloat(String(b.final_amount)).toFixed(2)}
                          </p>
                          <button
                            onClick={() => onOpenBill(b)}
                            className="text-[11px] font-semibold text-smn-maroon hover:underline flex items-center gap-1 ml-auto"
                          >
                            <Printer className="w-3 h-3" />
                            <span>View PDF</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-6">
                      No previous bills recorded for this customer yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-white border-t border-smn-beige-dark">
              <button
                onClick={() => setSelectedProfile(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-smn-brown flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-smn-maroon" />
                <span>{editingCustomer ? t.editCustomer : t.registerCustomer}</span>
              </h4>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.customerName} *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Rahul Patel"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.mobileNumber} *</label>
                <input
                  type="text"
                  required
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  placeholder="10-digit Indian mobile"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.secondaryMobile}</label>
                <input
                  type="text"
                  value={formSecondaryMobile}
                  onChange={(e) => setFormSecondaryMobile(e.target.value)}
                  placeholder="Optional alternate number"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Area / City"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 active:scale-95 transition-all mt-3"
              >
                {editingCustomer ? 'Save Changes' : 'Register Customer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

