import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product, ProductDiscount } from '../../types';
import { 
  Percent, 
  Tag, 
  Trash2, 
  Plus, 
  Search, 
  Package, 
  Check, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';

export const DiscountsView: React.FC = () => {
  const { 
    products, 
    discounts, 
    addDiscount, 
    removeDiscount 
  } = usePOS();

  // Search states for selecting products
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form states
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [applyTo, setApplyTo] = useState<'cash' | 'installment' | 'both'>('both');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search filter for products
  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return false; // Only show dropdown if user started typing
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  });

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setIsDropdownOpen(false);
    setErrorMsg('');
    setSuccessMsg('');
    
    // Check if product already has a discount, pre-fill it!
    const existing = discounts.find(d => d.productId === product.id);
    if (existing) {
      setDiscountType(existing.type);
      setDiscountValue(existing.value);
      setApplyTo(existing.applyTo || 'both');
    } else {
      setDiscountValue(0);
      setApplyTo('both');
    }
  };

  const handleSaveDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg('يرجى تحديد صنف أولاً لتطبيق الخصم عليه.');
      return;
    }

    if (discountValue <= 0) {
      setErrorMsg('يرجى إدخال قيمة خصم صالحة أكبر من الصفر.');
      return;
    }

    // Validation checks based on price
    if (discountType === 'percentage' && discountValue > 100) {
      setErrorMsg('لا يمكن أن يتجاوز الخصم المئوي 100%.');
      return;
    }

    if (discountType === 'amount' && discountValue >= selectedProduct.priceCash) {
      setErrorMsg(`مبلغ الخصم (${discountValue} ج.م) لا يمكن أن يساوي أو يتجاوز سعر المنتج الحالي الكاش (${selectedProduct.priceCash} ج.م).`);
      return;
    }

    const newDiscount: ProductDiscount = {
      productId: selectedProduct.id,
      type: discountType,
      value: Number(discountValue),
      isActive: true,
      applyTo: applyTo
    };

    addDiscount(newDiscount);
    setSuccessMsg(`تم بنجاح حفظ الخصم المطبق على صنف (${selectedProduct.name}).`);
    setErrorMsg('');
    
    // Reset selection fields
    setSelectedProduct(null);
    setProductSearch('');
    setDiscountValue(0);
    setApplyTo('both');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 dir-rtl text-right">
      
      {/* Header section with negative space and elegant typography */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Percent className="w-6 h-6 text-amber-500" />
            <span>قسم إدارة الخصومات والعروض</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1.5">
            تطبيق خصومات مباشرة على أصناف محددة بنسبة مئوية أو بمبلغ ثابت يتم خصمها تلقائياً عند البيع
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Right side: Apply a discount form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-white mb-5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>تطبيق خصم جديد على صنف</span>
            </h2>

            <form onSubmit={handleSaveDiscount} className="space-y-5">
              
              {/* Product Selection Input */}
              <div className="relative">
                <label className="block text-xs font-bold text-stone-300 mb-2">البحث عن الصنف المستهدف</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="ابحث باسم المنتج، كود SKU، أو الباركود..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (!e.target.value) {
                        setSelectedProduct(null);
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-3 text-xs text-stone-100 placeholder-stone-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Dropdown Menu for search results */}
                {isDropdownOpen && productSearch.trim() && (
                  <div className="absolute left-0 right-0 mt-1 bg-stone-950 border border-stone-800 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p, idx) => (
                        <div
                          key={p.id ? `disc_search_${p.id}_${idx}` : `disc_search_${idx}`}
                          onClick={() => handleSelectProduct(p)}
                          className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-stone-900 text-xs text-stone-300 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-stone-100 block">{p.name}</span>
                            <span className="text-[10px] text-stone-500 block mt-0.5">كود SKU: {p.sku} | المتاح: {p.stock} قطعة</span>
                          </div>
                          <span className="font-mono font-bold text-amber-500 bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-md">
                            {p.priceCash} ج.م
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-stone-500">
                        لا توجد نتائج مطابقة لبحثك
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Product Summary Card */}
              {selectedProduct && (
                <div className="bg-stone-950/60 border border-stone-800/80 p-4 rounded-2xl flex items-center space-x-3 space-x-reverse animate-in fade-in slide-in-from-top-2 duration-150">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded-xl object-cover border border-stone-850"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-stone-100 block truncate">{selectedProduct.name}</span>
                    <div className="flex space-x-2 space-x-reverse mt-1 text-[10px] text-stone-400">
                      <span>سعر الكاش: <strong className="text-white">{selectedProduct.priceCash} ج.م</strong></span>
                      <span>•</span>
                      <span>سعر الجملة: <strong className="text-white">{selectedProduct.priceWholesale} ج.م</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Discount Type Radio Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-2">نوع الخصم المطبق</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`py-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      discountType === 'percentage'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-stone-950 border-stone-850 text-stone-400 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span>نسبة مئوية (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`py-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      discountType === 'amount'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-stone-950 border-stone-850 text-stone-400 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>مبلغ مالي ثابت (ج.م)</span>
                  </button>
                </div>
              </div>

              {/* Discount Value Input */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-2">قيمة الخصم</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder={discountType === 'percentage' ? 'مثال: 15 (وتعني 15%)' : 'مثال: 100 (وتعني خصم 100 ج.م)'}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-xs text-stone-100 placeholder-stone-500 focus:outline-none font-bold"
                  />
                  <span className="absolute left-4 top-3 text-xs font-bold text-stone-400">
                    {discountType === 'percentage' ? '%' : 'ج.م'}
                  </span>
                </div>
              </div>

              {/* Apply To Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-2">تطبيق الخصم على</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setApplyTo('cash')}
                    className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold border text-center transition-all ${
                      applyTo === 'cash'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-stone-950 border-stone-850 text-stone-400 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                  >
                    <span>الكاش فقط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplyTo('installment')}
                    className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold border text-center transition-all ${
                      applyTo === 'installment'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-stone-950 border-stone-850 text-stone-400 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                  >
                    <span>القسط فقط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplyTo('both')}
                    className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold border text-center transition-all ${
                      applyTo === 'both'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-stone-950 border-stone-850 text-stone-400 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                  >
                    <span>الكاش والقسط</span>
                  </button>
                </div>
              </div>

              {/* Status Alert Messages */}
              {errorMsg && (
                <div className="bg-rose-950/20 border border-rose-900/40 text-rose-400 p-3 rounded-2xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 p-3 rounded-2xl text-xs flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Save Button */}
              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>حفظ وتطبيق الخصم</span>
              </button>

            </form>
          </div>
        </div>

        {/* Left side: Active discounts list */}
        <div className="lg:col-span-7">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl min-h-[450px] flex flex-col">
            <h2 className="text-base font-extrabold text-white mb-5 flex items-center gap-2">
              <Package className="w-4 h-4 text-stone-400" />
              <span>الأصناف النشطة المطبق عليها خصم حالياً</span>
              <span className="text-stone-500 font-mono text-xs">({discounts.length})</span>
            </h2>

            {discounts.length > 0 ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="text-stone-400 border-b border-stone-800">
                      <th className="pb-3 pt-1 font-bold">الصنف والوصف</th>
                      <th className="pb-3 pt-1 text-center font-bold">السعر الأصلي</th>
                      <th className="pb-3 pt-1 text-center font-bold">الخصم المطبق</th>
                      <th className="pb-3 pt-1 text-center font-bold">السعر بعد الخصم</th>
                      <th className="pb-3 pt-1 text-left font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {discounts.map((disc, idx) => {
                      const prod = products.find((p) => p.id === disc.productId);
                      if (!prod) return null;

                      let originalPrice = prod.priceCash;
                      let priceLabel = 'كاش';
                      if (disc.applyTo === 'installment') {
                        originalPrice = prod.priceInstallment || 0;
                        priceLabel = 'قسط';
                      }

                      let discountedPrice = originalPrice;
                      if (disc.type === 'percentage') {
                        discountedPrice = Math.max(0, originalPrice * (1 - disc.value / 100));
                      } else {
                        discountedPrice = Math.max(0, originalPrice - disc.value);
                      }

                      return (
                        <tr key={disc.productId ? `disc_${disc.productId}_${disc.applyTo || ''}_${idx}` : `disc_${idx}`} className="hover:bg-stone-950/20 text-stone-300">
                          <td className="py-3.5 pr-1">
                            <div className="flex items-center gap-3">
                              <img
                                src={prod.image}
                                alt={prod.name}
                                className="w-10 h-10 rounded-xl object-cover border border-stone-800"
                              />
                              <div>
                                <span className="font-extrabold text-stone-100 block leading-normal">{prod.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-stone-500 font-mono">SKU: {prod.sku}</span>
                                  <span className="text-[10px] text-stone-500">•</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    disc.applyTo === 'cash' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                                    disc.applyTo === 'installment' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30' :
                                    'bg-stone-800 text-stone-300 border border-stone-700/50'
                                  }`}>
                                    {disc.applyTo === 'cash' ? 'كاش فقط' :
                                     disc.applyTo === 'installment' ? 'قسط فقط' :
                                     'كاش وقسط'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 text-center font-mono font-medium text-stone-400">
                            {originalPrice.toLocaleString()} ج.م <span className="text-[10px] text-stone-500">({priceLabel})</span>
                          </td>
                          <td className="py-3.5 text-center font-bold text-emerald-500">
                            {disc.type === 'percentage' ? (
                              <span className="bg-emerald-950/50 border border-emerald-900/30 px-2 py-0.5 rounded-lg">
                                %{disc.value} خصم
                              </span>
                            ) : (
                              <span className="bg-emerald-950/50 border border-emerald-900/30 px-2 py-0.5 rounded-lg">
                                -{disc.value} ج.م
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-center font-mono font-black text-white">
                            {discountedPrice.toLocaleString()} ج.م <span className="text-[10px] text-stone-500">({priceLabel})</span>
                          </td>
                          <td className="py-3.5 text-left pl-1">
                            <button
                              onClick={() => removeDiscount(disc.productId)}
                              className="p-2 bg-rose-950/40 text-rose-400 hover:text-white hover:bg-rose-600 rounded-xl transition-all"
                              title="حذف الخصم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
                <div className="w-16 h-16 rounded-full bg-stone-950 border border-stone-850 flex items-center justify-center text-stone-400 mb-4 shadow-sm">
                  <Percent className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-stone-300 text-sm">لا توجد خصومات مطبقة حالياً</h3>
                <p className="text-stone-500 max-w-sm text-xs mt-1 leading-normal">
                  استخدم النموذج الجانبي لاختيار منتج وتطبيق نسبة مئوية أو قيمة مخصومة عليه.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default DiscountsView;
