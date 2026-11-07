import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  DollarSign, 
  Tag, 
  Layers, 
  Check, 
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { Product, Category, User } from '../../types';
import { translations, Language } from '../../translations';

interface ProductsViewProps {
  user: User | null;
  lang: Language;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ user, lang }) => {
  const t = translations[lang];

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formGujaratiName, setFormGujaratiName] = useState('');
  const [formCategory, setFormCategory] = useState('Peda');
  const [formPrice, setFormPrice] = useState('');
  const [formUnit, setFormUnit] = useState<any>('kg');
  const [formBarcode, setFormBarcode] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Price Modal
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceList, setBulkPriceList] = useState<{ id: number; name: string; price: number }[]>([]);

  // Add Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGujarati, setNewCatGujarati] = useState('');

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.getProducts({ activeOnly: '0' }),
        api.getCategories()
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormGujaratiName('');
    setFormCategory(categories[0]?.name || 'Peda');
    setFormPrice('');
    setFormUnit('kg');
    setFormBarcode('');
    setFormActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormGujaratiName(p.gujarati_name || '');
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormUnit(p.unit);
    setFormBarcode(p.barcode || '');
    setFormActive(p.active === 1);
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(formPrice);
    if (!formName.trim()) {
      setFormError('Product name is required');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid selling price');
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          name: formName.trim(),
          gujarati_name: formGujaratiName.trim() || null,
          category: formCategory,
          price: priceNum,
          unit: formUnit,
          barcode: formBarcode.trim() || null,
          active: formActive ? 1 : 0
        });
      } else {
        await api.addProduct({
          name: formName.trim(),
          gujarati_name: formGujaratiName.trim() || null,
          category: formCategory,
          price: priceNum,
          unit: formUnit,
          barcode: formBarcode.trim() || null
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    }
  };

  const openBulkModal = () => {
    setBulkPriceList(
      products.map((p) => ({ id: p.id, name: p.name, price: p.price }))
    );
    setShowBulkPriceModal(true);
  };

  const handleSaveBulkPrices = async () => {
    try {
      await api.bulkUpdatePrices(bulkPriceList);
      setShowBulkPriceModal(false);
      loadData();
    } catch (e: any) {
      alert('Failed to update bulk prices: ' + e.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.addCategory({ name: newCatName.trim(), gujarati_name: newCatGujarati.trim() || undefined });
      setShowCatModal(false);
      setNewCatName('');
      setNewCatGujarati('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = search.toLowerCase().trim();
    const matchesQuery = 
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.gujarati_name && p.gujarati_name.toLowerCase().includes(q)) ||
      p.product_code.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const isOwner = user?.role === 'owner';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <Package className="w-6 h-6 text-smn-gold" />
            <span>{t.products}</span>
          </h2>
          <p className="text-xs text-gray-500">
            Traditional sweet catalog, Gujarati translations, units & selling prices
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCatModal(true)}
              className="px-3 py-2 bg-white border border-smn-beige-dark hover:bg-gray-50 text-smn-brown text-xs font-semibold rounded-xl transition-colors"
            >
              + Category
            </button>
            <button
              onClick={openBulkModal}
              className="px-3.5 py-2 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-smn-maroon text-xs font-bold rounded-xl transition-colors"
            >
              {t.bulkPriceUpdate}
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-smn-maroon to-smn-red text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-smn-gold-light" />
              <span>{t.addProduct}</span>
            </button>
          </div>
        )}
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sweets by English or Gujarati name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-smn-beige-dark rounded-xl text-xs font-medium text-smn-brown outline-none focus:ring-2 focus:ring-smn-maroon"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {['All', ...categories.map((c) => c.name)].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-smn-maroon text-white font-bold'
                  : 'bg-white text-smn-brown hover:bg-amber-50 border border-smn-beige-dark'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-3 pl-6">{t.productCode}</th>
                <th className="p-3">{t.productName}</th>
                <th className="p-3">{t.gujaratiName}</th>
                <th className="p-3">{t.category}</th>
                <th className="p-3 text-right">{t.sellingPrice}</th>
                <th className="p-3">{t.unit}</th>
                <th className="p-3">{t.status}</th>
                {isOwner && <th className="p-3 pr-6 text-right">{t.actions}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3 pl-6 font-mono font-bold text-gray-400">
                      {p.product_code}
                    </td>
                    <td className="p-3 font-bold text-smn-brown">
                      {p.name}
                    </td>
                    <td className="p-3 font-gujarati text-gray-700">
                      {p.gujarati_name || '—'}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-smn-maroon border border-amber-200">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-smn-maroon">
                      ₹{parseFloat(String(p.price)).toFixed(2)}
                    </td>
                    <td className="p-3 font-mono text-gray-500">
                      per {p.unit}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.active === 1 ? t.active : t.inactive}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="p-3 pr-6 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-smn-brown transition-colors inline-flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3 text-smn-maroon" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    {loading ? 'Loading sweet catalog...' : 'No products found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-smn-gold/40 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-smn-brown">
                {editingProduct ? t.editProduct : t.addProduct}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Product Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Kesar Peda"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Product Name (Gujarati)
                </label>
                <input
                  type="text"
                  value={formGujaratiName}
                  onChange={(e) => setFormGujaratiName(e.target.value)}
                  placeholder="દા.ત. કેસર પેડા"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-gujarati text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit *</label>
                  <select
                    value={formUnit}
                    onChange={(e: any) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="piece">Piece (Pcs)</option>
                    <option value="box">Box</option>
                    <option value="packet">Packet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-mono font-bold text-smn-brown outline-none focus:ring-1 focus:ring-smn-maroon"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Final selling price.</p>
              </div>

              {editingProduct && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pActive"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded text-smn-maroon focus:ring-smn-maroon"
                  />
                  <label htmlFor="pActive" className="text-xs text-gray-700 font-semibold cursor-pointer">
                    Product is Active & Available for billing
                  </label>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white font-bold rounded-xl text-xs shadow-md hover:brightness-110 active:scale-95 transition-all mt-3"
              >
                {editingProduct ? 'Update Product' : 'Add Product to Catalog'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Price Update Modal */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-smn-gold/40 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-smn-brown">Bulk Price Update</h4>
              <button onClick={() => setShowBulkPriceModal(false)} className="text-gray-400">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Update selling prices across all sweet items. Historical bills will preserve their original invoice rates.
            </p>

            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 pr-1">
              {bulkPriceList.map((item, idx) => (
                <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-smn-brown w-3/5 truncate">{item.name}</span>
                  <div className="flex items-center gap-1.5 w-2/5 justify-end">
                    <span className="text-gray-400 font-mono">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...bulkPriceList];
                        copy[idx].price = val;
                        setBulkPriceList(copy);
                      }}
                      className="w-24 px-2 py-1 border border-smn-beige-dark rounded-lg text-right font-mono font-bold text-smn-maroon"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBulkPrices}
                className="px-5 py-2 bg-smn-maroon text-white rounded-xl text-xs font-bold hover:brightness-110"
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-smn-gold/40 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-sm text-smn-brown">Add New Category</h4>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400">✕</button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Special Sweets"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs text-smn-brown"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Gujarati Name</label>
                <input
                  type="text"
                  value={newCatGujarati}
                  onChange={(e) => setNewCatGujarati(e.target.value)}
                  placeholder="દા.ત. સ્પેશિયલ મીઠાઈ"
                  className="w-full px-3 py-1.5 border border-smn-beige-dark rounded-xl text-xs font-gujarati text-smn-brown"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-smn-maroon text-white font-bold rounded-xl text-xs hover:brightness-110"
              >
                Add Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

