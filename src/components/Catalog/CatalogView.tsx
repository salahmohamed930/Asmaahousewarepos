import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import {
  Package,
  Plus,
  Search,
  Edit,
  Tag,
  Barcode,
  X,
  AlertTriangle,
  DollarSign,
  Check,
} from 'lucide-react';

export const CatalogView: React.FC = () => {
  const { products, addProduct, updateProduct } = usePOS();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'أطقم طهي وحلل',
    priceCash: 0,
    priceInstallment: 0,
    priceWholesale: 0,
    cost: 0,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
    description: '',
  });

  const categories = [
    'الكل',
    'أطقم طهي وحلل',
    'أجهزة كهربائية صغيرة',
    'أطقم سفرة وكاسات',
    'ملاعق وأدوات مائدة',
  ];

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `HK-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `622100${Math.floor(100000 + Math.random() * 900000)}`,
      category: 'أطقم طهي وحلل',
      priceCash: 1000,
      priceInstallment: 1250,
      priceWholesale: 900,
      cost: 700,
      stock: 15,
      image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      priceCash: p.priceCash,
      priceInstallment: p.priceInstallment,
      priceWholesale: p.priceWholesale,
      cost: p.cost,
      stock: p.stock,
      image: p.image,
      description: p.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        ...formData,
      });
    } else {
      addProduct(formData);
    }

    setIsModalOpen(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);

    const matchesCat = selectedCategory === 'الكل' || p.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              دليل المنتجات وتسعير الأصناف
            </h1>
            <p className="text-xs text-stone-400">
              أسماء للأدوات المنزلية • إدخال المنتجات وضبط الأسعار (كاش - تقسيط - جملة) والتكلفة
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف جديد</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث بالكود، الباركود، أو اسم المنتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-200 rounded-xl pr-10 pl-4 py-2.5 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex overflow-x-auto space-x-2 space-x-reverse no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === c
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

      </div>

      {/* Products Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((p) => {
          const isLow = p.stock <= 5;

          return (
            <div
              key={p.id}
              className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start space-x-4 space-x-reverse mb-3">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-16 h-16 rounded-2xl object-cover bg-stone-950 border border-stone-800"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] bg-stone-950 text-stone-400 border border-stone-800 px-2 py-0.5 rounded font-bold uppercase block w-fit mb-1">
                      {p.category}
                    </span>
                    <h3 className="text-xs font-extrabold text-stone-100 line-clamp-2">{p.name}</h3>
                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                      كود: {p.sku} | باركود: {p.barcode}
                    </p>
                  </div>
                </div>

                {/* 3 Price Tiers Grid */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold block">سعر الكاش</span>
                    <span className="font-mono font-extrabold text-stone-100">
                      {p.priceCash.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-amber-400 font-bold block">سعر التقسيط</span>
                    <span className="font-mono font-extrabold text-stone-100">
                      {p.priceInstallment.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-indigo-400 font-bold block">سعر الجملة</span>
                    <span className="font-mono font-extrabold text-stone-100">
                      {p.priceWholesale.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Profit Margin & Stock */}
                <div className="flex justify-between items-center text-xs text-stone-400 bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80">
                  <div>
                    <span className="text-[10px] text-stone-500 block">التكلفة والربح:</span>
                    <span className="font-mono font-bold text-stone-300">
                      تكلفة: {p.cost} ج.م | هامش: +{(p.priceCash - p.cost).toLocaleString()} ج.م
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      isLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-emerald-400'
                    }`}
                  >
                    المخزون: {p.stock}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenEdit(p)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 space-x-reverse"
              >
                <Edit className="w-4 h-4" />
                <span>تعديل الأسعار والمخزون</span>
              </button>

            </div>
          );
        })}
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4">
              {editingProduct ? 'تعديل الصنف والأسعار' : 'إضافة صنف جديد'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">اسم المنتج/الصنف</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 mb-1">كود المنتج (SKU)</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">رقم الباركود</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 mb-1">القسم / التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                  >
                    <option value="أطقم طهي وحلل">أطقم طهي وحلل</option>
                    <option value="أجهزة كهربائية صغيرة">أجهزة كهربائية صغيرة</option>
                    <option value="أطقم سفرة وكاسات">أطقم سفرة وكاسات</option>
                    <option value="ملاعق وأدوات مائدة">ملاعق وأدوات مائدة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">سعر التكلفة (ج.م)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3 Price Tiers Inputs */}
              <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-amber-400 block">
                  تحديد أسعار البيع المتعددة (ج.م):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-stone-400 text-[10px] mb-1">سعر الكاش</label>
                    <input
                      type="number"
                      required
                      value={formData.priceCash}
                      onChange={(e) =>
                        setFormData({ ...formData, priceCash: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2 py-1.5 font-mono text-emerald-400 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-400 text-[10px] mb-1">سعر التقسيط</label>
                    <input
                      type="number"
                      required
                      value={formData.priceInstallment}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priceInstallment: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2 py-1.5 font-mono text-amber-400 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-400 text-[10px] mb-1">سعر الجملة</label>
                    <input
                      type="number"
                      required
                      value={formData.priceWholesale}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priceWholesale: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2 py-1.5 font-mono text-indigo-400 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 mb-1">الكمية بالمخزن</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">رابط صورة المنتج</label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg mt-4"
              >
                {editingProduct ? 'حفظ التغييرات' : 'إضافة المنتج'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CatalogView;
