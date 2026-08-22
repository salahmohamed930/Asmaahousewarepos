import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { ProductLabelModal } from './ProductLabelModal';
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
  List,
  LayoutGrid,
  Printer,
  RefreshCw,
  FolderPlus,
  Trash2,
} from 'lucide-react';

export const CatalogView: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    clearAllProducts,
    refreshDataFromSupabase,
    settings,
  } = usePOS();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [layoutMode, setLayoutMode] = useState<'rows' | 'grid'>('rows');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [labelProducts, setLabelProducts] = useState<Product[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Remember last chosen category
  const [lastChosenCategory, setLastChosenCategory] = useState(() => {
    return localStorage.getItem('last_chosen_category') || 'أطقم طهي وحلل';
  });

  // Custom Category dropdown menu state inside Add/Edit form
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);

  // Bulk selection states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Bulk add multiple products states
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkAddRows, setBulkAddRows] = useState<any[]>([
    { name: '', sku: '', barcode: '', category: 'أطقم طهي وحلل', cost: 0, priceCash: 0, priceWholesale: 0, priceInstallment: 0, stock: 10 }
  ]);

  // Pricing helper functions based on settings profit margins
  const getMarginsForCategory = (catName: string) => {
    const catMargins = settings?.profitMargins?.categories?.[catName];
    const defaultMargins = settings?.profitMargins?.default || { cash: 20, wholesale: 10, installment: 30 };
    return catMargins || defaultMargins;
  };

  const calculatePricesFromCost = (costValue: number, catName: string) => {
    const margins = getMarginsForCategory(catName);
    return {
      priceCash: Math.round(costValue * (1 + margins.cash / 100)),
      priceWholesale: Math.round(costValue * (1 + margins.wholesale / 100)),
      priceInstallment: Math.round(costValue * (1 + margins.installment / 100)),
    };
  };

  const handleFormCategoryChange = (newCat: string) => {
    setFormData((prev) => {
      if (prev.cost > 0) {
        const prices = calculatePricesFromCost(prev.cost, newCat);
        return { ...prev, category: newCat, ...prices };
      }
      return { ...prev, category: newCat };
    });
  };

  const handleFormCostChange = (newCost: number) => {
    setFormData((prev) => {
      if (newCost > 0) {
        const prices = calculatePricesFromCost(newCost, prev.category);
        return { ...prev, cost: newCost, ...prices };
      }
      return { ...prev, cost: newCost };
    });
  };

  // Bulk edit form states
  const [bulkForm, setBulkForm] = useState({
    changeCategory: false,
    category: '',
    changePrices: false,
    priceType: 'all', // 'all' | 'cash' | 'installment' | 'wholesale' | 'cost'
    priceAction: 'increase', // 'increase' | 'decrease' | 'fixed'
    priceValue: 0,
    changeStock: false,
    stockAction: 'add', // 'add' | 'fixed'
    stockValue: 0,
  });

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
    barcodes: [] as string[],
  });

  // Dynamically extract unique categories from products table and settings categories
  const existingCategories = Array.from(
    new Set([
      ...(settings?.categories || []),
      ...products
        .map((p) => p.category?.trim())
        .filter((cat): cat is string => Boolean(cat && cat !== 'الكل'))
    ])
  );

  const categories = ['الكل', ...existingCategories];

  const handleBulkAddRowChange = (index: number, key: string, val: any) => {
    setBulkAddRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: val };

      // Auto-calculate prices if cost or category changes
      if (key === 'cost' || key === 'category') {
        const costVal = parseFloat(key === 'cost' ? val : updated[index].cost) || 0;
        const catName = key === 'category' ? val : updated[index].category;
        if (costVal > 0) {
          const calculated = calculatePricesFromCost(costVal, catName);
          updated[index].priceCash = calculated.priceCash;
          updated[index].priceWholesale = calculated.priceWholesale;
          updated[index].priceInstallment = calculated.priceInstallment;
        }
      }
      return updated;
    });
  };

  const addBulkAddRow = () => {
    setBulkAddRows((prev) => [
      ...prev,
      {
        name: '',
        sku: `HK-${Math.floor(100 + Math.random() * 900)}`,
        barcode: `622100${Math.floor(100000 + Math.random() * 900000)}`,
        category: lastChosenCategory,
        cost: 0,
        priceCash: 0,
        priceWholesale: 0,
        priceInstallment: 0,
        stock: 10
      }
    ]);
  };

  const removeBulkAddRow = (index: number) => {
    if (bulkAddRows.length <= 1) return;
    setBulkAddRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBulkAdd = () => {
    // Validate
    const invalidRowIndex = bulkAddRows.findIndex(row => !row.name.trim());
    if (invalidRowIndex !== -1) {
      alert(`يرجى إدخال اسم الصنف في الصف رقم ${invalidRowIndex + 1}`);
      return;
    }

    // Add each product
    bulkAddRows.forEach((row) => {
      addProduct({
        name: row.name.trim(),
        sku: row.sku.trim() || `HK-${Math.floor(100 + Math.random() * 900)}`,
        barcode: row.barcode.trim() || `622100${Math.floor(100000 + Math.random() * 900000)}`,
        category: row.category,
        priceCash: Number(row.priceCash) || 0,
        priceWholesale: Number(row.priceWholesale) || 0,
        priceInstallment: Number(row.priceInstallment) || 0,
        cost: Number(row.cost) || 0,
        stock: Number(row.stock) || 0,
        image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
        description: '',
        barcodes: []
      });
    });

    setIsBulkAddModalOpen(false);
    alert(`تمت إضافة عدد (${bulkAddRows.length}) من الأصناف الجديدة بنجاح!`);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `HK-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `622100${Math.floor(100000 + Math.random() * 900000)}`,
      category: lastChosenCategory, // Remembered category!
      priceCash: 1000,
      priceInstallment: 1250,
      priceWholesale: 900,
      cost: 700,
      stock: 15,
      image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
      description: '',
      barcodes: [],
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
      barcodes: p.barcodes || [],
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
      // Persist the last chosen category selection
      setLastChosenCategory(formData.category);
      localStorage.setItem('last_chosen_category', formData.category);
    }

    setIsModalOpen(false);
  };

  const handleApplyBulkChanges = () => {
    if (selectedProductIds.length === 0) return;

    selectedProductIds.forEach((id) => {
      const p = products.find((prod) => prod.id === id);
      if (!p) return;

      let updated = { ...p };

      if (bulkForm.changeCategory && bulkForm.category.trim()) {
        updated.category = bulkForm.category.trim();
      }

      if (bulkForm.changePrices) {
        if (bulkForm.priceAction === 'fixed') {
          if (bulkForm.priceType === 'cash') updated.priceCash = bulkForm.priceValue;
          else if (bulkForm.priceType === 'installment') updated.priceInstallment = bulkForm.priceValue;
          else if (bulkForm.priceType === 'wholesale') updated.priceWholesale = bulkForm.priceValue;
          else if (bulkForm.priceType === 'cost') updated.cost = bulkForm.priceValue;
          else {
            updated.priceCash = bulkForm.priceValue;
            updated.priceInstallment = bulkForm.priceValue;
            updated.priceWholesale = bulkForm.priceValue;
          }
        } else {
          // percentage change
          const factor = bulkForm.priceAction === 'increase' ? (1 + bulkForm.priceValue / 100) : (1 - bulkForm.priceValue / 100);
          if (bulkForm.priceType === 'cash') updated.priceCash = Math.max(0, Math.round(p.priceCash * factor));
          else if (bulkForm.priceType === 'installment') updated.priceInstallment = Math.max(0, Math.round(p.priceInstallment * factor));
          else if (bulkForm.priceType === 'wholesale') updated.priceWholesale = Math.max(0, Math.round(p.priceWholesale * factor));
          else if (bulkForm.priceType === 'cost') updated.cost = Math.max(0, Math.round(p.cost * factor));
          else {
            updated.priceCash = Math.max(0, Math.round(p.priceCash * factor));
            updated.priceInstallment = Math.max(0, Math.round(p.priceInstallment * factor));
            updated.priceWholesale = Math.max(0, Math.round(p.priceWholesale * factor));
          }
        }
      }

      if (bulkForm.changeStock) {
        updated.stock = bulkForm.stockAction === 'add' ? Math.max(0, p.stock + bulkForm.stockValue) : Math.max(0, bulkForm.stockValue);
      }

      updateProduct(updated);
    });

    // Reset selection and close
    setSelectedProductIds([]);
    setIsBulkModalOpen(false);
  };

  const handleDeleteProduct = async (p: Product) => {
    if (window.confirm(`هل أنت متأكد من حذف الصنف "${p.name}"؟ سيتم حذفه من قاعدة البيانات أيضاً.`)) {
      await deleteProduct(p.id);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedProductIds.length} صنف محدد؟ سيتم حذفها نهائياً من قاعدة البيانات.`)) {
      await bulkDeleteProducts(selectedProductIds);
      setSelectedProductIds([]);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('تنبيه هام: هل أنت متأكد من مسح وتفريغ جميع الأصناف بالكامل؟\nسيتم تفريغ السجل المحلي ومسح الأصناف في قاعدة البيانات.')) {
      await clearAllProducts();
      setSelectedProductIds([]);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3.5">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 rounded-2xl p-3.5 shadow-md">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-stone-100">
              دليل المنتجات وتسعير الأصناف
            </h1>
            <p className="text-[11px] text-stone-400">
              أسماء للأدوات المنزلية • إدخال المنتجات وضبط الأسعار (كاش - تقسيط - جملة) والتكلفة
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-2">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await refreshDataFromSupabase();
              setTimeout(() => setIsRefreshing(false), 600);
            }}
            disabled={isRefreshing}
            className="py-2 px-3.5 bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse transition-all"
            title="تحديث واستيراد كميات المخزون مباشرة من قاعدة البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'جاري المزامنة...' : 'مزامنة من قاعدة البيانات'}</span>
          </button>

          {products.length > 0 && (
            <button
              onClick={handleClearAll}
              className="py-2 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 space-x-reverse transition-all"
              title="مسح وتفريغ جميع الأصناف"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ كافة الأصناف</span>
            </button>
          )}

          <button
            onClick={() => {
              // Open Bulk Add Modal with initial row
              setBulkAddRows([
                {
                  name: '',
                  sku: `HK-${Math.floor(100 + Math.random() * 900)}`,
                  barcode: `622100${Math.floor(100000 + Math.random() * 900000)}`,
                  category: lastChosenCategory,
                  cost: 0,
                  priceCash: 0,
                  priceWholesale: 0,
                  priceInstallment: 0,
                  stock: 10
                }
              ]);
              setIsBulkAddModalOpen(true);
            }}
            className="py-2 px-3.5 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-2 space-x-reverse transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>إضافة أصناف متعددة</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-2 space-x-reverse transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col gap-4">
        
        {/* Top Row: Search Input & Layout View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="بحث بالكود، الباركود، أو اسم المنتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-200 rounded-xl pr-10 pl-8 py-2.5 focus:outline-none focus:border-amber-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 transition-colors"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="bg-stone-950 border border-stone-800 p-1 rounded-xl flex items-center space-x-1 space-x-reverse shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setLayoutMode('rows')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse ${
                layoutMode === 'rows'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="عرض كصفوف"
            >
              <List className="w-4 h-4" />
              <span className="text-[11px] font-bold">صفوف</span>
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse ${
                layoutMode === 'grid'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="عرض كشبكة كروت"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[11px] font-bold">شبكة</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Dedicated Horizontal Scrollable Categories List */}
        <div className="border-t border-stone-800/60 pt-3">
          <div className="flex items-center space-x-2 space-x-reverse mb-2 text-stone-400 text-xs font-bold">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <span>تصنيفات المنتجات:</span>
          </div>
          
          <div 
            className="flex overflow-x-auto pb-1.5 gap-2 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent" 
            style={{ 
              scrollbarWidth: 'thin', 
              scrollbarColor: '#292524 transparent',
              direction: 'rtl'
            }}
          >
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === c
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Products Catalog Display */}
      {layoutMode === 'rows' ? (
        /* Rows Layout Table */
        <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-stone-950 text-[10px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800">
                  <th className="py-2 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds(filteredProducts.map((p) => p.id));
                        } else {
                          setSelectedProductIds([]);
                        }
                      }}
                      className="rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3">الصنف والمعلومات</th>
                  <th className="py-2 px-3">القسم</th>
                  <th className="py-2 px-3 text-center">سعر الكاش</th>
                  <th className="py-2 px-3 text-center">سعر التقسيط</th>
                  <th className="py-2 px-3 text-center">سعر الجملة</th>
                  <th className="py-2 px-3 text-center">التكلفة</th>
                  <th className="py-2 px-3 text-center">المخزون</th>
                  <th className="py-2 px-3 text-center">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 text-xs text-stone-200">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= 5;
                  const isSelected = selectedProductIds.includes(p.id);
                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-stone-950/50 transition-colors ${isSelected ? 'bg-amber-600/5 hover:bg-amber-650/10' : ''}`}
                    >
                      <td className="py-1.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProductIds([...selectedProductIds, p.id]);
                            } else {
                              setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded bg-stone-950 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center space-x-2.5 space-x-reverse">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-stone-100">{p.name}</h3>
                            <p className="text-[9px] text-stone-500 font-mono mt-0.5 flex flex-wrap items-center gap-1">
                              <span>كود: {p.sku} | باركود: {p.barcode}</span>
                              {p.barcodes && p.barcodes.length > 0 && (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] font-sans font-extrabold px-1 rounded-sm" title={p.barcodes.join(' - ')}>
                                  +{p.barcodes.length} أكواد
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-[9px] bg-stone-950 text-stone-300 border border-stone-800 px-1.5 py-0.2 rounded font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {(p.priceCash || 0).toLocaleString()} ج.م
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-amber-400 whitespace-nowrap">
                        {(p.priceInstallment || 0).toLocaleString()} ج.م
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-indigo-400 whitespace-nowrap">
                        {(p.priceWholesale || 0).toLocaleString()} ج.م
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-stone-400 whitespace-nowrap">
                        {p.cost || 0} ج.م
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                            isLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                          }`}
                        >
                          {p.stock} قطعة
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => setLabelProduct(p)}
                            className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse"
                            title="طباعة ملصق السعر والباركود"
                          >
                            <Printer className="w-3 h-3" />
                            <span>ملصق السعر</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="px-2 py-0.5 bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-800 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse"
                          >
                            <Edit className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse"
                            title="حذف الصنف نهائياً"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="py-12 text-center text-stone-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-stone-600 stroke-1" />
                <p className="text-sm font-bold text-stone-300">لا توجد أصناف معروضة حالياً</p>
                <p className="text-xs text-stone-500">
                  {products.length === 0 
                    ? 'قاعدة البيانات فارغة من الأصناف. يمكنك إضافة أصناف جديدة بالضغط على "إضافة صنف جديد" أو "إضافة أصناف متعددة".'
                    : 'لا توجد نتائج تطابق البحث أو التصنيف المحدد.'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid Layout Cards */
        filteredProducts.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl py-12 text-center text-stone-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-stone-600 stroke-1" />
            <p className="text-sm font-bold text-stone-300">لا توجد أصناف معروضة حالياً</p>
            <p className="text-xs text-stone-500">
              {products.length === 0 
                ? 'قاعدة البيانات فارغة من الأصناف. يمكنك إضافة أصناف جديدة بالضغط على "إضافة صنف جديد".'
                : 'لا توجد نتائج تطابق البحث أو التصنيف المحدد.'}
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredProducts.map((p) => {
            const isLow = p.stock <= 5;
            const isSelected = selectedProductIds.includes(p.id);

            return (
              <div
                key={p.id}
                className={`bg-stone-900 border hover:border-amber-500/40 rounded-xl p-2.5 shadow-sm flex flex-col justify-between space-y-2 transition-all ${
                  isSelected ? 'border-amber-500/85 ring-1 ring-amber-500/30 bg-stone-900/90' : 'border-stone-800'
                }`}
              >
                <div>
                  <div className="flex items-start space-x-2.5 space-x-reverse mb-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds([...selectedProductIds, p.id]);
                        } else {
                          setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                        }
                      }}
                      className="mt-1 rounded bg-stone-950 border border-stone-800 text-amber-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-8.5 h-8.5 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] bg-stone-950 text-stone-400 border border-stone-800/80 px-1.5 py-0.2 rounded font-bold uppercase inline-block mb-0.5 truncate max-w-full">
                        {p.category}
                      </span>
                      <h3 className="text-xs font-bold text-stone-100 line-clamp-1">{p.name}</h3>
                      <p className="text-[8px] text-stone-500 font-mono flex flex-wrap items-center gap-1">
                        <span>كود: {p.sku} | باركود: {p.barcode}</span>
                      </p>
                    </div>
                  </div>

                  {/* 3 Price Tiers Grid - Compact */}
                  <div className="bg-stone-950 border border-stone-800/80 rounded-lg p-1.5 grid grid-cols-3 gap-0.5 text-center text-[9px] mb-1.5">
                    <div>
                      <span className="text-[8px] text-emerald-400 font-bold block">كاش</span>
                      <span className="font-mono font-bold text-stone-100">
                        {(p.priceCash || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[8px] text-amber-400 font-bold block">تقسيط</span>
                      <span className="font-mono font-bold text-stone-100">
                        {(p.priceInstallment || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[8px] text-indigo-400 font-bold block">جملة</span>
                      <span className="font-mono font-bold text-stone-100">
                        {(p.priceWholesale || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Profit Margin & Stock - Compact */}
                  <div className="flex justify-between items-center text-[9px] text-stone-400 bg-stone-950/40 px-1.5 py-1 rounded-md border border-stone-800/60">
                    <span className="font-mono text-stone-400">
                      تكلفة: <strong className="text-stone-300">{p.cost || 0}</strong> ج.م
                    </span>

                    <span
                      className={`px-1 py-0.2 rounded font-mono font-bold text-[9px] ${
                        isLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-emerald-400'
                      }`}
                    >
                      مخزون: {p.stock}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1">
                  <button
                    onClick={() => setLabelProduct(p)}
                    className="py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center space-x-1 space-x-reverse"
                    title="طباعة ملصق السعر والباركود"
                  >
                    <Printer className="w-2.5 h-2.5" />
                    <span>ملصق</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="py-1 bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-800 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center space-x-1 space-x-reverse"
                  >
                    <Edit className="w-2.5 h-2.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p)}
                    className="py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center space-x-1 space-x-reverse"
                    title="حذف الصنف"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>حذف</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
        )
      )}

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

              {/* Additional Barcodes Section */}
              <div className="bg-stone-950 border border-stone-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-400">
                    أكواد وباركودات إضافية بديلة للمنتج
                  </span>
                  <span className="text-[10px] text-stone-500">
                    (تسمح بالبحث والبيع بأكثر من كود)
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اكتب كود إضافي ثم اضغط إضافة أو Enter..."
                    id="new-extra-barcode"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !formData.barcodes.includes(val)) {
                          setFormData({
                            ...formData,
                            barcodes: [...formData.barcodes, val]
                          });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 font-mono text-stone-100 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('new-extra-barcode') as HTMLInputElement | null;
                      const val = input?.value?.trim();
                      if (val && input && !formData.barcodes.includes(val)) {
                        setFormData({
                          ...formData,
                          barcodes: [...formData.barcodes, val]
                        });
                        input.value = '';
                      }
                    }}
                    className="px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    إضافة +
                  </button>
                </div>

                {formData.barcodes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.barcodes.map((code) => (
                      <span
                        key={code}
                        className="bg-stone-900 border border-stone-800 text-stone-300 font-mono text-[11px] px-2.5 py-1 rounded-lg flex items-center space-x-1.5 space-x-reverse"
                      >
                        <span>{code}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              barcodes: formData.barcodes.filter((b) => b !== code)
                            });
                          }}
                          className="text-stone-500 hover:text-rose-400 font-extrabold text-xs cursor-pointer"
                          title="حذف هذا الكود"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-500">لا يوجد أكواد إضافية بديلة حالياً.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-stone-400 mb-1 font-bold">القسم / التصنيف</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => handleFormCategoryChange(e.target.value)}
                      onFocus={() => setIsCatDropdownOpen(true)}
                      placeholder="اختر أو اكتب قسماً جديداً..."
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 font-bold text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                      className="px-3 bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors text-xs"
                      title="عرض الأقسام الحالية"
                    >
                      ▼
                    </button>
                  </div>
                  
                  {isCatDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsCatDropdownOpen(false)} 
                      />
                      <div className="absolute left-0 right-0 mt-1 bg-stone-950 border border-stone-800 rounded-xl max-h-48 overflow-y-auto z-50 p-1 shadow-2xl divide-y divide-stone-900/40 scrollbar-thin">
                        <div className="text-[10px] text-stone-500 px-2.5 py-1.5 font-bold">الأقسام الحالية (اختر من القائمة):</div>
                        {existingCategories.length > 0 ? (
                          existingCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                handleFormCategoryChange(cat);
                                setIsCatDropdownOpen(false);
                              }}
                              className={`w-full text-right px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                formData.category === cat 
                                  ? 'bg-amber-600/20 text-amber-400 font-bold' 
                                  : 'text-stone-300 hover:bg-stone-900 hover:text-stone-100'
                              }`}
                            >
                              <span>{cat}</span>
                              {formData.category === cat && <Check className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                          ))
                        ) : (
                          <div className="text-stone-500 text-[10px] p-2 text-center">لا توجد أقسام حالياً. اكتب قسماً جديداً بالأعلى.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">سعر التكلفة (ج.م)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) =>
                      handleFormCostChange(parseFloat(e.target.value) || 0)
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

      {/* Product Price & Barcode Label Modal */}
      {(labelProduct || (labelProducts && labelProducts.length > 0)) && (
        <ProductLabelModal
          product={labelProduct}
          products={labelProducts}
          isOpen={!!labelProduct || !!(labelProducts && labelProducts.length > 0)}
          onClose={() => {
            setLabelProduct(null);
            setLabelProducts(null);
          }}
        />
      )}

      {/* Floating Bulk Actions Panel */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl bg-stone-900 border border-amber-500/50 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-40 transition-all duration-300">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div className="text-stone-200">
              <span className="text-xs font-bold block">
                تم تحديد <strong className="text-amber-400 font-extrabold text-sm">{selectedProductIds.length}</strong> من الأصناف
              </span>
              <span className="text-[10px] text-stone-400">
                يمكنك طباعة ملصقات الباركود والسعر بناءً على رصيد المخزون، أو التعديل الجماعي للبيانات.
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 space-x-reverse shrink-0">
            <button
              onClick={() => {
                const selectedProds = products.filter((p) => selectedProductIds.includes(p.id));
                setLabelProducts(selectedProds);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl shadow-md transition-colors flex items-center space-x-1.5 space-x-reverse"
              title="طباعة ملصقات باركود وسعر للأصناف المحددة بعدد مساوي لرصيد كل منها بالمخزن"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة ملصقات الرصيد ({selectedProductIds.length})</span>
            </button>

            <button
              onClick={() => {
                setBulkForm({
                  changeCategory: false,
                  category: '',
                  changePrices: false,
                  priceType: 'all',
                  priceAction: 'increase',
                  priceValue: 0,
                  changeStock: false,
                  stockAction: 'add',
                  stockValue: 0,
                });
                setIsBulkModalOpen(true);
              }}
              className="px-3.5 py-2 bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-bold rounded-xl border border-stone-800 transition-colors flex items-center space-x-1.5 space-x-reverse"
            >
              <Edit className="w-3.5 h-3.5 text-stone-400" />
              <span>تعديل جماعي</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 space-x-reverse"
              title="حذف الأصناف المحددة نهائياً"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المحدد ({selectedProductIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-2 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-white text-xs font-bold rounded-xl border border-stone-800 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-stone-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-black mb-1 flex items-center space-x-2 space-x-reverse text-amber-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>تعديل جماعي للأصناف المحددة</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4">
              سيتم تطبيق التعديلات التي تختارها على عدد ({selectedProductIds.length}) من المنتجات المحددة في نفس الوقت.
            </p>

            <div className="space-y-4 text-xs text-stone-300">
              
              {/* SECTION 1: Category Change */}
              <div className="border border-stone-800 bg-stone-950/40 p-3.5 rounded-2xl space-y-3">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer font-bold text-amber-400">
                  <input
                    type="checkbox"
                    checked={bulkForm.changeCategory}
                    onChange={(e) => setBulkForm({ ...bulkForm, changeCategory: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0"
                  />
                  <span>تعديل القسم / التصنيف</span>
                </label>
                
                {bulkForm.changeCategory && (
                  <div className="relative pt-1 pl-6">
                    <label className="block text-stone-400 mb-1">اختر القسم الجديد للأصناف المحددة:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        value={bulkForm.category}
                        onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}
                        onFocus={() => setIsCatDropdownOpen(true)}
                        placeholder="اختر قسماً أو اكتب قسماً جديداً..."
                        className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                        className="px-3 bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors"
                      >
                        ▼
                      </button>
                    </div>

                    {isCatDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsCatDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-stone-950 border border-stone-800 rounded-xl max-h-40 overflow-y-auto z-50 p-1 shadow-xl">
                          {existingCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setBulkForm({ ...bulkForm, category: cat });
                                setIsCatDropdownOpen(false);
                              }}
                              className="w-full text-right px-2.5 py-1.5 text-xs rounded-lg text-stone-300 hover:bg-stone-900 hover:text-stone-100"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Price adjustments */}
              <div className="border border-stone-800 bg-stone-950/40 p-3.5 rounded-2xl space-y-3">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer font-bold text-amber-400">
                  <input
                    type="checkbox"
                    checked={bulkForm.changePrices}
                    onChange={(e) => setBulkForm({ ...bulkForm, changePrices: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0"
                  />
                  <span>تعديل أسعار البيع والتكلفة</span>
                </label>

                {bulkForm.changePrices && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 pl-6">
                    <div>
                      <label className="block text-stone-400 mb-1 font-bold">السعر المستهدف:</label>
                      <select
                        value={bulkForm.priceType}
                        onChange={(e) => setBulkForm({ ...bulkForm, priceType: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-stone-100 focus:outline-none"
                      >
                        <option value="all">جميع أسعار البيع</option>
                        <option value="cash">سعر الكاش فقط</option>
                        <option value="installment">سعر التقسيط فقط</option>
                        <option value="wholesale">سعر الجملة فقط</option>
                        <option value="cost">سعر التكلفة فقط</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-stone-400 mb-1 font-bold">نوع التعديل:</label>
                      <select
                        value={bulkForm.priceAction}
                        onChange={(e) => setBulkForm({ ...bulkForm, priceAction: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-stone-100 focus:outline-none"
                      >
                        <option value="increase">زيادة بنسبة (%)</option>
                        <option value="decrease">خصم بنسبة (%)</option>
                        <option value="fixed">تعيين قيمة ثابتة (ج.م)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-stone-400 mb-1 font-bold">القيمة / النسبة:</label>
                      <input
                        type="number"
                        value={bulkForm.priceValue || ''}
                        onChange={(e) => setBulkForm({ ...bulkForm, priceValue: parseFloat(e.target.value) || 0 })}
                        placeholder={bulkForm.priceAction === 'fixed' ? 'أدخل القيمة ج.م' : 'مثال: 10 أو 15%'}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Stock Adjustments */}
              <div className="border border-stone-800 bg-stone-950/40 p-3.5 rounded-2xl space-y-3">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer font-bold text-amber-400">
                  <input
                    type="checkbox"
                    checked={bulkForm.changeStock}
                    onChange={(e) => setBulkForm({ ...bulkForm, changeStock: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0"
                  />
                  <span>تعديل كمية المخزون</span>
                </label>

                {bulkForm.changeStock && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-6">
                    <div>
                      <label className="block text-stone-400 mb-1 font-bold">نوع تعديل المخزون:</label>
                      <select
                        value={bulkForm.stockAction}
                        onChange={(e) => setBulkForm({ ...bulkForm, stockAction: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 focus:outline-none"
                      >
                        <option value="add">إضافة كمية للمخزون الحالي (+)</option>
                        <option value="fixed">تعيين كمية ثابتة جديدة (=)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-stone-400 mb-1 font-bold">القيمة / الكمية:</label>
                      <input
                        type="number"
                        value={bulkForm.stockValue || ''}
                        onChange={(e) => setBulkForm({ ...bulkForm, stockValue: parseInt(e.target.value) || 0 })}
                        placeholder="أدخل عدد القطع"
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex space-x-3 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={handleApplyBulkChanges}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm"
                >
                  تطبيق التعديلات على الأصناف المحددة ({selectedProductIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-6 py-3 bg-stone-950 hover:bg-stone-850 text-stone-300 border border-stone-800 rounded-xl font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MULTIPLE PRODUCTS BULK ADD MODAL */}
      {isBulkAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => {
              if (confirm('هل أنت متأكد من الخروج وإلغاء إدخال هذه الأصناف؟')) {
                setIsBulkAddModalOpen(false);
              }
            }}
          />
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
            <div className="relative transform overflow-hidden rounded-3xl bg-stone-900 border border-stone-800 text-right shadow-2xl transition-all max-w-7xl w-full p-6 space-y-4">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-stone-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white flex items-center space-x-2 space-x-reverse">
                    <FolderPlus className="w-5 h-5 text-amber-500" />
                    <span>إضافة أصناف متعددة في نفس الوقت</span>
                  </h3>
                  <p className="text-[11px] text-stone-400 mt-1">
                    أدخل بيانات الأصناف الجديدة معاً. عند كتابة <strong>سعر التكلفة</strong>، سيقوم النظام تلقائياً باحتساب أسعار البيع طبقاً لنسب الربح المحددة في الإعدادات لكل تصنيف.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('هل أنت متأكد من الخروج وإلغاء إدخال هذه الأصناف؟')) {
                      setIsBulkAddModalOpen(false);
                    }
                  }}
                  className="p-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto max-h-[50vh] border border-stone-800 rounded-2xl scrollbar-thin">
                <table className="w-full text-right border-collapse text-xs min-w-[1100px]">
                  <thead>
                    <tr className="bg-stone-950 text-stone-400 font-extrabold border-b border-stone-800">
                      <th className="py-3 px-3 w-[25px] text-center">#</th>
                      <th className="py-3 px-3 min-w-[200px]">اسم الصنف / المنتج *</th>
                      <th className="py-3 px-3 w-[120px]">كود SKU</th>
                      <th className="py-3 px-3 w-[140px]">الباركود الدولي</th>
                      <th className="py-3 px-3 w-[160px]">القسم / التصنيف</th>
                      <th className="py-3 px-3 w-[100px] text-center">سعر التكلفة</th>
                      <th className="py-3 px-3 w-[100px] text-center">سعر الكاش</th>
                      <th className="py-3 px-3 w-[100px] text-center">سعر الجملة</th>
                      <th className="py-3 px-3 w-[100px] text-center">سعر التقسيط</th>
                      <th className="py-3 px-3 w-[80px] text-center">الكمية</th>
                      <th className="py-3 px-3 w-[50px] text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {bulkAddRows.map((row, index) => (
                      <tr key={index} className="hover:bg-stone-950/20">
                        <td className="py-2 px-3 text-center text-stone-500 font-mono font-bold">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            placeholder="مثال: طقم حلل تيفال 10 قطع"
                            value={row.name}
                            onChange={(e) => handleBulkAddRowChange(index, 'name', e.target.value)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.sku}
                            placeholder="كود SKU"
                            onChange={(e) => handleBulkAddRowChange(index, 'sku', e.target.value)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 font-mono text-stone-300 text-[11px] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.barcode}
                            placeholder="الباركود"
                            onChange={(e) => handleBulkAddRowChange(index, 'barcode', e.target.value)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 font-mono text-stone-300 text-[11px] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.category}
                            onChange={(e) => handleBulkAddRowChange(index, 'category', e.target.value)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 font-bold focus:outline-none"
                          >
                            {existingCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.cost || ''}
                            onChange={(e) => handleBulkAddRowChange(index, 'cost', parseFloat(e.target.value) || 0)}
                            placeholder="التكلفة"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-stone-100 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.priceCash || ''}
                            onChange={(e) => handleBulkAddRowChange(index, 'priceCash', parseFloat(e.target.value) || 0)}
                            placeholder="الكاش"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-emerald-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.priceWholesale || ''}
                            onChange={(e) => handleBulkAddRowChange(index, 'priceWholesale', parseFloat(e.target.value) || 0)}
                            placeholder="الجملة"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-amber-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.priceInstallment || ''}
                            onChange={(e) => handleBulkAddRowChange(index, 'priceInstallment', parseFloat(e.target.value) || 0)}
                            placeholder="التقسيط"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-indigo-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.stock}
                            onChange={(e) => handleBulkAddRowChange(index, 'stock', parseInt(e.target.value) || 0)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-stone-100 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeBulkAddRow(index)}
                            disabled={bulkAddRows.length <= 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              bulkAddRows.length <= 1
                                ? 'text-stone-600 cursor-not-allowed'
                                : 'text-stone-400 hover:text-rose-400 hover:bg-stone-800'
                            }`}
                            title="حذف هذا الصف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons Below Table */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addBulkAddRow}
                  className="w-full sm:w-auto py-2.5 px-5 bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <Plus className="w-4 h-4 text-amber-500" />
                  <span>إضافة صنف جديد في القائمة</span>
                </button>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="text-[11px] text-stone-400">عدد الأصناف المقترح إضافتها:</span>
                  <span className="bg-amber-950 text-amber-400 border border-amber-800/80 px-2.5 py-1 rounded-lg font-mono font-bold text-xs">
                    {bulkAddRows.length} صنف
                  </span>
                </div>
              </div>

              {/* Footer Save / Cancel */}
              <div className="flex space-x-3 space-x-reverse border-t border-stone-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={handleSaveBulkAdd}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg transition-all text-xs flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>حفظ جميع الأصناف الجديدة في قاعدة البيانات ({bulkAddRows.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('هل أنت متأكد من الخروج وإلغاء إدخال هذه الأصناف؟')) {
                      setIsBulkAddModalOpen(false);
                    }
                  }}
                  className="px-6 py-3 bg-stone-950 hover:bg-stone-850 text-stone-300 border border-stone-800 rounded-xl font-bold transition-all text-xs"
                >
                  إلغاء
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CatalogView;
