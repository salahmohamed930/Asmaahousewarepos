import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer } from '../../types';
import {
  UserCheck,
  UserPlus,
  Search,
  ShoppingBag,
  Heart,
  X,
  Phone,
  Mail,
  FileText,
  MapPin,
  Edit,
  Filter,
  ArrowUpDown,
  DollarSign,
  AlertCircle,
  CreditCard,
  Users,
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { CustomerAccountModal } from './CustomerAccountModal';
import { CustomerPaymentModal } from './CustomerPaymentModal';
import { matchesArabicQuery } from '../../utils/textUtils';

export const CustomersView: React.FC = () => {
  const {
    customers,
    associates,
    transactions,
    addCustomer,
    setSelectedCustomer,
    setActiveTab,
  } = usePOS();

  const [search, setSearch] = useState('');
  const [debtFilter, setDebtFilter] = useState<'all' | 'indebted' | 'clear' | 'credit_eligible'>('all');
  const [assocFilter, setAssocFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'debt_desc' | 'spent_desc' | 'points_desc' | 'points_asc' | 'last_payment_desc' | 'last_payment_asc' | 'name_asc'
  >('debt_desc');

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountCust, setSelectedAccountCust] = useState<Customer | null>(null);
  const [payModalCustId, setPayModalCustId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleShortcutAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; key: string }>;
      const action = customEvent.detail?.action;

      if (action === 'pay_installment') {
        const indebtedCust = customers.find((c) => (c.currentDebt || 0) > 0);
        if (indebtedCust) {
          setPayModalCustId(indebtedCust.id);
        } else {
          setDebtFilter('indebted');
        }
      }
    };

    window.addEventListener('pos-shortcut-action', handleShortcutAction);
    return () => {
      window.removeEventListener('pos-shortcut-action', handleShortcutAction);
    };
  }, [customers]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    preferredAssociateId: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    isCreditEligible: false,
    creditLimit: 0,
    monthlyInstallmentAmount: 0,
    notes: '',
    address: '',
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      preferredAssociateId: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      isCreditEligible: false,
      creditLimit: 0,
      monthlyInstallmentAmount: 0,
      notes: '',
      address: '',
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    addCustomer(formData);
    setIsAddModalOpen(false);
  };

  // High-performance single-pass O(T) memoized index of each customer's last payment date
  const lastPaymentMap = useMemo(() => {
    const map = new Map<string, { timestamp: number; formattedDate?: string }>();
    if (!transactions || transactions.length === 0) return map;

    for (const tx of transactions) {
      if (!tx.customerId) continue;
      const isPayment =
        tx.id?.startsWith('pay_') ||
        tx.items?.some((i: any) => i.productId === 'debt_payment' || i.product?.id === 'debt_payment') ||
        ((tx.amountPaid || 0) > 0 && tx.status === 'مكتملة');

      if (isPayment) {
        const dStr = tx.timestamp || (tx as any).createdAt || (tx as any).date;
        if (!dStr) continue;
        const tMs = new Date(dStr).getTime();
        if (!isNaN(tMs)) {
          const prev = map.get(tx.customerId);
          if (!prev || tMs > prev.timestamp) {
            map.set(tx.customerId, {
              timestamp: tMs,
              formattedDate: new Date(tMs).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              }),
            });
          }
        }
      }
    }
    return map;
  }, [transactions]);

  // Stats Calculations
  const totalCustomersCount = customers.length;
  const indebtedCustomers = useMemo(() => customers.filter((c) => (c.currentDebt || 0) > 0), [customers]);
  const totalDebtSum = useMemo(() => indebtedCustomers.reduce((acc, c) => acc + (c.currentDebt || 0), 0), [indebtedCustomers]);
  const creditEligibleCount = useMemo(() => customers.filter((c) => c.isCreditEligible).length, [customers]);
  const totalSpentSum = useMemo(() => customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0), [customers]);

  // Filtering & Sorting Logic
  const filteredAndSortedCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = customers.filter((c) => {
      // 1. Text Search (Name, Phone, Email, Address, Notes)
      if (q) {
        const matchSearch =
          matchesArabicQuery(c.name, q) ||
          (c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          (c.phone || '').includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          matchesArabicQuery(c.address, q) ||
          matchesArabicQuery(c.notes, q) ||
          String(c.id) === q;

        if (!matchSearch) return false;
      }

      // 2. Debt Filter
      if (debtFilter === 'indebted' && (c.currentDebt || 0) <= 0) return false;
      if (debtFilter === 'clear' && (c.currentDebt || 0) > 0) return false;
      if (debtFilter === 'credit_eligible' && !c.isCreditEligible) return false;

      // 3. Preferred Associate Filter
      if (assocFilter !== 'all' && c.preferredAssociateId !== assocFilter) return false;

      return true;
    });

    // Fast O(1) sort using precomputed map
    return result.sort((a, b) => {
      if (sortBy === 'debt_desc') {
        return (b.currentDebt || 0) - (a.currentDebt || 0);
      }
      if (sortBy === 'last_payment_desc') {
        const tA = lastPaymentMap.get(a.id)?.timestamp || 0;
        const tB = lastPaymentMap.get(b.id)?.timestamp || 0;
        return tB - tA;
      }
      if (sortBy === 'last_payment_asc') {
        const tA = lastPaymentMap.get(a.id)?.timestamp || 0;
        const tB = lastPaymentMap.get(b.id)?.timestamp || 0;
        if (tA === 0 && tB > 0) return 1;
        if (tB === 0 && tA > 0) return -1;
        return tA - tB;
      }
      if (sortBy === 'points_desc') {
        return (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0);
      }
      if (sortBy === 'points_asc') {
        return (a.loyaltyPoints || 0) - (b.loyaltyPoints || 0);
      }
      if (sortBy === 'spent_desc') {
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', 'ar');
      }
      return 0;
    });
  }, [customers, search, debtFilter, assocFilter, sortBy, lastPaymentMap]);

  // Reset to page 1 whenever search, filters, sorting or page size changes
  useEffect(() => {
    setPage(1);
  }, [search, debtFilter, assocFilter, sortBy, pageSize]);

  const totalFilteredCount = filteredAndSortedCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  // Current slice for pagination
  const paginatedCustomers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedCustomers, page, pageSize]);

  const startRecord = totalFilteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalFilteredCount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 dir-rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              دليل العملاء وحسابات الآجل والجملة
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              متابعة مشتريات العملاء، كشوف الحساب، تحصيل المديونيات، ونقاط الولاء
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => setPayModalCustId('')}
            className="py-3 px-4 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-bold shadow flex items-center justify-center space-x-2 space-x-reverse transition-all"
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>سداد الأقساط والمديونيات</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-[11px] text-stone-400 block font-bold">إجمالي العملاء المسجلين</span>
            <span className="font-mono text-xl font-black text-stone-100">{totalCustomersCount} عميل</span>
          </div>
          <div className="w-9 h-9 bg-stone-800 text-stone-300 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-[11px] text-stone-400 block font-bold">إجمالي ديون العملاء المستحقة</span>
            <span className={`font-mono text-xl font-black ${totalDebtSum > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {totalDebtSum.toLocaleString()} ج.م
            </span>
          </div>
          <div className="w-9 h-9 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-[11px] text-stone-400 block font-bold">العملاء المدينون (الآجل)</span>
            <span className="font-mono text-xl font-black text-amber-400">{indebtedCustomers.length} عميل</span>
          </div>
          <div className="w-9 h-9 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-[11px] text-stone-400 block font-bold">مؤهلون للآجل والجملة</span>
            <span className="font-mono text-xl font-black text-emerald-400">{creditEligibleCount} عميل</span>
          </div>
          <div className="w-9 h-9 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters and Controls Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 shadow-xl space-y-3">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="بحث باسم العميل، رقم الهاتف، العنوان، أو الملاحظات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-100 rounded-2xl pr-10 pl-8 py-2.5 focus:outline-none focus:border-amber-500"
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

          {/* Sort Selector */}
          <div className="flex items-center space-x-2 space-x-reverse shrink-0">
            <ArrowUpDown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-stone-400 whitespace-nowrap">الترتيب:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-stone-950 border border-stone-800 text-xs font-bold text-amber-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm"
            >
              <option value="debt_desc">💳 الأعلى مديونية أولاً</option>
              <option value="last_payment_desc">📅 أحدث تاريخ سداد / دفع</option>
              <option value="last_payment_asc">🗓️ أقدم تاريخ سداد / دفع</option>
              <option value="points_desc">⭐ الأعلى في نقاط الولاء</option>
              <option value="points_asc">✨ الأقل في نقاط الولاء</option>
              <option value="spent_desc">🛍️ الأكثر شراءً ومبيعات</option>
              <option value="name_asc">🔤 الاسم (أبجدي أ - ي)</option>
            </select>
          </div>

        </div>

        {/* Filter Chips & Seller Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-850 text-xs">
          
          {/* Debt Filter Chips */}
          <div className="flex items-center space-x-1.5 space-x-reverse flex-wrap gap-y-1">
            <span className="text-[11px] font-bold text-stone-400 flex items-center gap-1 ml-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>تصفية المديونية:</span>
            </span>

            <button
              onClick={() => setDebtFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                debtFilter === 'all'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-stone-950 text-stone-400 border border-stone-800 hover:bg-stone-800'
              }`}
            >
              الكل ({customers.length})
            </button>

            <button
              onClick={() => setDebtFilter('indebted')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse ${
                debtFilter === 'indebted'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-stone-950 text-rose-400 border border-stone-800 hover:bg-stone-800'
              }`}
            >
              <span>عليهم مديونيات</span>
              <span className="bg-stone-900 px-1.5 py-0.2 rounded-md font-mono text-[10px]">{indebtedCustomers.length}</span>
            </button>

            <button
              onClick={() => setDebtFilter('clear')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                debtFilter === 'clear'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-stone-950 text-emerald-400 border border-stone-800 hover:bg-stone-800'
              }`}
            >
              خالي المديونية ({customers.length - indebtedCustomers.length})
            </button>

            <button
              onClick={() => setDebtFilter('credit_eligible')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                debtFilter === 'credit_eligible'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-stone-950 text-stone-400 border border-stone-800 hover:bg-stone-800'
              }`}
            >
              مؤهلين للآجل ({creditEligibleCount})
            </button>
          </div>

          {/* Preferred Seller Filter */}
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <span className="text-[11px] text-stone-400 font-bold">البائع المفضل:</span>
            <select
              value={assocFilter}
              onChange={(e) => setAssocFilter(e.target.value)}
              className="bg-stone-950 border border-stone-800 text-xs text-stone-300 rounded-xl px-2.5 py-1 focus:outline-none focus:border-amber-500 font-bold"
            >
              <option value="all">جميع البائعين</option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Pagination & Count Header Bar */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-300 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-stone-200">
            {totalFilteredCount === 0 ? (
              <span className="text-stone-400">لا توجد نتائج مطابقة</span>
            ) : (
              <span>
                عرض <strong className="text-amber-400 font-mono">{startRecord}</strong> - <strong className="text-amber-400 font-mono">{endRecord}</strong> من إجمالي <strong className="text-stone-100 font-mono">{totalFilteredCount}</strong> عميل
              </span>
            )}
          </span>
          <div className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 px-2.5 py-1 rounded-xl border border-stone-800">
            <span className="text-[11px] text-stone-400 font-medium">عدد الحسابات بالصفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-stone-900 text-amber-400 font-bold text-xs border border-stone-800 rounded px-2 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value={12}>12 عميل</option>
              <option value={24}>24 عميل</option>
              <option value={48}>48 عميل</option>
              <option value={96}>96 عميل</option>
            </select>
          </div>
        </div>

        {/* Top Pagination Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-1 space-x-reverse">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>السابقة</span>
            </button>
            <span className="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg font-extrabold font-mono text-xs">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <span>التالية</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCustomers.length === 0 ? (
          <div className="col-span-full bg-stone-900 border border-stone-800 rounded-3xl p-8 text-center text-stone-400 space-y-2">
            <UserCheck className="w-8 h-8 text-stone-600 mx-auto" />
            <p className="text-sm font-bold text-stone-300">لم يتم العثور على عملاء يطابقون خيارات الفلترة المحددة.</p>
            <button
              onClick={() => { setSearch(''); setDebtFilter('all'); setAssocFilter('all'); }}
              className="text-amber-400 text-xs font-bold underline"
            >
              إعادة ضبط الفلاتر والبحث
            </button>
          </div>
        ) : (
          paginatedCustomers.map((cust, idx) => {
            const prefAssoc = cust.preferredAssociateId
              ? associates.find((a) => a.id === cust.preferredAssociateId)
              : null;

            const currentDebt = cust.currentDebt || 0;
            const lastPayment = lastPaymentMap.get(cust.id) || { timestamp: 0 };

            return (
              <div
                key={cust.id && cust.id !== 'null' ? cust.id : `cust_${idx}`}
                className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between hover:border-amber-500/40 transition-all"
              >
                <div 
                  onClick={() => setSelectedAccountCust(cust)}
                  className="cursor-pointer group space-y-3"
                  title="اضغط لفتح كشف حساب العميل والمديونيات والمدفوعات"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <div className="w-11 h-11 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-stone-100 group-hover:text-amber-400 transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>{cust.name}</span>
                          {cust.isCreditEligible && (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                              مؤهل للآجل
                            </span>
                          )}
                          {currentDebt > 0 && (
                            <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                              مستحق {currentDebt.toLocaleString()} ج.م
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-amber-400 font-mono flex items-center space-x-1 space-x-reverse mt-0.5">
                          <Phone className="w-3 h-3 text-stone-500" />
                          <span>{cust.phone}</span>
                        </p>
                        {cust.email && <p className="text-[10px] text-stone-500">{cust.email}</p>}
                        {cust.address && (
                          <p className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{cust.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-stone-950 border border-stone-800 rounded-2xl p-2.5 text-center text-[10px]">
                    <div>
                      <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                        نقاط الولاء
                      </span>
                      <span className="font-mono font-extrabold text-amber-400">
                        {cust.loyaltyPoints || 0} ن
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                        المبيعات
                      </span>
                      <span className="font-mono font-extrabold text-stone-100">
                        {(cust.totalSpent || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                        المديونية
                      </span>
                      <span className={`font-mono font-extrabold block ${currentDebt > 0 ? 'text-rose-400 font-black' : 'text-emerald-400'}`}>
                        {currentDebt > 0 ? `${currentDebt.toLocaleString()} ج.م` : '0'}
                      </span>
                    </div>
                  </div>

                  {cust.monthlyInstallmentAmount && cust.monthlyInstallmentAmount > 0 ? (
                    <div className="flex items-center justify-between text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 rounded-xl font-bold">
                      <span className="flex items-center space-x-1.5 space-x-reverse">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>القسط الشهري:</span>
                      </span>
                      <span className="font-mono text-amber-200 font-extrabold">
                        {cust.monthlyInstallmentAmount.toLocaleString()} ج.م
                      </span>
                    </div>
                  ) : null}

                  {lastPayment.formattedDate && (
                    <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/40 px-2.5 py-1.5 rounded-xl font-bold">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>آخر سداد:</span>
                      <span className="font-mono text-amber-200">{lastPayment.formattedDate}</span>
                    </div>
                  )}

                  {prefAssoc && (
                    <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-stone-400 bg-stone-950/60 border border-stone-800/80 p-2 rounded-xl">
                      <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
                      <span>البائع المفضل:</span>
                      <span className="font-semibold text-stone-200">{prefAssoc.name}</span>
                    </div>
                  )}

                  {cust.notes && (
                    <div className="flex items-start space-x-2 space-x-reverse text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                      <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <p className="line-clamp-2 text-stone-300 font-medium leading-relaxed">
                        {cust.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 border-t border-stone-850 pt-3 text-xs">
                  <button
                    onClick={() => setPayModalCustId(cust.id)}
                    className="py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl font-bold transition-all flex items-center justify-center space-x-1 space-x-reverse"
                    title="تسديد / تحصيل دفعة مديونية"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>تحصيل</span>
                  </button>

                  <button
                    onClick={() => setSelectedAccountCust(cust)}
                    className="py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 rounded-xl font-bold transition-all flex items-center justify-center space-x-1 space-x-reverse"
                  >
                    <Edit className="w-3.5 h-3.5 text-amber-400" />
                    <span>كشف حساب</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setActiveTab('register');
                    }}
                    className="py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all flex items-center justify-center space-x-1 space-x-reverse"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>الكاشير</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar (BOTTOM) */}
      {totalPages > 1 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-300 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-300">
              عرض {startRecord} - {endRecord} من إجمالي {totalFilteredCount} عميل
            </span>
          </div>

          <div className="flex items-center space-x-1 space-x-reverse">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>السابقة</span>
            </button>
            <span className="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg font-extrabold font-mono">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <span>التالية</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4">إنشاء ملف عميل جديد</h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">اسم العميل / اسم المحل</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">البائع المفضل للعميل</label>
                <select
                  value={formData.preferredAssociateId}
                  onChange={(e) =>
                    setFormData({ ...formData, preferredAssociateId: e.target.value })
                  }
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                >
                  <option value="">بدون بائع محدد</option>
                  {associates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-stone-800 space-y-3">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isCreditEligible}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        isCreditEligible: e.target.checked,
                        creditLimit: e.target.checked ? 10000 : 0 
                      })
                    }
                    className="rounded border-stone-800 bg-stone-950 text-amber-600 focus:ring-amber-500 focus:ring-opacity-25"
                  />
                  <span className="text-stone-300 font-bold">تأهيل العميل للشراء الآجل والجملة</span>
                </label>

                {formData.isCreditEligible && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-stone-400 mb-1">الحد الائتماني الكلي (سقف المديونية ج.م)</label>
                      <input
                        type="number"
                        value={formData.creditLimit || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="10000"
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-amber-400 mb-1 font-bold">المبلغ المفترض تسديده شهرياً / القسط (ج.م)</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.monthlyInstallmentAmount || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, monthlyInstallmentAmount: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="أدخل قيمة القسط الشهري المفترض..."
                        className="w-full bg-stone-950 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-stone-400 mb-1">العنوان / السكن</label>
                <input
                  type="text"
                  placeholder="مثال: القاهرة، مدينة نصر، شارع الطيران..."
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">ملاحظات ومذكرة خاصة بالعميل (اختياري)</label>
                <textarea
                  placeholder="أضف ملاحظات خاصة بالعميل هنا..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg mt-4"
              >
                حفظ ملف العميل
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Account Modal */}
      {selectedAccountCust && (
        <CustomerAccountModal
          customer={customers.find(c => c.id === selectedAccountCust.id) || selectedAccountCust}
          isOpen={true}
          onClose={() => setSelectedAccountCust(null)}
        />
      )}

      {/* Customer Debt Payment Modal */}
      <CustomerPaymentModal
        isOpen={payModalCustId !== null}
        onClose={() => setPayModalCustId(null)}
        initialCustomerId={payModalCustId || undefined}
      />

    </div>
  );
};

export default CustomersView;
