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
    associates,
    currentAssociate,
    quickSwitchByPin,
  } = usePOS();

  // Mode state: DEFAULT TO 'history' AS REQUESTED!
  const [viewMode, setViewMode] = useState<'history' | 'create'>('history');

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

  // Calculate quick summary metrics for past invoices
  const totalInvoicesCount = filteredTransactions.length;
  const totalSalesSum = filteredTransactions
    .filter((tx) => tx.status === 'completed' || tx.status === 'مكتملة')
    .reduce((acc, tx) => acc + (tx.grandTotal || tx.subtotal || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 dir-rtl space-y-6">
      
      {/* ======================================================== */}
      {/* 1. DEFAULT HISTORY VIEW: PAST INVOICES ARCHIVE            */}
      {/* ======================================================== */}
      {viewMode === 'history' ? (
        <div className="space-y-6">
          
          {/* Top Header Banner with "+ New Invoice" Button */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-stone-100 flex items-center space-x-2 space-x-reverse">
                  <span>إرشيف وقائمة الفواتير القديمة</span>
                  <span className="text-xs font-mono bg-stone-950 border border-stone-800 px-2 py-0.5 rounded-full text-amber-400 font-bold">
                    {totalInvoicesCount} فاتورة
                  </span>
                </h1>
                <p className="text-xs text-stone-400 mt-0.5">
                  عرض الفواتير السابقة، البحث برقم الفاتورة أو كود البائع، وطباعة أي فاتورة
                </p>
              </div>
            </div>

            {/* Prominent Action Button: + New Invoice */}
            <button
              onClick={() => setViewMode('create')}
              className="py-3.5 px-6 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-sm font-extrabold shadow-xl shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>إضافة فاتورة جديدة</span>
            </button>
          </div>

          {/* Quick Stats Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-400 font-bold block">إجمالي عدد الفواتير</span>
                <span className="text-xl font-mono font-extrabold text-stone-100 mt-1 block">
                  {totalInvoicesCount} فاتورة
                </span>
              </div>
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-amber-400">
                <Hash className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-400 font-bold block">إجمالي قيم المبيعات</span>
                <span className="text-xl font-mono font-extrabold text-emerald-400 mt-1 block">
                  {totalSalesSum.toLocaleString()} ج.م
                </span>
              </div>
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-400 font-bold block">حالة تصفية البحث</span>
                <span className="text-xs font-bold text-amber-400 mt-1 block">
                  {historySearch || paymentFilter !== 'all' || dateFilter !== 'all' || sellerFilter !== 'all'
                    ? 'نتائج مخصصة بحسب الفلاتر'
                    : 'جميع الفواتير المسجلة بالنظام'}
                </span>
              </div>
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-amber-400">
                <Filter className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Controls & Search Filters Bar */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 shadow-xl space-y-3">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Search Bar */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="ابحث برقم الفاتورة (INV-#)، اسم العميل، رقم التليفون، كود البائع..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                />
              </div>

              {/* Payment Filter */}
              <div className="md:col-span-2">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs font-bold text-stone-200 focus:outline-none"
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
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs font-bold text-stone-200 focus:outline-none"
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
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs font-bold text-amber-300 focus:outline-none"
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
          <div className="bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-stone-500">
                <FileText className="w-14 h-14 stroke-[1.25] text-stone-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-stone-300">لم يتم العثور على فواتير سابقة مطابقة</p>
                <p className="text-xs text-stone-500 mt-1">
                  جرب تغيير كلمات البحث أو الفلاتر أعلاه، أو اضغط على زر إضافة فاتورة جديدة
                </p>
                <button
                  onClick={() => setViewMode('create')}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة فاتورة جديدة الآن</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-stone-950 text-[11px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800">
                      <th className="py-3.5 px-4">رقم الفاتورة</th>
                      <th className="py-3.5 px-4">التاريخ والوقت</th>
                      <th className="py-3.5 px-4">اسم العميل</th>
                      <th className="py-3.5 px-4 text-center">كود البائع</th>
                      <th className="py-3.5 px-4 text-center">طريقة الدفع</th>
                      <th className="py-3.5 px-4 text-center">الإجمالي</th>
                      <th className="py-3.5 px-4 text-center">الحالة</th>
                      <th className="py-3.5 px-4 text-center">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80 text-xs text-stone-200">
                    {filteredTransactions.map((tx) => {
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
                      const txTotal = tx.grandTotal ?? tx.subtotal ?? 0;

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-stone-950/60 transition-colors"
                        >
                          {/* رقم الفاتورة */}
                          <td className="py-4 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                            #{tx.receiptNumber}
                          </td>

                          {/* التاريخ والوقت */}
                          <td className="py-4 px-4 text-stone-400 whitespace-nowrap">
                            <span className="flex items-center space-x-1.5 space-x-reverse">
                              <Clock className="w-3.5 h-3.5 text-stone-500" />
                              <span>{formattedDate}</span>
                            </span>
                          </td>

                          {/* العميل */}
                          <td className="py-4 px-4">
                            <span className="font-bold text-stone-100 block">
                              {tx.customerName || 'عميل نقدي'}
                            </span>
                          </td>

                          {/* كود البائع ONLY */}
                          <td className="py-4 px-4 text-center">
                            <span className="font-mono font-extrabold text-amber-400 bg-stone-950 border border-stone-800 px-2.5 py-1 rounded-xl text-xs inline-block">
                              كود: {sellerPinCode}
                            </span>
                          </td>

                          {/* طريقة الدفع */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
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
                          </td>

                          {/* الإجمالي */}
                          <td className="py-4 px-4 text-center font-mono font-extrabold text-white whitespace-nowrap">
                            {(txTotal || 0).toLocaleString()} ج.م
                          </td>

                          {/* الحالة */}
                          <td className="py-4 px-4 text-center">
                            {isVoided ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                ملغاة
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                مكتملة ✓
                              </span>
                            )}
                          </td>

                          {/* خيارات الفاتورة */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5 space-x-reverse">
                              <button
                                onClick={() => setCompletedTransaction(tx)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-[11px] flex items-center space-x-1 space-x-reverse transition-colors"
                                title="عرض وطباعة الفاتورة"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>طباعة</span>
                              </button>

                              {!isVoided && (
                                <button
                                  onClick={() => {
                                    if (confirm(`هل أنت تأكد من إلغاء الفاتورة #${tx.receiptNumber}؟`)) {
                                      voidTransaction(tx.id);
                                    }
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-rose-400 hover:bg-stone-800 rounded-xl transition-colors"
                                  title="إلغاء الفاتورة"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
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
        /* ======================================================== */
        /* 2. CREATE NEW INVOICE VIEW (CASHIER & CART SIDEBAR)       */
        /* ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Dominant Product Selector Catalog (8 Cols - Dominant Share) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            
            {/* Header Controls inside Catalog */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 shadow-xl space-y-3">
              
              {/* Row 1: Back to Invoices List button (Top of Catalog ONLY) & Title */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                <button
                  onClick={() => setViewMode('history')}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-amber-600 text-stone-200 hover:text-white rounded-2xl text-xs font-bold flex items-center space-x-2 space-x-reverse transition-all active:scale-95 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                  <span>العودة لقائمة الفواتير</span>
                </button>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="text-xs font-extrabold text-amber-400 bg-amber-950 border border-amber-800 px-3 py-1 rounded-xl flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    <span>قائمة الأصناف ({filteredProducts.length} صنف)</span>
                  </span>
                </div>
              </div>

              {/* Row 2: Seller Code Input ("كود البائع") - Moved into Catalog */}
              <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5 space-x-reverse flex-1 min-w-[220px]">
                  <span className="text-xs font-bold text-stone-200 whitespace-nowrap">
                    كود البائع:
                  </span>
                  
                  <div className="relative flex-1 max-w-xs flex items-center">
                    <input
                      type="text"
                      placeholder="أدخل كود البائع (مثلاً 101)..."
                      value={sellerPinInput}
                      onChange={(e) => {
                        const pin = e.target.value;
                        setSellerPinInput(pin);
                        if (pin.trim()) {
                          quickSwitchByPin(pin.trim());
                        }
                      }}
                      className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-mono font-bold focus:outline-none placeholder-stone-600"
                    />
                    {sellerPinInput ? (
                      <button
                        onClick={() => {
                          setSellerPinInput('');
                        }}
                        className="absolute left-2 text-stone-500 hover:text-rose-400 p-0.5"
                        title="تفريغ الكود"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {currentAssociate ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-lg whitespace-nowrap">
                      كود: {currentAssociate.pin} ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-bold bg-amber-950/80 border border-amber-900 px-2 py-1 rounded-lg whitespace-nowrap">
                      (يرجى إدخال كود البائع)
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Product Search & Barcode Fast Scanner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Product Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="بحث باسم المنتج، الكود، أو الباركود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
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
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-2 text-xs font-mono text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                </form>
              </div>

              {/* Price Tier Selection */}
              <div className="bg-stone-950 border border-stone-800 p-2 rounded-2xl flex items-center justify-between text-xs gap-2">
                <span className="font-bold text-stone-300 flex items-center space-x-1 space-x-reverse shrink-0">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>التسعير:</span>
                </span>

                <div className="grid grid-cols-3 gap-1.5 flex-1">
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

              {/* CATEGORIES / SECTIONS ARE HIDDEN FOR DOMINANT ITEMS DISPLAY AS REQUESTED */}

            </div>

            {/* Dominant Product Grid (Large multi-column view for max items display) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
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

          {/* Cart Sidebar Panel (4 Cols) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
            <CartSidebar onOpenCheckout={() => setIsPaymentOpen(true)} />
          </div>

        </div>
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
