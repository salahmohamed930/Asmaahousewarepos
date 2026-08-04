import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product, Transaction, PriceTier } from '../../types';
import {
  Search,
  Barcode,
  Plus,
  Check,
  Tag,
  Package,
  FileText,
  Filter,
  Calendar,
  CreditCard,
  ArrowRight,
  Printer,
  Eye,
  Trash2,
  Clock,
  RotateCcw,
  User,
  Hash,
  X,
  Users,
} from 'lucide-react';
import CartSidebar from './CartSidebar';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';

export const RegisterView: React.FC = () => {
  const {
    products,
    addToCart,
    globalPriceTier,
    setGlobalPriceTier,
    transactions,
    voidTransaction,
    restoreHeldTransaction,
    deleteTransaction,
    associates,
    currentAssociate,
    quickSwitchByPin,
    cart,
  } = usePOS();

  // Mode state: DEFAULT TO 'history' AS REQUESTED!
  const [viewMode, setViewMode] = useState<'history' | 'create'>('history');

  // Mobile Sub Tab state inside creation view
  const [mobileSubTab, setMobileSubTab] = useState<'catalog' | 'cart'>('catalog');

  // History search & filters state
  const [historySearch, setHistorySearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  // Register / Creation State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  // Seller PIN input state inside catalog
  const [sellerPinInput, setSellerPinInput] = useState<string>(currentAssociate?.pin || '');

  // Keep seller PIN synchronized when associate switches
  useEffect(() => {
    if (currentAssociate?.pin && currentAssociate.pin !== sellerPinInput) {
      setSellerPinInput(currentAssociate.pin);
    }
  }, [currentAssociate]);

  // Dynamically extract unique categories from products table
  const dynamicCategories = Array.from(
    new Set(
      products
        .map((p) => p.category?.trim())
        .filter((cat): cat is string => Boolean(cat && cat !== 'الكل'))
    )
  );

  const categories = ['الكل', ...dynamicCategories];

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedProduct = products.find(
      (p) =>
        p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        (p.barcodes && p.barcodes.some((b) => b.toLowerCase() === barcodeInput.trim().toLowerCase()))
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
      p.barcode.includes(searchQuery) ||
      (p.barcodes && p.barcodes.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Filtered Past Invoices History Logic
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Search Query (Invoice ID, Customer Name/Phone, Seller PIN, Product Name)
    const q = historySearch.trim().toLowerCase();
    let matchesSearch = true;
    if (q) {
      const matchId = tx.id.toLowerCase().includes(q) || tx.receiptNumber.toLowerCase().includes(q);
      const matchCust = tx.customerName?.toLowerCase().includes(q) || tx.customerPhone?.includes(q);
      const matchAssociatePin = associates.some(
        (a) => a.id === tx.associateId && a.pin.includes(q)
      );
      const matchItems = tx.items.some((item) => item.productName.toLowerCase().includes(q));

      matchesSearch = matchId || Boolean(matchCust) || matchAssociatePin || matchItems;
    }

    // 2. Payment Method Filter
    let matchesPayment = true;
    if (paymentFilter !== 'all') {
      matchesPayment = tx.paymentMethod === paymentFilter;
    }

    // 3. Date Filter
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const txDate = new Date(tx.timestamp);
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = txDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = txDate >= oneWeekAgo;
      } else if (dateFilter === 'month') {
        matchesDate =
          txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
    }

    // 4. Seller Filter (By Seller PIN or ID)
    let matchesSeller = true;
    if (sellerFilter !== 'all') {
      const assoc = associates.find((a) => a.pin === sellerFilter || a.id === sellerFilter);
      if (assoc) {
        matchesSeller = tx.associateId === assoc.id;
      }
    }

    return matchesSearch && matchesPayment && matchesDate && matchesSeller;
  });

  // Sort: held ('معلقة') always comes first, followed by newest transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aHeld = a.status === 'معلقة' ? 1 : 0;
    const bHeld = b.status === 'معلقة' ? 1 : 0;
    if (aHeld !== bHeld) {
      return bHeld - aHeld;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Calculate quick summary metrics for past invoices
  const totalInvoicesCount = filteredTransactions.filter((tx) => tx.status !== 'معلقة').length;
  const totalHeldCount = filteredTransactions.filter((tx) => tx.status === 'معلقة').length;
  const totalSalesSum = filteredTransactions
    .filter((tx) => tx.status === 'completed' || tx.status === 'مكتملة')
    .reduce((acc, tx) => acc + (tx.grandTotal || tx.subtotal || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 dir-rtl space-y-3.5">
      
      {/* ======================================================== */}
      {/* 1. DEFAULT HISTORY VIEW: PAST INVOICES ARCHIVE            */}
      {/* ======================================================== */}
      {viewMode === 'history' ? (
        <div className="space-y-3.5">
          
          {/* Top minimal heading and action bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 space-x-reverse">
              <h1 className="text-base font-black text-stone-100 flex items-center gap-2">
                <span>إرشيف الفواتير القديمة</span>
                <span className="text-xs font-mono bg-stone-900 border border-stone-800 px-2 py-0.5 rounded-full text-stone-400 font-bold">
                  {totalInvoicesCount} مكتملة
                </span>
                {totalHeldCount > 0 && (
                  <span className="text-xs font-mono bg-amber-950 border border-amber-800 px-2.5 py-0.5 rounded-full text-amber-300 font-extrabold animate-pulse flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{totalHeldCount} معلقة</span>
                  </span>
                )}
              </h1>
            </div>
            
            <button
              onClick={() => setViewMode('create')}
              className="py-1.5 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>إضافة فاتورة جديدة</span>
            </button>
          </div>

          {/* Controls & Search Filters Bar */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 shadow-md space-y-2.5">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              
              {/* Search Bar */}
              <div className="md:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث برقم الفاتورة (INV-#)، اسم العميل، رقم التليفون، كود البائع..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-9 pl-4 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                />
              </div>

              {/* Payment Filter */}
              <div className="md:col-span-2">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-200 focus:outline-none"
                >
                  <option value="all">طريقة الدفع: الكل</option>
                  <option value="cash">كاش 💵</option>
                  <option value="installment">تقسيط 📅</option>
                  <option value="card">بطاقة/فيزا 💳</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="md:col-span-2">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-200 focus:outline-none"
                >
                  <option value="all">التاريخ: جميع الأوقات</option>
                  <option value="today">فواتير اليوم 📅</option>
                  <option value="week">هذا الأسبوع 🗓️</option>
                  <option value="month">هذا الشهر 📊</option>
                </select>
              </div>

              {/* Seller PIN Filter */}
              <div className="md:col-span-3">
                <select
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-300 focus:outline-none"
                >
                  <option value="all">تصفية بكود البائع: الكل</option>
                  {associates.map((a) => (
                    <option key={a.id} value={a.pin}>
                      كود البائع: {a.pin}
                    </option>
                  ))}
                </select>
              </div>

            </div>

          </div>

          {/* Past Invoices Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-md overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <FileText className="w-10 h-10 stroke-[1.25] text-stone-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-stone-300">لم يتم العثور على فواتير سابقة مطابقة</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  جرب تغيير كلمات البحث أو الفلاتر أعلاه، أو اضغط على زر إضافة فاتورة جديدة
                </p>
                <button
                  onClick={() => setViewMode('create')}
                  className="mt-3 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة فاتورة جديدة الآن</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-stone-950 text-[10px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800">
                      <th className="py-2 px-3">رقم الفاتورة</th>
                      <th className="py-2 px-3">التاريخ والوقت</th>
                      <th className="py-2 px-3">اسم العميل</th>
                      <th className="py-2 px-3 text-center">كود البائع</th>
                      <th className="py-2 px-3 text-center">طريقة الدفع</th>
                      <th className="py-2 px-3 text-center">الإجمالي</th>
                      <th className="py-2 px-3 text-center">الحالة</th>
                      <th className="py-2 px-3 text-center">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80 text-xs text-stone-200">
                    {sortedTransactions.map((tx) => {
                      const assocId = tx.primaryAssociateId || (tx as any).associateId;
                      const assoc = associates.find((a) => a.id === assocId);
                      const sellerPinCode = assoc ? assoc.pin : '101';
                      const formattedDate = new Date(tx.timestamp).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const isVoided = tx.status === 'voided' || tx.status === 'ملغاة';
                      const isHeld = tx.status === 'معلقة';
                      const txTotal = tx.grandTotal ?? tx.subtotal ?? 0;

                      return (
                        <tr
                          key={tx.id}
                          className={`transition-colors ${
                            isHeld
                              ? 'bg-amber-950/20 hover:bg-amber-950/30 border-r-4 border-amber-500'
                              : 'hover:bg-stone-950/60'
                          }`}
                        >
                          {/* رقم الفاتورة */}
                          <td className="py-1.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                            #{tx.receiptNumber}
                          </td>

                          {/* التاريخ والوقت */}
                          <td className="py-1.5 px-3 text-stone-400 whitespace-nowrap">
                            <span className="flex items-center space-x-1.5 space-x-reverse">
                              <Clock className="w-3 h-3 text-stone-500" />
                              <span className="text-[11px]">{formattedDate}</span>
                            </span>
                          </td>

                          {/* العميل */}
                          <td className="py-1.5 px-3">
                            <span className="font-bold text-stone-100 block">
                              {tx.customerName || 'عميل نقدي'}
                            </span>
                          </td>

                          {/* كود البائع ONLY */}
                          <td className="py-1.5 px-3 text-center">
                            <span className="font-mono font-extrabold text-amber-400 bg-stone-950 border border-stone-800 px-2 py-0.2 rounded-lg text-[10px] inline-block">
                              كود: {sellerPinCode}
                            </span>
                          </td>

                          {/* طريقة الدفع */}
                          <td className="py-1.5 px-3 text-center">
                            {isHeld ? (
                              <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                                معلقة ⏳
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.2 rounded-lg text-[9px] font-bold ${
                                  tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : tx.paymentMethod === 'installment' || tx.paymentMethod === 'تقسيط شهري'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                }`}
                              >
                                {tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش'
                                  ? 'كاش 💵'
                                  : tx.paymentMethod === 'installment' || tx.paymentMethod === 'تقسيط شهري'
                                  ? 'تقسيط 📅'
                                  : 'بطاقة / جملة 💳'}
                              </span>
                            )}
                          </td>

                          {/* الإجمالي */}
                          <td className="py-1.5 px-3 text-center font-mono font-extrabold text-white whitespace-nowrap text-[11px]">
                            {(txTotal || 0).toLocaleString()} ج.م
                          </td>

                          {/* الحالة */}
                          <td className="py-1.5 px-3 text-center">
                            {isHeld ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                                معلقة ⏳
                              </span>
                            ) : isVoided ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                ملغاة
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                مكتملة ✓
                              </span>
                            )}
                          </td>

                          {/* خيارات الفاتورة */}
                          <td className="py-1.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5 space-x-reverse justify-center">
                              {isHeld ? (
                                <>
                                  <button
                                    onClick={() => {
                                      if (confirm(`هل تريد استكمال الفاتورة المعلقة رقم ${tx.receiptNumber} للعميل ${tx.customerName || ''}؟`)) {
                                        restoreHeldTransaction(tx.id);
                                        setViewMode('create');
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-[9px] flex items-center space-x-1 space-x-reverse transition-all active:scale-95 animate-pulse"
                                    title="استكمال الفاتورة وتفريغها في السلة"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>استكمال</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('هل تريد حذف وإلغاء هذه الفاتورة المعلقة نهائياً؟')) {
                                        deleteTransaction(tx.id);
                                      }
                                    }}
                                    className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors border border-stone-800"
                                    title="حذف وتعليق نهائي"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setCompletedTransaction(tx)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-[11px] flex items-center space-x-1 space-x-reverse transition-colors"
                                  title="عرض وطباعة الفاتورة"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>طباعة</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        <>
          {/* ======================================================== */
             /* 2. CREATE NEW INVOICE VIEW (COMPACT CATALOG & CART)       */
             /* ======================================================== */}
          {/* Mobile View Selector Tab (Only visible on screens < lg) */}
          <div className="lg:hidden grid grid-cols-2 gap-2 bg-stone-900/60 p-1 rounded-xl border border-stone-800 mb-2">
          <button
            onClick={() => setMobileSubTab('catalog')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse ${
              mobileSubTab === 'catalog'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>الأصناف والكتالوج ({filteredProducts.length})</span>
          </button>
          <button
            onClick={() => setMobileSubTab('cart')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse relative ${
              mobileSubTab === 'cart'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>الفاتورة والسلة ({cart.length})</span>
            {cart.length > 0 && (
              <span className="mr-1.5 bg-rose-500 text-white text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Compact Product Selector Catalog (5 Cols) */}
          <div className={`lg:col-span-5 xl:col-span-5 space-y-3 ${mobileSubTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Header Controls inside Catalog */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 shadow-xl space-y-2.5">
              
              {/* Row 1: Back to Invoices List button (Top of Catalog ONLY) & Title */}
              <div className="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-2">
                <button
                  onClick={() => setViewMode('history')}
                  className="px-2.5 py-1.5 bg-stone-800 hover:bg-amber-600 text-stone-200 hover:text-white rounded-xl text-[11px] font-bold flex items-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>العودة للفواتير</span>
                </button>

                <div className="flex items-center space-x-1.5 space-x-reverse">
                  <span className="text-[11px] font-extrabold text-amber-400 bg-amber-950 border border-amber-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>كتالوج الاصناف ({filteredProducts.length})</span>
                  </span>
                </div>
              </div>

              {/* Row 2: Seller Code Input ("كود البائع") */}
              <div className="bg-stone-950 border border-stone-800 p-2 rounded-xl flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-stone-200 whitespace-nowrap">
                  كود البائع:
                </span>
                
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    placeholder="كود البائع..."
                    value={sellerPinInput}
                    onChange={(e) => {
                      const pin = e.target.value;
                      setSellerPinInput(pin);
                      if (pin.trim()) {
                        quickSwitchByPin(pin.trim());
                      }
                    }}
                    className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-mono font-bold focus:outline-none placeholder-stone-600"
                  />
                  {sellerPinInput ? (
                    <button
                      onClick={() => setSellerPinInput('')}
                      className="absolute left-1.5 text-stone-500 hover:text-rose-400 p-0.5"
                      title="تفريغ الكود"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>

                {currentAssociate ? (
                  <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded whitespace-nowrap">
                    كود: {currentAssociate.pin} ✓
                  </span>
                ) : (
                  <span className="text-[9px] text-amber-500 font-bold bg-amber-950/80 border border-amber-900 px-1.5 py-0.5 rounded whitespace-nowrap">
                    (أدخل كود)
                  </span>
                )}
              </div>

              {/* Row 3: Product Search & Barcode Scanner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {/* Product Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث منتج أو كود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-8 pl-7 py-1.5 text-[11px] text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2 top-2 text-stone-400 hover:text-stone-200 p-0.5 rounded-md hover:bg-stone-800 transition-colors"
                      title="مسح البحث"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Barcode Scanner Input */}
                <form onSubmit={handleBarcodeScan} className="relative">
                  <Barcode className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="باركود + Enter"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-8 pl-7 py-1.5 text-[11px] font-mono text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="absolute left-2 top-2 text-stone-400 hover:text-stone-200 p-0.5 rounded-md hover:bg-stone-800 transition-colors"
                      title="مسح"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </form>
              </div>

              {/* Row 4: Horizontal Scrollable Category Filter */}
              <div className="flex items-center space-x-1.5 space-x-reverse overflow-x-auto pb-1.5 scrollbar-none border-b border-stone-800/60">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800/80'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Price Tier Selection */}
              <div className="bg-stone-950 border border-stone-800 p-1.5 rounded-xl flex items-center justify-between text-[11px] gap-1.5">
                <span className="font-bold text-stone-300 flex items-center space-x-1 space-x-reverse shrink-0">
                  <Tag className="w-3 h-3 text-amber-400" />
                  <span>التسعير:</span>
                </span>

                <div className="grid grid-cols-3 gap-1 flex-1">
                  {[
                    { id: 'cash', label: 'كاش 💵' },
                    { id: 'installment', label: 'تقسيط 📅' },
                    { id: 'wholesale', label: 'جملة 📦' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setGlobalPriceTier(tier.id as PriceTier)}
                      className={`py-0.5 rounded-lg font-bold text-[10px] transition-all text-center ${
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

            </div>

            {/* Compact Product List - Rendered as Rows */}
            <div className="flex flex-col space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
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
                    className={`bg-stone-900 border border-stone-800 hover:border-amber-500/60 rounded-xl p-1.5 flex items-center justify-between transition-all group cursor-pointer relative shadow-sm space-x-1.5 space-x-reverse ${
                      isJustAdded ? 'scale-[0.99] border-amber-500 ring-1 ring-amber-500/50' : ''
                    }`}
                  >
                    {/* Left/Right Product Image & Main Info */}
                    <div className="flex items-center space-x-2 space-x-reverse min-w-0 flex-1">
                      <div className="w-8.5 h-8.5 rounded-lg overflow-hidden bg-stone-950 border border-stone-800 shrink-0 relative">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 space-x-reverse">
                          <h3 className="text-[11px] font-bold text-stone-100 truncate group-hover:text-amber-400 transition-colors">
                            {product.name}
                          </h3>
                          <span className="text-[8px] bg-stone-950 text-stone-400 border border-stone-800 px-1 py-0.2 rounded font-mono shrink-0">
                            {product.category}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 space-x-reverse text-[8px] text-stone-500 font-mono mt-0.5">
                          <span>كود: {product.sku}</span>
                          <span>•</span>
                          <span>باركود: {product.barcode}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock, Active Price & Quick Add Button */}
                    <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                      <span
                        className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                          isOutOfStock
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isLowStock
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-stone-950 text-emerald-400 border border-stone-800'
                        }`}
                      >
                        {isOutOfStock ? 'نفد المخزون' : `مخزون: ${product.stock}`}
                      </span>

                      <span className="text-[11px] font-mono font-extrabold text-amber-400 min-w-[55px] text-left">
                        {activePrice.toLocaleString()} ج.م
                      </span>

                      <button
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOutOfStock) triggerAddToCart(product);
                        }}
                        className={`py-0.5 px-2 rounded-lg text-[10px] font-bold flex items-center space-x-1 space-x-reverse transition-all ${
                          isJustAdded
                            ? 'bg-amber-500 text-white'
                            : isOutOfStock
                            ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                        }`}
                        title="إضافة للفاتورة"
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>إضافة</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* Cart Sidebar Panel (7 Cols - High Visibility) */}
          <div className={`lg:col-span-7 xl:col-span-7 sticky top-20 ${mobileSubTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
            <CartSidebar onOpenCheckout={() => setIsPaymentOpen(true)} />
          </div>

        </div>
      </>
    )}

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
