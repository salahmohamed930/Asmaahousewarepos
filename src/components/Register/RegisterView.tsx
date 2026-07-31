import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product, Transaction, PriceTier } from '../../types';
import { Search, Barcode, Plus, Check, Tag, Package } from 'lucide-react';
import CartSidebar from './CartSidebar';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';

export const RegisterView: React.FC = () => {
  const { products, addToCart, globalPriceTier, setGlobalPriceTier } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  const categories = [
    'الكل',
    'أطقم طهي وحلل',
    'أجهزة كهربائية صغيرة',
    'أطقم سفرة وكاسات',
    'ملاعق وأدوات مائدة',
  ];

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedProduct = products.find(
      (p) =>
        p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (matchedProduct) {
      triggerAddToCart(matchedProduct);
      setBarcodeInput('');
    } else {
      alert(`لم يتم العثور على منتج برقم باركود أو كود: "${barcodeInput}"`);
    }
  };

  const triggerAddToCart = (product: Product) => {
    addToCart(product, 1);
    setAddedAnimationId(product.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 500);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);

    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 dir-rtl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Dominant Invoice Panel (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 sticky top-20">
          <CartSidebar onOpenCheckout={() => setIsPaymentOpen(true)} />
        </div>

        {/* Secondary Product Selector Catalog (4 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          
          {/* Header Barcode & Search Controls */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 shadow-xl space-y-3">
            
            <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-amber-400 mb-1">
              <Package className="w-4 h-4" />
              <span>كتالوج أصناف أسماء للأدوات المنزلية</span>
            </div>

            {/* Product Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="بحث باسم المنتج، الكود، أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
              />
            </div>

            {/* Barcode Fast Scanner Input */}
            <form onSubmit={handleBarcodeScan} className="relative">
              <Barcode className="w-4 h-4 text-amber-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="ماسح الباركود (اضغط Enter)"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-2.5 text-xs font-mono text-stone-100 placeholder-stone-500 focus:outline-none"
              />
            </form>

            {/* Quick Price Tier Banner */}
            <div className="bg-stone-950 border border-stone-800 p-2 rounded-2xl space-y-1.5 text-xs">
              <span className="font-bold text-stone-300 flex items-center space-x-1 space-x-reverse">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>نظام التسعير المعتمد بالفاتورة:</span>
              </span>

              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'cash', label: 'كاش 💵' },
                  { id: 'installment', label: 'تقسيط 📅' },
                  { id: 'wholesale', label: 'جملة 📦' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setGlobalPriceTier(tier.id as PriceTier)}
                    className={`py-1 rounded-xl font-bold text-[11px] transition-all text-center ${
                      globalPriceTier === tier.id
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex overflow-x-auto space-x-1.5 space-x-reverse pt-1 pb-0.5 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800/80 hover:bg-stone-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

          </div>

          {/* Compact Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const isLowStock = product.stock <= 5;
              const isOutOfStock = product.stock === 0;
              const isJustAdded = addedAnimationId === product.id;

              const activePrice =
                globalPriceTier === 'cash'
                  ? product.priceCash
                  : globalPriceTier === 'installment'
                  ? product.priceInstallment
                  : product.priceWholesale;

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && triggerAddToCart(product)}
                  className={`bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-2.5 flex flex-col justify-between transition-all group cursor-pointer relative shadow-sm hover:shadow-md ${
                    isJustAdded ? 'scale-[0.98] border-amber-500 ring-2 ring-amber-500/40' : ''
                  }`}
                >
                  <div>
                    {/* Item Image Card */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-950 mb-2 border border-stone-800">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <span className="absolute top-1 right-1 text-[8px] font-bold bg-stone-950/90 text-stone-300 px-1.5 py-0.5 rounded border border-stone-800">
                        {product.category}
                      </span>

                      {/* Stock Badge */}
                      <span
                        className={`absolute bottom-1 left-1 text-[8px] font-mono px-1 py-0.5 rounded font-bold ${
                          isOutOfStock
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isLowStock
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-stone-950/80 text-stone-400 border border-stone-800'
                        }`}
                      >
                        {isOutOfStock ? 'نفد' : `متبقي: ${product.stock}`}
                      </span>
                    </div>

                    {/* Title & SKU */}
                    <h3 className="text-xs font-bold text-stone-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[9px] text-stone-500 font-mono">{product.sku}</p>

                  </div>

                  {/* Active Selected Price & Add Trigger */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-800/80">
                    <div>
                      <span className="text-[10px] font-mono font-extrabold text-amber-400 block">
                        {activePrice.toLocaleString()} ج.م
                      </span>
                    </div>

                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOutOfStock) triggerAddToCart(product);
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-all ${
                        isJustAdded
                          ? 'bg-amber-500 text-white'
                          : isOutOfStock
                          ? 'bg-stone-800 text-stone-600'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                      }`}
                    >
                      {isJustAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">إضافة</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={(tx) => {
          setIsPaymentOpen(false);
          setCompletedTransaction(tx);
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        transaction={completedTransaction}
        onClose={() => setCompletedTransaction(null)}
      />

    </div>
  );
};

export default RegisterView;
