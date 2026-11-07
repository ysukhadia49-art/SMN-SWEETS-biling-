import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  Trash2, 
  CreditCard, 
  Smartphone, 
  Wallet, 
  Tag, 
  Scale, 
  AlertCircle,
  Receipt,
  UserCheck,
  Printer,
  CheckCircle2,
  Building,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { Product, Customer, CartItem, PaymentMethod, DiscountType, Bill, Settings } from '../../types';
import { translations, Language } from '../../translations';

interface BillingViewProps {
  onBillCompleted: (bill: Bill) => void;
  lang: Language;
}

export const BillingView: React.FC<BillingViewProps> = ({
  onBillCompleted,
  lang
}) => {
  const t = translations[lang];

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Customer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Quick Customer Registration Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [custModalError, setCustModalError] = useState<string | null>(null);

  // Weight Selection Modal
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  const [customWeightInput, setCustomWeightInput] = useState('');

  // Discounts & Payment
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [billType, setBillType] = useState<'retail' | 'wholesale'>('retail');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUPI, setSplitUPI] = useState<number>(0);
  const [showSplitModal, setShowSplitModal] = useState(false);

  // Manual payment transaction references
  const [utrInput, setUtrInput] = useState('');
  const [cardAuthCode, setCardAuthCode] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [shopSettings, setShopSettings] = useState<Settings | null>(null);

  // Loading & Submitting
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Load products, categories, and settings on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [prodList, catList, settingsRes] = await Promise.all([
          api.getProducts({ activeOnly: '1' }),
          api.getCategories(),
          api.getSettings().catch(() => null)
        ]);
        setProducts(prodList);
        setCategories(['All', ...catList.map((c: any) => c.name)]);
        if (settingsRes) setShopSettings(settingsRes);
      } catch (err) {
        console.error('Failed to load products/categories:', err);
      }
    }
    loadData();
  }, []);

  // Listen to server-sent events for multi-terminal sync
  useEffect(() => {
    const handleRealtime = (e: any) => {
      const data = e.detail;
      if (!data) return;
      if (data.type === 'PRODUCT_UPDATED') {
        api.getProducts({ activeOnly: '1' }).then(setProducts).catch(console.error);
      } else if (data.type === 'SETTINGS_UPDATED') {
        api.getSettings().then(setShopSettings).catch(console.error);
      }
    };
    window.addEventListener('smn-realtime-event', handleRealtime);
    return () => window.removeEventListener('smn-realtime-event', handleRealtime);
  }, []);

  // Global Keyboard Shortcuts (F1 - F8, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddCustomerModal(false);
        setWeightModalProduct(null);
        setShowDiscountModal(false);
        setShowSplitModal(false);
        setShowCustomerDropdown(false);
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        customerInputRef.current?.focus();
      } else if (e.key === 'F7') {
        e.preventDefault();
        setShowAddCustomerModal(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setCart([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search customers on typing
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.getCustomers({ search: customerSearch.trim(), limit: 6 });
        setCustomerResults(res.customers || []);
        setShowCustomerDropdown(true);
      } catch (err) {
        console.error('Customer search error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Handle adding product to cart
  const handleSelectProduct = (product: Product) => {
    if (product.unit === 'kg') {
      setWeightModalProduct(product);
      setCustomWeightInput('');
    } else {
      addToCart(product, 1, product.unit, product.price);
    }
  };

  const handleApplyWeight = (weightInKg: number) => {
    if (!weightModalProduct) return;
    addToCart(weightModalProduct, weightInKg, 'kg', weightModalProduct.price);
    setWeightModalProduct(null);
  };

  const handleApplyCustomWeight = () => {
    if (!weightModalProduct) return;
    const wt = parseFloat(customWeightInput);
    if (isNaN(wt) || wt <= 0) return;
    addToCart(weightModalProduct, wt, 'kg', weightModalProduct.price);
    setWeightModalProduct(null);
  };

  const addToCart = (product: Product, quantity: number, unit: any, unitPrice: number) => {
    const lineTotal = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
    const existingIndex = cart.findIndex(
      (item) => item.product_id === product.id && item.unit === unit
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + quantity;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        line_total: Math.round((unitPrice * newQty + Number.EPSILON) * 100) / 100
      };
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_code: product.product_code,
          product_name: product.name,
          gujarati_name: product.gujarati_name,
          quantity: quantity,
          unit: unit,
          unit_price: unitPrice,
          line_total: lineTotal
        }
      ]);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const updated = [...cart];
    const item = updated[index];
    const lineTotal = Math.round((item.unit_price * newQty + Number.EPSILON) * 100) / 100;
    updated[index] = {
      ...item,
      quantity: newQty,
      line_total: lineTotal
    };
    setCart(updated);
  };

  // Calculations
  const subtotal = Math.round(
    (cart.reduce((sum, item) => sum + item.line_total, 0) + Number.EPSILON) * 100
  ) / 100;

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = Math.round(((subtotal * discountValue) / 100 + Number.EPSILON) * 100) / 100;
  } else {
    discountAmount = Math.round((discountValue + Number.EPSILON) * 100) / 100;
  }
  if (discountAmount > subtotal) discountAmount = subtotal;

  const finalAmount = Math.round((subtotal - discountAmount + Number.EPSILON) * 100) / 100;

  // Change calculation for cash payment
  const cashGiven = parseFloat(cashTendered) || 0;
  const changeToReturn = cashGiven > finalAmount ? Math.round((cashGiven - finalAmount + Number.EPSILON) * 100) / 100 : 0;

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = 
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.gujarati_name && p.gujarati_name.toLowerCase().includes(q)) ||
      p.product_code.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  // Handle Quick Customer Registration
  const handleRegisterCustomerQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustModalError(null);

    const cleanMobile = newCustMobile.replace(/\D/g, '');
    const norm = cleanMobile.length === 12 && cleanMobile.startsWith('91') ? cleanMobile.slice(2) : cleanMobile;

    if (!newCustName.trim()) {
      setCustModalError('Customer name is required');
      return;
    }
    if (norm.length !== 10) {
      setCustModalError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    try {
      const res = await api.registerCustomer({
        name: newCustName.trim(),
        mobile: norm,
        address: newCustAddress.trim() || undefined
      });

      if (res.customer) {
        setSelectedCustomer(res.customer);
        setCustomerSearch(`${res.customer.name} (${res.customer.mobile})`);
        setShowAddCustomerModal(false);
        setNewCustName('');
        setNewCustMobile('');
        setNewCustAddress('');
      }
    } catch (err: any) {
      setCustModalError(err.message || 'Failed to register customer');
    }
  };

  // Complete Bill Submission
  const handleCompleteBill = async () => {
    if (cart.length === 0) {
      setErrorMessage('Cannot complete bill with an empty cart.');
      return;
    }

    if (paymentMethod === 'split') {
      const splitTotal = Math.round((splitCash + splitUPI + Number.EPSILON) * 100) / 100;
      if (Math.abs(splitTotal - finalAmount) > 0.05) {
        setErrorMessage(`Split payments (₹${splitTotal}) must exactly equal the bill total (₹${finalAmount})`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let refCode: string | null = null;
      if (paymentMethod === 'upi') {
        refCode = utrInput.trim() || null;
      } else if (paymentMethod === 'card') {
        refCode = cardAuthCode.trim() || null;
      } else if (paymentMethod === 'bank_transfer') {
        refCode = utrInput.trim() || null;
      } else if (paymentMethod === 'split') {
        refCode = utrInput.trim() || null;
      }

      const payload: any = {
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        customer_mobile: selectedCustomer ? selectedCustomer.normalized_mobile : null,
        items: cart,
        discount_type: discountType,
        discount_value: discountValue,
        payment_method: paymentMethod,
        bill_type: billType,
        split_details: paymentMethod === 'split' ? { cash: splitCash, upi: splitUPI } : null,
        verification_type: 'manually_confirmed',
        utr: refCode
      };

      const result = await api.createBill(payload);

      if (result.success && result.bill) {
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearch('');
        setDiscountValue(0);
        setPaymentMethod('cash');
        setBillType('retail');
        setUtrInput('');
        setCardAuthCode('');
        setCashTendered('');

        onBillCompleted(result.bill);
      }
    } catch (err: any) {
      console.error('Create bill error:', err);
      setErrorMessage(err.message || 'Failed to complete bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-smn-cream">
      {/* LEFT SIDE: Product Search, Category Tabs, Products Grid */}
      <div className="flex-1 flex flex-col border-r border-smn-beige-dark overflow-hidden">
        {/* Search & Shortcuts Bar */}
        <div className="p-3 bg-white border-b border-smn-beige-dark flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sweets by name, Gujarati name or code... (F1)"
              className="w-full pl-9 pr-4 py-2 bg-smn-cream/60 border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown placeholder-gray-400 outline-none focus:ring-2 focus:ring-smn-maroon"
            />
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded border">F1: Search</span>
            <span className="bg-gray-100 px-2 py-1 rounded border">F2: Customer</span>
            <span className="bg-gray-100 px-2 py-1 rounded border">F7: Add Cust</span>
            <span className="bg-gray-100 px-2 py-1 rounded border">F8: Clear</span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-3 py-2 bg-smn-cream border-b border-smn-beige-dark flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-smn-maroon text-white shadow-sm'
                  : 'bg-white text-smn-brown border border-smn-beige-dark hover:bg-amber-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectProduct(p)}
              className="bg-white rounded-xl border border-smn-beige-dark p-3 flex flex-col justify-between hover:border-smn-gold hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div>
                <div className="flex justify-between items-start gap-1 mb-1">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">
                    {p.product_code}
                  </span>
                  <span className="text-[10px] bg-amber-100 text-smn-maroon-dark px-1.5 py-0.5 rounded font-semibold">
                    {p.category}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-smn-brown leading-tight group-hover:text-smn-maroon transition-colors line-clamp-2">
                  {p.name}
                </h4>
                {p.gujarati_name && (
                  <p className="text-[11px] text-gray-500 font-gujarati mt-0.5 line-clamp-1">
                    {p.gujarati_name}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold font-mono text-smn-maroon">
                    ₹{p.price}
                  </span>
                  <span className="text-[10px] text-gray-400">/{p.unit}</span>
                </div>

                <div className="w-6 h-6 rounded-lg bg-smn-cream group-hover:bg-smn-maroon group-hover:text-white flex items-center justify-center text-xs font-bold text-smn-brown transition-colors">
                  +
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Customer Info, Cart Items, Pricing & Payments */}
      <div className="w-full md:w-96 lg:w-[420px] flex flex-col bg-white overflow-hidden shadow-lg border-l border-smn-beige-dark">
        {/* Invoice Category Selector: Retail Bill vs Wholesale Bill */}
        <div className="p-3 bg-gradient-to-r from-smn-cream via-white to-smn-cream border-b border-smn-beige-dark space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-smn-maroon flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-smn-gold-accent" />
              <span>Bill Type / બિલ પ્રકાર</span>
            </span>
            <div className="flex items-center gap-1 bg-smn-beige/70 p-0.5 rounded-lg border border-smn-beige-dark">
              <button
                type="button"
                onClick={() => setBillType('retail')}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                  billType === 'retail'
                    ? 'bg-smn-maroon text-white shadow-sm'
                    : 'text-gray-600 hover:text-smn-maroon'
                }`}
              >
                Retail (છૂટક)
              </button>
              <button
                type="button"
                onClick={() => setBillType('wholesale')}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                  billType === 'wholesale'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-amber-700'
                }`}
              >
                Wholesale (જથ્થાબંધ)
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-smn-brown cursor-pointer select-none pt-0.5">
            <input
              type="checkbox"
              checked={billType === 'wholesale'}
              onChange={(e) => setBillType(e.target.checked ? 'wholesale' : 'retail')}
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 accent-amber-600 cursor-pointer"
            />
            <span className={billType === 'wholesale' ? 'text-amber-800 font-bold' : 'text-gray-700'}>
              {billType === 'wholesale' ? '✓ Wholesale Bill Selected (જથ્થાબંધ બિલ)' : 'Check for Wholesale Bill (જથ્થાબંધ બિલ)'}
            </span>
          </label>
        </div>

        {/* Customer Header */}
        <div className="p-3 bg-white border-b border-smn-beige-dark space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-smn-brown flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-smn-maroon" />
              <span>Customer Details</span>
            </span>

            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="text-[11px] font-bold text-smn-maroon hover:text-smn-maroon-dark flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.registerCustomer}</span>
            </button>
          </div>

          <div className="relative">
            <input
              ref={customerInputRef}
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search by Mobile or Name... (F2)"
              className="w-full px-3 py-1.5 bg-smn-cream/60 border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
            />

            {/* Autocomplete Dropdown */}
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-smn-beige-dark rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                {customerResults.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch(`${c.name} (${c.mobile})`);
                      setShowCustomerDropdown(false);
                    }}
                    className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-xs flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-smn-brown">{c.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">+91 {c.mobile}</p>
                    </div>
                    <span className="text-[10px] text-smn-maroon font-semibold">Select</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-gray-100">
          {cart.length > 0 ? (
            cart.map((item, index) => (
              <div key={index} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                <div className="flex-1 pr-2">
                  <h5 className="font-bold text-smn-brown leading-tight">
                    {item.product_name}
                  </h5>
                  {item.gujarati_name && (
                    <p className="text-[10px] text-gray-500 font-gujarati">
                      {item.gujarati_name}
                    </p>
                  )}
                  <span className="text-[11px] text-gray-400 font-mono">
                    ₹{item.unit_price}/{item.unit}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5">
                  {item.unit === 'kg' ? (
                    <div className="flex items-center border border-gray-200 rounded-lg px-2 py-0.5 bg-gray-50">
                      <span className="font-mono font-bold text-xs">
                        {item.quantity < 1 ? `${Math.round(item.quantity * 1000)}g` : `${item.quantity}kg`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateCartQuantity(index, item.quantity - 1)}
                        className="px-2 py-0.5 hover:bg-gray-100 text-gray-600 font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 py-0.5 font-mono text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(index, item.quantity + 1)}
                        className="px-2 py-0.5 hover:bg-gray-100 text-gray-600 font-bold"
                      >
                        +
                      </button>
                    </div>
                  )}

                  <span className="font-mono font-bold text-sm text-smn-maroon w-16 text-right">
                    ₹{item.line_total.toFixed(2)}
                  </span>

                  <button
                    onClick={() => removeFromCart(index)}
                    className="p-1 text-gray-300 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-8">
              <Receipt className="w-8 h-8 text-gray-300 mb-2" />
              <p>{t.noItemsInCart}</p>
            </div>
          )}
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="px-3 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="font-bold text-gray-400">✕</button>
          </div>
        )}

        {/* Calculations & Standard Manual Payment Footer */}
        <div className="p-3.5 bg-smn-cream border-t border-smn-beige-dark space-y-2.5">
          {/* Subtotal & Discount row */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>{t.subtotal}:</span>
              <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-rose-600">
              <button
                onClick={() => setShowDiscountModal(true)}
                className="underline hover:text-rose-800 font-medium flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                <span>{t.discount}</span>
              </button>
              <span className="font-mono font-medium">- ₹{discountAmount.toFixed(2)}</span>
            </div>

            {/* Net Total Amount Display */}
            <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-gray-300">
              <span className="text-xs font-bold text-smn-brown uppercase">{t.finalTotal}:</span>
              <span className="text-2xl font-bold font-mono text-smn-maroon">
                ₹{finalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector (Standard Indian Sweet Shop Modes) */}
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: 'cash', label: t.cash, icon: Wallet },
              { id: 'upi', label: 'UPI', icon: Smartphone },
              { id: 'card', label: t.card, icon: CreditCard },
              { id: 'bank_transfer', label: 'Bank', icon: Building },
              { id: 'split', label: t.split, icon: Scale },
            ].map((pm) => {
              const Icon = pm.icon;
              const isSelected = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => {
                    setPaymentMethod(pm.id as PaymentMethod);
                    if (pm.id === 'split') {
                      setSplitCash(Math.floor(finalAmount / 2));
                      setSplitUPI(finalAmount - Math.floor(finalAmount / 2));
                      setShowSplitModal(true);
                    }
                  }}
                  className={`py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all border ${
                    isSelected
                      ? 'bg-smn-maroon text-white border-smn-maroon shadow-sm'
                      : 'bg-white text-smn-brown border-smn-beige-dark hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-smn-gold-light' : 'text-gray-500'}`} />
                  <span className="truncate">{pm.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. Cash Payment Detail Box */}
          {paymentMethod === 'cash' && finalAmount > 0 && (
            <div className="p-2.5 bg-white border border-smn-beige-dark rounded-xl shadow-sm space-y-1.5 animate-in fade-in duration-150 text-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-600">Payable in Cash:</span>
                <span className="font-mono font-bold text-base text-smn-maroon">₹{finalAmount.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-gray-500 font-semibold mb-0.5">Cash Received (₹)</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-2 py-1 border border-smn-beige-dark rounded-lg text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-smn-maroon"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-semibold mb-0.5">Change to Return</label>
                  <div className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-emerald-700">
                    ₹{changeToReturn.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Manual UPI Payment Detail Box */}
          {paymentMethod === 'upi' && finalAmount > 0 && (
            <div className="p-2.5 bg-white border border-smn-maroon/30 rounded-xl shadow-sm space-y-2 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-smn-maroon flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>UPI Payment (GPay / PhonePe / Paytm)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  MANUAL CONFIRMATION
                </span>
              </div>

              <div className="p-2 bg-amber-50 rounded-lg flex justify-between items-center text-xs border border-amber-200">
                <span className="font-semibold text-smn-brown">Payable via UPI:</span>
                <span className="text-lg font-mono font-bold text-smn-maroon">₹{finalAmount.toFixed(2)}</span>
              </div>

              <p className="text-[10px] text-gray-500 leading-relaxed">
                Check shop soundbox, UPI app, or SMS notification to confirm payment receipt before printing bill.
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                  UPI Bank Reference / UTR Number (Optional)
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 12-digit UTR from customer app or soundbox"
                  className="w-full px-2.5 py-1.5 border border-smn-beige-dark rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>
            </div>
          )}

          {/* 3. Manual Card Terminal Detail Box */}
          {paymentMethod === 'card' && finalAmount > 0 && (
            <div className="p-2.5 bg-white border border-smn-maroon/30 rounded-xl shadow-sm space-y-2 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-smn-maroon flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card POS Terminal</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  MANUAL CONFIRMATION
                </span>
              </div>

              <div className="p-2 bg-smn-cream rounded-lg flex justify-between items-center text-xs border border-smn-beige-dark">
                <span className="font-semibold text-smn-brown">Charge on Card Machine:</span>
                <span className="text-lg font-mono font-bold text-smn-maroon">₹{finalAmount.toFixed(2)}</span>
              </div>

              <p className="text-[10px] text-gray-500">
                Swipe/Insert card on shop EDC terminal. Verify approval before completing bill.
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                  Terminal Approval Code / Slip RRN (Optional)
                </label>
                <input
                  type="text"
                  value={cardAuthCode}
                  onChange={(e) => setCardAuthCode(e.target.value)}
                  placeholder="e.g. AUTH-482910 or RRN from slip"
                  className="w-full px-2.5 py-1.5 border border-smn-beige-dark rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>
            </div>
          )}

          {/* 4. Bank Transfer Detail Box */}
          {paymentMethod === 'bank_transfer' && finalAmount > 0 && (
            <div className="p-2.5 bg-white border border-smn-maroon/30 rounded-xl shadow-sm space-y-2 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-smn-maroon flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Direct Bank Transfer (NEFT / IMPS / RTGS)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  MANUAL VERIFIED
                </span>
              </div>

              <div className="p-2 bg-purple-50 rounded-lg flex justify-between items-center text-xs border border-purple-200">
                <span className="font-semibold text-smn-brown">Transfer Amount:</span>
                <span className="text-lg font-mono font-bold text-smn-maroon">₹{finalAmount.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                  Bank Reference Number / Transaction ID
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. NEFT12948201 or IMPS reference"
                  className="w-full px-2.5 py-1.5 border border-smn-beige-dark rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>
            </div>
          )}

          {/* 5. Split Payment Breakdown */}
          {paymentMethod === 'split' && finalAmount > 0 && (
            <div className="p-2.5 bg-white border border-smn-maroon/30 rounded-xl shadow-sm space-y-2 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center justify-between font-bold text-smn-brown">
                <span>Split Tender Breakdown</span>
                <button
                  type="button"
                  onClick={() => setShowSplitModal(true)}
                  className="text-[10px] text-smn-maroon underline font-semibold"
                >
                  Edit Amounts
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-1.5 bg-smn-cream rounded-lg border border-smn-beige-dark">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase block">Cash Amount</span>
                  <span className="font-mono font-bold text-xs text-smn-brown">₹{splitCash.toFixed(2)}</span>
                </div>
                <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-[10px] font-semibold text-amber-800 uppercase block">UPI / Card Portion</span>
                  <span className="font-mono font-bold text-xs text-smn-maroon">₹{splitUPI.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                  Digital Portion UTR / Ref (Optional)
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 12-digit UTR or card slip ref"
                  className="w-full px-2.5 py-1 border border-smn-beige-dark rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>
            </div>
          )}

          {/* Complete Bill Action Button */}
          <button
            onClick={handleCompleteBill}
            disabled={submitting || cart.length === 0}
            className="w-full py-3 bg-gradient-to-r from-smn-maroon via-smn-maroon-light to-smn-red text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 border border-smn-gold/40"
          >
            <Printer className="w-4 h-4 text-smn-gold-light" />
            <span>{submitting ? t.savingBill : `${t.completeBill} • ₹${finalAmount.toFixed(2)}`}</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Weight Quick Selector */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-smn-brown">{weightModalProduct.name}</h4>
                <p className="text-xs text-smn-maroon font-semibold font-mono">
                  ₹{weightModalProduct.price} / kg
                </p>
              </div>
              <button
                onClick={() => setWeightModalProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Quick Weight Options
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '50g', val: 0.05 },
                  { label: '100g', val: 0.10 },
                  { label: '250g', val: 0.25 },
                  { label: '500g', val: 0.50 },
                  { label: '750g', val: 0.75 },
                  { label: '1 kg', val: 1.00 },
                  { label: '1.25 kg', val: 1.25 },
                  { label: '1.5 kg', val: 1.50 },
                  { label: '2 kg', val: 2.00 },
                ].map((w) => (
                  <button
                    key={w.label}
                    onClick={() => handleApplyWeight(w.val)}
                    className="p-2.5 rounded-xl border border-smn-beige-dark bg-smn-cream hover:bg-smn-maroon hover:text-white hover:border-smn-maroon text-xs font-mono font-bold text-smn-brown transition-all"
                  >
                    {w.label}
                    <span className="block text-[10px] font-normal opacity-80">
                      ₹{(weightModalProduct.price * w.val).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Weight Input */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Custom Weight (in Kilograms)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={customWeightInput}
                  onChange={(e) => setCustomWeightInput(e.target.value)}
                  placeholder="e.g. 0.35 for 350g"
                  className="flex-1 px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-smn-maroon"
                />
                <button
                  onClick={handleApplyCustomWeight}
                  className="px-4 py-1.5 bg-smn-maroon text-white rounded-xl text-xs font-bold hover:brightness-110"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Customer Registration */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-smn-brown flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-smn-maroon" />
                <span>{t.registerCustomer}</span>
              </h4>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterCustomerQuick} className="space-y-3">
              {custModalError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {custModalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Rahul Patel"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mobile Number (10 digits) *
                </label>
                <input
                  type="text"
                  required
                  value={newCustMobile}
                  onChange={(e) => setNewCustMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="e.g. Ahmedabad"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-smn-maroon text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 active:scale-95 transition-all mt-2"
              >
                Register & Select Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Discount Selector */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-sm text-smn-brown">Apply Discount</h4>
              <button onClick={() => setShowDiscountModal(false)} className="text-gray-400">✕</button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                  discountType === 'fixed' ? 'bg-smn-maroon text-white' : 'bg-gray-50 text-gray-700'
                }`}
              >
                Flat ₹
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                  discountType === 'percentage' ? 'bg-smn-maroon text-white' : 'bg-gray-50 text-gray-700'
                }`}
              >
                Percentage %
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Discount {discountType === 'fixed' ? 'Amount (₹)' : 'Value (%)'}
              </label>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-sm font-mono font-bold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
              />
            </div>

            <button
              onClick={() => setShowDiscountModal(false)}
              className="w-full py-2 bg-smn-maroon text-white text-xs font-bold rounded-xl"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Split Payment Configuration */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-sm text-smn-brown">Split Payment Modes</h4>
              <button onClick={() => setShowSplitModal(false)} className="text-gray-400">✕</button>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-lg text-xs text-amber-900 font-medium">
              Total Amount to Pay: <span className="font-bold font-mono">₹{finalAmount.toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cash Amount (₹)</label>
                <input
                  type="number"
                  value={splitCash}
                  onChange={(e) => {
                    const c = parseFloat(e.target.value) || 0;
                    setSplitCash(c);
                    setSplitUPI(Math.max(0, Math.round((finalAmount - c + Number.EPSILON) * 100) / 100));
                  }}
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">UPI / Digital Amount (₹)</label>
                <input
                  type="number"
                  value={splitUPI}
                  onChange={(e) => setSplitUPI(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSplitModal(false)}
              className="w-full py-2 bg-smn-maroon text-white text-xs font-bold rounded-xl"
            >
              Confirm Split
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
