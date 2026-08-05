import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Supplier, SupplierTransaction } from '../../types';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  DollarSign,
  Receipt,
  Printer,
  X,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    supplierTransactions,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    recordSupplierTransaction,
    currentAssociate,
  } = usePOS();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'balance_desc' | 'name' | 'balance_asc'>('balance_desc');

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  // Form States for Add/Edit
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    category: 'أطقم طهي وحلل',
    currentBalance: 0,
    taxNumber: '',
    notes: '',
  });

  // Form States for Payment (سند صرف دفعة)
  const [paymentFormData, setPaymentFormData] = useState({
    amount: 0,
    paymentMethod: 'كاش / خزينة الفرع',
    referenceNumber: '',
    notes: '',
  });

  // Form States for Supply Invoice (فاتورة توريد بضاعة)
  const [invoiceFormData, setInvoiceFormData] = useState({
    amount: 0,
    referenceNumber: '',
    paymentMethod: 'آجل / توريد',
    notes: '',
  });

  // Category Options
  const categories = [
    'أطقم طهي وحلل',
    'أجهزة منزلية وكهربائية',
    'زجاجيات وبورسلين',
    'بلاستيكيات ومنظمات',
    'أدوات مائدة وتوزيع',
    'مستلزمات عامة وتغليف',
  ];

  // Helper Stats
  const totalSuppliersCount = suppliers.length;
  const totalBalanceOwed = suppliers.reduce((acc, s) => acc + (s.currentBalance > 0 ? s.currentBalance : 0), 0);
  
  // Settled this month
  const now = new Date();
  const currentMonthTxs = supplierTransactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && tx.type === 'payment';
  });
  const totalSettledThisMonth = currentMonthTxs.reduce((acc, tx) => acc + tx.amount, 0);

  // Top Creditor
  const topCreditor = [...suppliers].sort((a, b) => b.currentBalance - a.currentBalance)[0];

  // Handlers
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      companyName: '',
      phone: '',
      email: '',
      address: '',
      category: 'أطقم طهي وحلل',
      currentBalance: 0,
      taxNumber: '',
      notes: '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierFormData({
      name: supplier.name,
      companyName: supplier.companyName || '',
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category || 'أطقم طهي وحلل',
      currentBalance: supplier.currentBalance,
      taxNumber: supplier.taxNumber || '',
      notes: supplier.notes || '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim() || !supplierFormData.phone.trim()) return;

    if (editingSupplier) {
      updateSupplier({
        ...editingSupplier,
        name: supplierFormData.name,
        companyName: supplierFormData.companyName,
        phone: supplierFormData.phone,
        email: supplierFormData.email,
        address: supplierFormData.address,
        category: supplierFormData.category,
        currentBalance: Number(supplierFormData.currentBalance),
        taxNumber: supplierFormData.taxNumber,
        notes: supplierFormData.notes,
      });
    } else {
      addSupplier({
        name: supplierFormData.name,
        companyName: supplierFormData.companyName,
        phone: supplierFormData.phone,
        email: supplierFormData.email,
        address: supplierFormData.address,
        category: supplierFormData.category,
        currentBalance: Number(supplierFormData.currentBalance),
        taxNumber: supplierFormData.taxNumber,
        notes: supplierFormData.notes,
      });
    }
    setIsAddEditModalOpen(false);
  };

  const handleOpenPayment = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentFormData({
      amount: supplier.currentBalance > 0 ? supplier.currentBalance : 0,
      paymentMethod: 'كاش / خزينة الفرع',
      referenceNumber: `PAY-SUPP-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: 'سداد دفعة من الحساب المستحق للمورد',
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || paymentFormData.amount <= 0) return;

    recordSupplierTransaction({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      type: 'payment',
      amount: Number(paymentFormData.amount),
      referenceNumber: paymentFormData.referenceNumber,
      paymentMethod: paymentFormData.paymentMethod,
      notes: paymentFormData.notes,
      associateName: currentAssociate?.name || 'النظام',
    });

    setIsPaymentModalOpen(false);
  };

  const handleOpenInvoice = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setInvoiceFormData({
      amount: 0,
      referenceNumber: `INV-SUPP-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentMethod: 'آجل / توريد',
      notes: 'توريد شحنة بضاعة جديدة للمخزن',
    });
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || invoiceFormData.amount <= 0) return;

    recordSupplierTransaction({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      type: 'supply_invoice',
      amount: Number(invoiceFormData.amount),
      referenceNumber: invoiceFormData.referenceNumber,
      paymentMethod: invoiceFormData.paymentMethod,
      notes: invoiceFormData.notes,
      associateName: currentAssociate?.name || 'النظام',
    });

    setIsInvoiceModalOpen(false);
  };

  const handleOpenStatement = (supplier: Supplier) => {
    setStatementSupplier(supplier);
    setIsStatementModalOpen(true);
  };

  // Filtering & Sorting
  const filteredSuppliers = suppliers
    .filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.companyName && s.companyName.toLowerCase().includes(search.toLowerCase())) ||
        s.phone.includes(search) ||
        (s.taxNumber && s.taxNumber.includes(search));
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'balance_desc') return b.currentBalance - a.currentBalance;
      if (sortBy === 'balance_asc') return a.currentBalance - b.currentBalance;
      return a.name.localeCompare(b.name, 'ar');
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-stone-100">
      
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-inner">
            <Truck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              دليل وتصفية حسابات الموردين
            </h1>
            <p className="text-xs text-stone-400">
              أسماء للأدوات المنزلية • متابعة أرصدة الموردين، فواتير التوريد، وسندات الصرف والسداد
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Suppliers */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-stone-400 font-medium">إجمالي الموردين</p>
            <p className="text-2xl font-black text-stone-100">{totalSuppliersCount}</p>
            <p className="text-[10px] text-stone-500">موردين معتمدين</p>
          </div>
          <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center text-stone-300">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Owed / Outstanding Balance */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-amber-400 font-semibold">إجمالي مستحقات الموردين (ديون)</p>
            <p className="text-2xl font-black text-amber-400">
              {totalBalanceOwed.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[10px] text-stone-400">رصيد آجل مستحق السداد</p>
          </div>
          <div className="w-10 h-10 bg-amber-950/60 border border-amber-800/60 rounded-xl flex items-center justify-center text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Payments Settled This Month */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-emerald-400 font-semibold">مسدد للموردين هذا الشهر</p>
            <p className="text-2xl font-black text-emerald-400">
              {totalSettledThisMonth.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[10px] text-stone-400">إجمالي سندات الصرف</p>
          </div>
          <div className="w-10 h-10 bg-emerald-950/60 border border-emerald-800/60 rounded-xl flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Top Creditor */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-rose-400 font-semibold">أعلى مورد دائنية</p>
            <p className="text-sm font-bold text-stone-100 truncate max-w-[140px]">
              {topCreditor ? topCreditor.name : 'لا يوجد'}
            </p>
            <p className="text-xs font-black text-rose-400">
              {topCreditor && topCreditor.currentBalance > 0
                ? `${topCreditor.currentBalance.toLocaleString('ar-EG')} ج.م`
                : '0 ج.م'}
            </p>
          </div>
          <div className="w-10 h-10 bg-rose-950/60 border border-rose-800/60 rounded-xl flex items-center justify-center text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Search, Category Filter & Sorting Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث باسم المورد، الشركة، رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-200 rounded-xl pr-10 pl-8 py-2.5 focus:outline-none focus:border-amber-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-3 top-3 text-stone-500 hover:text-stone-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category & Sorting Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Dropdown */}
          <div className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-300">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent focus:outline-none text-stone-200 cursor-pointer"
            >
              <option value="all">كل التخصصات والتصنيفات</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-300">
            <span className="text-stone-400 font-bold">ترتيب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent focus:outline-none text-stone-200 cursor-pointer"
            >
              <option value="balance_desc">الأعلى رصيداً دائن (مستحق له)</option>
              <option value="balance_asc">الأقل رصيداً دائن</option>
              <option value="name">أبجدي (اسم المورد)</option>
            </select>
          </div>
        </div>

      </div>

      {/* Suppliers Cards Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-12 text-center space-y-3">
          <Truck className="w-12 h-12 text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-stone-300">لا يوجد موردين مطابقين للبحث</h3>
          <p className="text-xs text-stone-500">جرب البحث بكلمة مختلفة أو إضافة مورد جديد للنظام</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {filteredSuppliers.map((supplier) => {
            const hasDebt = supplier.currentBalance > 0;
            const isSettled = supplier.currentBalance === 0;

            return (
              <div
                key={supplier.id}
                className="bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-3xl p-5 shadow-lg space-y-4 transition-all"
              >
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base">
                      {supplier.name.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-stone-100">{supplier.name}</h3>
                      {supplier.companyName && (
                        <p className="text-xs text-stone-400 flex items-center space-x-1 space-x-reverse">
                          <Building2 className="w-3.5 h-3.5 text-stone-500 inline" />
                          <span>{supplier.companyName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Category Pill */}
                  {supplier.category && (
                    <span className="text-[10px] bg-stone-800 text-amber-300 border border-stone-700 px-2.5 py-1 rounded-xl font-bold whitespace-nowrap">
                      {supplier.category}
                    </span>
                  )}
                </div>

                {/* Balance Badge Box */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    hasDebt
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : isSettled
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold block opacity-80">رصيد حساب المورد لدينا:</span>
                    <span className="text-lg font-black tracking-tight">
                      {Math.abs(supplier.currentBalance).toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-xl font-bold flex items-center space-x-1.5 space-x-reverse ${
                      hasDebt
                        ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                        : isSettled
                        ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                        : 'bg-blue-900/80 text-blue-200 border border-blue-700'
                    }`}
                  >
                    {hasDebt ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>مستحق له (دائن)</span>
                      </>
                    ) : isSettled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>الحساب خالص</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>رصيد دائن لنا (عربون)</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Contact Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-stone-400 bg-stone-950/50 p-3 rounded-2xl border border-stone-800/80">
                  <div className="flex items-center space-x-2 space-x-reverse truncate">
                    <Phone className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <a href={`tel:${supplier.phone}`} className="hover:text-amber-400 dir-ltr text-right font-mono">
                      {supplier.phone}
                    </a>
                  </div>

                  {supplier.taxNumber && (
                    <div className="flex items-center space-x-2 space-x-reverse truncate">
                      <Receipt className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="font-mono text-[11px]">ضريبي: {supplier.taxNumber}</span>
                    </div>
                  )}

                  {supplier.address && (
                    <div className="col-span-2 flex items-center space-x-2 space-x-reverse truncate">
                      <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="truncate">{supplier.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  
                  {/* Record Payment */}
                  <button
                    onClick={() => handleOpenPayment(supplier)}
                    className="py-2 px-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-all active:scale-95"
                    title="تسجيل سند صرف / سداد دفعة للمورد"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>سداد دفعة</span>
                  </button>

                  {/* Record Invoice */}
                  <button
                    onClick={() => handleOpenInvoice(supplier)}
                    className="py-2 px-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-all active:scale-95"
                    title="تسجيل فاتورة توريد بضاعة جديدة"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>فاتورة توريد</span>
                  </button>

                  {/* Statement Ledger */}
                  <button
                    onClick={() => handleOpenStatement(supplier)}
                    className="py-2 px-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-all active:scale-95"
                    title="عرض كشف الحساب التفصيلي"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>كشف حساب</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenEdit(supplier)}
                    className="py-2 px-2 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-all active:scale-95"
                  >
                    <span>تعديل</span>
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Add / Edit Supplier */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-base">
                  {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
                </h2>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Name */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">اسم المورد / المسؤول *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شركة العربي للتجارة والصناعة"
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">اسم المصنع / الماركة</label>
                  <input
                    type="text"
                    placeholder="مثال: العربي جروب"
                    value={supplierFormData.companyName}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, companyName: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    placeholder="01012345678"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono text-right dir-ltr focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">التخصص الرئيسي</label>
                  <select
                    value={supplierFormData.category}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, category: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Initial Balance */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">الرصيد الافتتاحي (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={supplierFormData.currentBalance}
                    onChange={(e) =>
                      setSupplierFormData({ ...supplierFormData, currentBalance: Number(e.target.value) })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Tax Number */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">الرقم الضريبي (إن وجد)</label>
                  <input
                    type="text"
                    placeholder="xxx-xxx-xxx"
                    value={supplierFormData.taxNumber}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, taxNumber: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">العنوان / مقر الشركة</label>
                  <input
                    type="text"
                    placeholder="مثال: المنطقة الصناعية - العاشر من رمضان"
                    value={supplierFormData.address}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">ملاحظات وشروط التعامل</label>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات حول طريقة التوريد، مدة الائتمان، خصم تعجيل الدفع..."
                    value={supplierFormData.notes}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  {editingSupplier ? 'حفظ التغييرات' : 'إضافة المورد'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: Record Payment (سند صرف دفعة للمورد) */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-stone-100">سند صرف دفعة للمورد</h2>
                  <p className="text-[11px] text-stone-400">{selectedSupplier.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              
              {/* Current Debt Alert */}
              <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-stone-300">الرصيد المستحق الحالي للمورد:</span>
                <span className="font-black text-amber-300 font-mono">
                  {selectedSupplier.currentBalance.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">المبلغ المسدد (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-100 font-black font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">طريقة الصرف والخصم</label>
                <select
                  value={paymentFormData.paymentMethod}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="كاش / خزينة الفرع">كاش (خزينة النقدية الفرع)</option>
                  <option value="تحويل بنكي">تحويل بنكي / CIB / بنك مصر</option>
                  <option value="شيك بنكي">شيك بنكي مؤجل / مقبول الدفع</option>
                  <option value="محفظة إلكترونية">محفظة إلكترونية (فودافون كاش / أنستا باي)</option>
                </select>
              </div>

              {/* Reference Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">رقم السند / الإيصال</label>
                <input
                  type="text"
                  value={paymentFormData.referenceNumber}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, referenceNumber: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">ملاحظات السند</label>
                <input
                  type="text"
                  placeholder="ملاحظات حول الدفعة..."
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  تأكيد وتسجيل الصرف
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: Record Supply Invoice (فاتورة توريد بضاعة جديدة) */}
      {isInvoiceModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-stone-100">تسجيل فاتورة توريد جديدة</h2>
                  <p className="text-[11px] text-stone-400">{selectedSupplier.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="p-6 space-y-4">
              
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">قيمة الفاتورة الإجمالية (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={invoiceFormData.amount}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: Number(e.target.value) })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-100 font-black font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Reference Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">رقم فاتورة المورد / الشحنة *</label>
                <input
                  type="text"
                  required
                  placeholder="INV-10928"
                  value={invoiceFormData.referenceNumber}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, referenceNumber: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">طريقة وسند الفاتورة</label>
                <select
                  value={invoiceFormData.paymentMethod}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, paymentMethod: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="آجل / توريد">آجل (تضاف على رصيد المورد)</option>
                  <option value="نقدي فوري">نقدي فوري (تم دفعها مباشرة)</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">تفاصيل البضاعة الموردة</label>
                <input
                  type="text"
                  placeholder="مثال: توريد 20 طقم حلل ستانلس 10 قطع..."
                  value={invoiceFormData.notes}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  تسجيل الفاتورة وإضافة للرصيد
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 4: Statement of Account (كشف حساب المورد التفصيلي) */}
      {isStatementModalOpen && statementSupplier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            
            {/* Printable Header */}
            <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-lg text-stone-100">كشف حساب المورد</h2>
                  <p className="text-xs text-stone-400">
                    {statementSupplier.name} • {statementSupplier.companyName || 'مورد معتمد'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <button
                  onClick={() => window.print()}
                  className="py-2 px-3.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة كشف الحساب</span>
                </button>

                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  className="text-stone-400 hover:text-stone-200 p-2 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
              
              {/* Supplier Info Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-950 p-4 rounded-2xl border border-stone-800 text-xs">
                <div>
                  <span className="text-stone-500 block mb-0.5">اسم المورد:</span>
                  <span className="font-bold text-stone-200">{statementSupplier.name}</span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">رقم الهاتف:</span>
                  <span className="font-mono text-stone-200 dir-ltr text-right inline-block">
                    {statementSupplier.phone}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">الرصيد الدائن الحالي:</span>
                  <span className="font-black text-amber-400 text-sm font-mono">
                    {statementSupplier.currentBalance.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-stone-300 uppercase tracking-wider">
                  سجل حركة الفواتير والسدادات (الدفتر)
                </h3>

                {supplierTransactions.filter((tx) => tx.supplierId === statementSupplier.id).length === 0 ? (
                  <div className="p-8 text-center bg-stone-950 border border-stone-800 rounded-2xl text-stone-500 text-xs">
                    لا توجد عمليات مسجلة لهذا المورد حتى الآن
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-stone-800 rounded-2xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-950 text-stone-400 border-b border-stone-800 font-bold">
                        <tr>
                          <th className="py-3 px-4">التاريخ والوقت</th>
                          <th className="py-3 px-4">نوع الحركة</th>
                          <th className="py-3 px-4">رقم السند / الفاتورة</th>
                          <th className="py-3 px-4">طريقة الصرف</th>
                          <th className="py-3 px-4">المبلغ</th>
                          <th className="py-3 px-4">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/60 bg-stone-900/40">
                        {supplierTransactions
                          .filter((tx) => tx.supplierId === statementSupplier.id)
                          .map((tx) => {
                            const isPayment = tx.type === 'payment';
                            return (
                              <tr key={tx.id} className="hover:bg-stone-800/40 transition-colors">
                                <td className="py-3 px-4 font-mono text-stone-400 text-[11px]">
                                  {new Date(tx.date).toLocaleDateString('ar-EG', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-3 px-4">
                                  {isPayment ? (
                                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                      سند صرف (سداد)
                                    </span>
                                  ) : (
                                    <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                      فاتورة توريد
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono font-semibold text-stone-300">
                                  {tx.referenceNumber || '-'}
                                </td>
                                <td className="py-3 px-4 text-stone-400">{tx.paymentMethod || '-'}</td>
                                <td className="py-3 px-4 font-mono font-black text-sm">
                                  <span className={isPayment ? 'text-emerald-400' : 'text-amber-400'}>
                                    {isPayment ? '-' : '+'}
                                    {tx.amount.toLocaleString('ar-EG')} ج.م
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-stone-400 max-w-xs truncate">{tx.notes || '-'}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
