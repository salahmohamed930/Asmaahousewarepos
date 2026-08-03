import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Award,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Filter,
  Search,
  Check,
  Trash2,
  Printer,
  ShieldCheck,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import { ClosedShift, Transaction } from '../../types';

export const AnalyticsView: React.FC = () => {
  const {
    transactions,
    associates,
    voidTransaction,
    closedShifts,
    closeShift,
    currentAssociate,
  } = usePOS();

  // Sub-tab selection: overview (التحليلات العامة), revenues (قسم الإيرادات المتقدم), shifts (تقفيل وأرشيف الورديات)
  const [subTab, setSubTab] = useState<'overview' | 'revenues' | 'shifts'>('overview');

  // Print modal states for completed shifts
  const [selectedShiftToPrint, setSelectedShiftToPrint] = useState<ClosedShift | null>(null);

  // ==========================================
  // REVENUES TAB STATES
  // ==========================================
  const [revDateFilter, setRevDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [revStartDate, setRevStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [revEndDate, setRevEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [revEmployeeFilter, setRevEmployeeFilter] = useState<string>('all');
  const [revTypeFilter, setRevTypeFilter] = useState<'all' | 'cash' | 'card' | 'installment' | 'debt_payment'>('all');
  const [revSearchCustomer, setRevSearchCustomer] = useState<string>('');

  // ==========================================
  // SHIFT CLOSE STATE
  // ==========================================
  const [shiftCloseEmployeeId, setShiftCloseEmployeeId] = useState<string>(
    currentAssociate?.id || (associates[0]?.id || '')
  );
  // Default shift start is 12 hours ago or start of today
  const getTodayStartStr = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };
  const getNowStr = () => {
    return new Date().toISOString().slice(0, 16);
  };
  const [shiftStartTime, setShiftStartTime] = useState<string>(getTodayStartStr());
  const [shiftEndTime, setShiftEndTime] = useState<string>(getNowStr());
  const [drawerActualCash, setDrawerActualCash] = useState<number>(0);
  const [shiftNotes, setShiftNotes] = useState<string>('');

  // -------------------------------------------------------------
  // DATA PARSING FOR OVERVIEW TAB
  // -------------------------------------------------------------
  const validTransactions = transactions.filter((t) => t.status === 'مكتملة');

  // Total metrics
  const totalRevenue = validTransactions.reduce((acc, t) => acc + (t.grandTotal || 0), 0);
  const totalDiscounts = validTransactions.reduce((acc, t) => acc + (t.discountTotal || 0), 0);
  const totalOrders = validTransactions.length;

  // Revenue breakdown by Price Tier
  let cashRevenue = 0;
  let installmentRevenue = 0;
  let wholesaleRevenue = 0;

  validTransactions.forEach((t) => {
    t.items.forEach((item) => {
      if (item.priceTier === 'cash') cashRevenue += item.totalPrice;
      else if (item.priceTier === 'installment') installmentRevenue += item.totalPrice;
      else if (item.priceTier === 'wholesale') wholesaleRevenue += item.totalPrice;
    });
  });

  // Total Commissions
  let totalCommissionsPaid = 0;
  validTransactions.forEach((t) => {
    t.commissions.forEach((c) => {
      totalCommissionsPaid += c.commissionAmount;
    });
  });

  // Top Associate Leaderboard
  const associatePerformanceMap: Record<
    string,
    { name: string; avatar: string; sales: number; commission: number; count: number }
  > = {};

  associates.forEach((a) => {
    associatePerformanceMap[a.id] = {
      name: a.name,
      avatar: a.avatar,
      sales: 0,
      commission: 0,
      count: 0,
    };
  });

  validTransactions.forEach((t) => {
    t.commissions.forEach((c) => {
      if (associatePerformanceMap[c.associateId]) {
        associatePerformanceMap[c.associateId].sales += c.saleAmount;
        associatePerformanceMap[c.associateId].commission += c.commissionAmount;
        associatePerformanceMap[c.associateId].count += 1;
      }
    });
  });

  const sortedLeaderboard = Object.values(associatePerformanceMap).sort(
    (a, b) => b.sales - a.sales
  );

  // -------------------------------------------------------------
  // REVENUES TAB FILTERING LOGIC
  // -------------------------------------------------------------
  const filteredInflows = transactions.filter((tx) => {
    // 1. Status: only completed sales or payments
    if (tx.status !== 'مكتملة' && tx.status !== 'completed') return false;

    // 2. Date filtering
    const txTime = new Date(tx.timestamp);
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (revDateFilter === 'today') {
      if (txTime < today) return false;
    } else if (revDateFilter === 'yesterday') {
      const endOfYesterday = new Date(today);
      if (txTime < yesterday || txTime >= endOfYesterday) return false;
    } else if (revDateFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (txTime < sevenDaysAgo) return false;
    } else if (revDateFilter === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (txTime < thirtyDaysAgo) return false;
    } else if (revDateFilter === 'custom') {
      const start = new Date(revStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(revEndDate);
      end.setHours(23, 59, 59, 999);
      if (txTime < start || txTime > end) return false;
    }

    // 3. Employee filtering
    if (revEmployeeFilter !== 'all') {
      const assocId = tx.primaryAssociateId || (tx as any).associateId;
      if (assocId !== revEmployeeFilter) return false;
    }

    // 4. Revenue Type / Payment method
    const isDebtPayment = tx.id.startsWith('pay_') || (tx.items.length === 1 && tx.items[0].productId === 'debt_payment');
    
    if (revTypeFilter === 'debt_payment') {
      if (!isDebtPayment) return false;
    } else if (revTypeFilter === 'cash') {
      if (isDebtPayment) return false;
      if (tx.paymentMethod !== 'cash' && tx.paymentMethod !== 'كاش') return false;
    } else if (revTypeFilter === 'card') {
      if (isDebtPayment) return false;
      if (tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش' || tx.paymentMethod === 'installment' || tx.paymentMethod === 'تقسيط شهري') return false;
    } else if (revTypeFilter === 'installment') {
      if (isDebtPayment) return false;
      if (tx.paymentMethod !== 'installment' && tx.paymentMethod !== 'تقسيط شهري') return false;
    }

    // 5. Customer search
    if (revSearchCustomer.trim() !== '') {
      if (!tx.customerName || !tx.customerName.toLowerCase().includes(revSearchCustomer.toLowerCase())) return false;
    }

    return true;
  });

  // Calculate filtered totals
  const totalFilteredSalesVolume = filteredInflows.reduce((acc, tx) => {
    // Only count positive sales for overall volume. Debt payment txs are stored as negative totals.
    const isDebtPayment = tx.id.startsWith('pay_');
    if (isDebtPayment) return acc;
    return acc + (tx.grandTotal || 0);
  }, 0);

  const totalFilteredCashInflow = filteredInflows.reduce((acc, tx) => {
    const isDebtPayment = tx.id.startsWith('pay_');
    if (isDebtPayment) {
      // Debt payment is positive inflow of cash
      return acc + Math.abs(tx.grandTotal);
    }
    if (tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش') {
      return acc + (tx.grandTotal || 0);
    }
    return acc;
  }, 0);

  const totalFilteredCardInflow = filteredInflows.reduce((acc, tx) => {
    const isDebtPayment = tx.id.startsWith('pay_');
    if (isDebtPayment) return acc; // Assume debt collected in cash unless stated
    if (tx.paymentMethod !== 'cash' && tx.paymentMethod !== 'كاش' && tx.paymentMethod !== 'installment' && tx.paymentMethod !== 'تقسيط شهري') {
      return acc + (tx.grandTotal || 0);
    }
    return acc;
  }, 0);

  const totalFilteredDebtCollected = filteredInflows.reduce((acc, tx) => {
    const isDebtPayment = tx.id.startsWith('pay_');
    if (isDebtPayment) {
      return acc + Math.abs(tx.grandTotal);
    }
    return acc;
  }, 0);

  // -------------------------------------------------------------
  // SHIFT SYSTEM STATISTICS CALCULATION
  // -------------------------------------------------------------
  const shiftSelectedEmployee = associates.find((a) => a.id === shiftCloseEmployeeId);

  // Filter transactions within the shift time range for the selected employee (or all)
  const shiftInscopeTransactions = transactions.filter((tx) => {
    if (tx.status !== 'مكتملة' && tx.status !== 'completed') return false;
    
    // Time check
    const txTime = new Date(tx.timestamp).getTime();
    const startMs = new Date(shiftStartTime).getTime();
    const endMs = new Date(shiftEndTime).getTime();
    if (txTime < startMs || txTime > endMs) return false;

    // Employee check
    const assocId = tx.primaryAssociateId || (tx as any).associateId;
    if (shiftCloseEmployeeId !== 'all_associates' && assocId !== shiftCloseEmployeeId) return false;

    return true;
  });

  // Expected cash, card, installment, debt collected during this shift
  const shiftExpectedCashSales = shiftInscopeTransactions
    .filter((tx) => !tx.id.startsWith('pay_') && (tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش'))
    .reduce((acc, tx) => acc + (tx.grandTotal || 0), 0);

  const shiftExpectedDebtCollected = shiftInscopeTransactions
    .filter((tx) => tx.id.startsWith('pay_'))
    .reduce((acc, tx) => acc + Math.abs(tx.grandTotal), 0);

  const shiftExpectedCashTotal = shiftExpectedCashSales + shiftExpectedDebtCollected;

  const shiftExpectedCardTotal = shiftInscopeTransactions
    .filter((tx) => !tx.id.startsWith('pay_') && tx.paymentMethod !== 'cash' && tx.paymentMethod !== 'كاش' && tx.paymentMethod !== 'installment' && tx.paymentMethod !== 'تقسيط شهري')
    .reduce((acc, tx) => acc + (tx.grandTotal || 0), 0);

  const shiftExpectedInstallmentTotal = shiftInscopeTransactions
    .filter((tx) => !tx.id.startsWith('pay_') && (tx.paymentMethod === 'installment' || tx.paymentMethod === 'تقسيط شهري'))
    .reduce((acc, tx) => acc + (tx.grandTotal || 0), 0);

  const shiftSalesCount = shiftInscopeTransactions.filter((tx) => !tx.id.startsWith('pay_')).length;
  const shiftSalesSum = shiftInscopeTransactions
    .filter((tx) => !tx.id.startsWith('pay_'))
    .reduce((acc, tx) => acc + (tx.grandTotal || 0), 0);

  const shiftDiscrepancy = drawerActualCash - shiftExpectedCashTotal;

  // Handle shift submission
  const handleCompleteShiftClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftStartTime || !shiftEndTime) {
      alert('الرجاء تحديد تاريخ بداية ونهاية الوردية.');
      return;
    }

    const employeeName = shiftCloseEmployeeId === 'all_associates' 
      ? 'جميع الموظفين (وردية مجمعة)' 
      : (shiftSelectedEmployee?.name || 'موظف النظام');

    const closedRecord: Omit<ClosedShift, 'id'> = {
      associateId: shiftCloseEmployeeId,
      associateName: employeeName,
      startTime: new Date(shiftStartTime).toISOString(),
      endTime: new Date(shiftEndTime).toISOString(),
      expectedCash: shiftExpectedCashTotal,
      actualCash: drawerActualCash,
      discrepancy: shiftDiscrepancy,
      salesCount: shiftSalesCount,
      totalSales: shiftSalesSum,
      totalCard: shiftExpectedCardTotal,
      totalInstallment: shiftExpectedInstallmentTotal,
      totalDebtCollected: shiftExpectedDebtCollected,
      notes: shiftNotes || 'تم تقفيل الوردية بنجاح',
    };

    closeShift(closedRecord);
    alert(`تم تقفيل الوردية وتسجيل البيانات بنجاح لـ ${employeeName}!`);
    
    // Automatically trigger receipt preview/print
    const fullRecordWithId: ClosedShift = {
      ...closedRecord,
      id: `shift_temp_${Date.now()}`,
    };
    setSelectedShiftToPrint(fullRecordWithId);

    // Reset fields
    setDrawerActualCash(0);
    setShiftNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 dir-rtl space-y-6">

      {/* ======================================================== */}
      {/* 1. TOP HEADER BANNER                                      */}
      {/* ======================================================== */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              قسم الإيرادات وتقفيل الورديات
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              أسماء للأدوات المنزلية • فلاتر مالية احترافية، مبيعات الموظفين، وتقفيل الدرج والخزينة
            </p>
          </div>
        </div>

        {/* Sub-Navigation Buttons inside Analytics/Reports */}
        <div className="flex bg-stone-950/80 p-1 rounded-2xl border border-stone-800 self-start md:self-auto">
          <button
            onClick={() => setSubTab('overview')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              subTab === 'overview'
                ? 'bg-amber-600 text-white font-extrabold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            تحليلات عامة
          </button>
          <button
            onClick={() => setSubTab('revenues')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              subTab === 'revenues'
                ? 'bg-amber-600 text-white font-extrabold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            قسم المبيعات والإيرادات
          </button>
          <button
            onClick={() => setSubTab('shifts')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              subTab === 'shifts'
                ? 'bg-amber-600 text-white font-extrabold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            تقفيل وأرشيف الورديات
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB A: OVERVIEW - GENERAL ANALYTICS                      */}
      {/* ======================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-xs text-stone-400 font-bold block">إجمالي مبيعات النظام</span>
              <span className="text-2xl font-mono font-extrabold text-amber-400 block">
                {totalRevenue.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">من {totalOrders} عملية بيع مكتملة</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-xs text-emerald-400 font-bold block">مبيعات كاش فورية 💵</span>
              <span className="text-2xl font-mono font-extrabold text-stone-100 block">
                {cashRevenue.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">متحصلات الخزينة السريعة</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-xs text-amber-400 font-bold block">مبيعات التقسيط 📅</span>
              <span className="text-2xl font-mono font-extrabold text-stone-100 block">
                {installmentRevenue.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">جدولة دفعات العملاء</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-xs text-indigo-400 font-bold block">مبيعات جملة وآجل 📦</span>
              <span className="text-2xl font-mono font-extrabold text-stone-100 block">
                {wholesaleRevenue.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">شحنات للتجار وحسابات الذمم</span>
            </div>
          </div>

          {/* Leaderboard & Price Tier Visualizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Employee Leaderboard */}
            <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Award className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-extrabold text-stone-100">
                  ترتيب كفاءة البائعين وحساب العمولات
                </h2>
              </div>

              <div className="space-y-3">
                {sortedLeaderboard.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-stone-950 border border-stone-800 rounded-2xl p-3.5"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <span className="w-6 h-6 bg-stone-900 border border-stone-800 text-amber-400 font-mono font-bold rounded-lg text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <img
                        src={item.avatar}
                        alt={item.name}
                        className="w-9 h-9 rounded-xl object-cover ring-2 ring-stone-800"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-100 block">{item.name}</span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {item.count} عمليات بيع ناجحة
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs font-mono font-bold text-stone-100 block">
                        {item.sales.toLocaleString()} ج.م
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        +{item.commission.toFixed(1)} ج.م عمولة
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price system breakdown */}
            <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-extrabold text-stone-100">
                  توزيع المبيعات حسب نظام السعر
                </h2>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-bold">كاش (نقدي)</span>
                    <span className="font-mono text-stone-200">
                      {totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${
                          totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-400 font-bold">تقسيط شهري</span>
                    <span className="font-mono text-stone-200">
                      {totalRevenue > 0 ? Math.round((installmentRevenue / totalRevenue) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{
                        width: `${
                          totalRevenue > 0 ? Math.round((installmentRevenue / totalRevenue) * 100) : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-indigo-400 font-bold">حسابات الجملة</span>
                    <span className="font-mono text-stone-200">
                      {totalRevenue > 0 ? Math.round((wholesaleRevenue / totalRevenue) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{
                        width: `${
                          totalRevenue > 0 ? Math.round((wholesaleRevenue / totalRevenue) * 100) : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mt-6 text-xs text-stone-400 space-y-1">
                  <div className="flex justify-between">
                    <span>إجمالي العمولات المستحقة للبائعين:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {totalCommissionsPaid.toFixed(1)} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>إجمالي الخصومات الممنوحة:</span>
                    <span className="font-mono text-stone-300">
                      {totalDiscounts.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Simple transaction list fallback */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-stone-100">سجل الفواتير والمعاملات الحديثة</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-stone-400 border-b border-stone-800 font-bold uppercase pb-2">
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">البائع المسؤول</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 text-stone-300">
                  {transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-950/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-stone-200">#{tx.receiptNumber}</td>
                      <td className="p-3 text-stone-400">
                        {new Date(tx.timestamp).toLocaleString('ar-EG')}
                      </td>
                      <td className="p-3 font-bold text-amber-400">{tx.primaryAssociateName}</td>
                      <td className="p-3 text-stone-300">{tx.customerName || 'عميل نقدي'}</td>
                      <td className="p-3">
                        {tx.id.startsWith('pay_') ? (
                          <span className="text-emerald-400 font-bold">سداد مديونية الآجل 💵</span>
                        ) : (
                          tx.paymentMethod
                        )}
                      </td>
                      <td className="p-3 font-mono font-extrabold text-stone-100">
                        {Math.abs(tx.grandTotal || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            tx.status === 'معلقة'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : tx.status === 'مكتملة' || tx.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {tx.status === 'مكتملة' && !tx.id.startsWith('pay_') && (
                          <button
                            onClick={() => {
                              if (confirm(`هل تريد إلغاء الفاتورة ${tx.receiptNumber}؟`)) {
                                voidTransaction(tx.id);
                              }
                            }}
                            className="text-stone-500 hover:text-rose-400 text-[11px] font-bold underline"
                          >
                            إلغاء الفاتورة
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB B: REVENUES SECTION WITH DIVERSE PROFESSIONAL FILTERS */}
      {/* ======================================================== */}
      {subTab === 'revenues' && (
        <div className="space-y-6">
          
          {/* Filters Dashboard Card */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 space-x-reverse text-amber-400">
              <Filter className="w-5 h-5" />
              <h2 className="text-base font-extrabold text-stone-100">فلاتر تصفية الإيرادات والمقبوضات الاحترافية</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400">فترة التصفية الزمنية</label>
                <select
                  value={revDateFilter}
                  onChange={(e) => setRevDateFilter(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="today">اليوم الحالي</option>
                  <option value="yesterday">الأمس (24 ساعة مضت)</option>
                  <option value="week">آخر 7 أيام</option>
                  <option value="month">آخر 30 يوم</option>
                  <option value="custom">فترة مخصصة 🗓️</option>
                </select>
              </div>

              {/* Employee/Seller Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400">الموظف / البائع</label>
                <select
                  value={revEmployeeFilter}
                  onChange={(e) => setRevEmployeeFilter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="all">جميع الموظفين والمبيعات</option>
                  {associates.map((assoc) => (
                    <option key={assoc.id} value={assoc.id}>
                      {assoc.name} (كود: {assoc.pin})
                    </option>
                  ))}
                </select>
              </div>

              {/* Inflow Type Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400">نوع الإيراد / طريقة التحصيل</label>
                <select
                  value={revTypeFilter}
                  onChange={(e) => setRevTypeFilter(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="all">الكل (الفواتير والمديونيات)</option>
                  <option value="cash">المبيعات النقدية فقط (كاش)</option>
                  <option value="card">التحصيل الإلكتروني (فيزا / شبكة)</option>
                  <option value="installment">مبيعات التقسيط فقط</option>
                  <option value="debt_payment">تحصيل مديونيات الآجل 💵</option>
                </select>
              </div>

              {/* Customer Search */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400">البحث باسم العميل</label>
                <div className="relative">
                  <input
                    type="text"
                    value={revSearchCustomer}
                    onChange={(e) => setRevSearchCustomer(e.target.value)}
                    placeholder="ابحث باسم العميل..."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <Search className="w-4 h-4 text-stone-500 absolute top-2.5 right-3" />
                </div>
              </div>

            </div>

            {/* Custom Date Inputs (Conditional) */}
            {revDateFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-stone-950 rounded-2xl border border-stone-800/80 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">تاريخ البداية</label>
                  <input
                    type="date"
                    value={revStartDate}
                    onChange={(e) => setRevStartDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={revEndDate}
                    onChange={(e) => setRevEndDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filtered Financial Performance Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-xs text-stone-400 font-bold">حجم مبيعات الفترة</span>
                <span className="p-1 rounded-lg bg-stone-950 text-amber-500"><FileText className="w-3.5 h-3.5" /></span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-amber-400 block">
                {totalFilteredSalesVolume.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">من {filteredInflows.filter(t => !t.id.startsWith('pay_')).length} فاتورة مفلترة</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-xs text-emerald-400 font-bold">التحصيل النقدي المقبوض (كاش)</span>
                <span className="p-1 rounded-lg bg-stone-950 text-emerald-500"><ArrowDownCircle className="w-3.5 h-3.5" /></span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-emerald-400 block">
                {totalFilteredCashInflow.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">شامل سداد المديونيات النقدية</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-xs text-indigo-400 font-bold">التحصيل الإلكتروني (بطاقة/فيزا)</span>
                <span className="p-1 rounded-lg bg-stone-950 text-indigo-500"><ArrowUpCircle className="w-3.5 h-3.5" /></span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-white block">
                {totalFilteredCardInflow.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">حوالات الخزينة البنكية</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-xs text-amber-400 font-bold">المديونيات المحصلة (سداد آجال)</span>
                <span className="p-1 rounded-lg bg-stone-950 text-amber-400"><DollarSign className="w-3.5 h-3.5" /></span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-stone-100 block">
                {totalFilteredDebtCollected.toLocaleString()} ج.م
              </span>
              <span className="text-[10px] text-stone-500">سداد جزئي وكامل للمديونية الآجلة</span>
            </div>

          </div>

          {/* Interactive list of filtered inflows */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-stone-100">أرشيف المقبوضات والإيرادات المفصل للفترة</h3>
              <span className="text-xs font-mono bg-stone-950 border border-stone-800 px-3 py-1 rounded-full text-stone-400 font-bold">
                {filteredInflows.length} معاملة مالية مطابقة
              </span>
            </div>

            {filteredInflows.length === 0 ? (
              <div className="py-12 text-center text-stone-500 space-y-2">
                <AlertCircle className="w-8 h-8 text-stone-600 mx-auto" />
                <p className="text-sm font-bold">لا توجد إيرادات مطابقة للفلاتر المحددة</p>
                <p className="text-xs">جرب تغيير شروط البحث أو الفترة الزمنية في الأعلى</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-stone-400 border-b border-stone-800 font-bold uppercase pb-2">
                      <th className="p-3">رقم المعاملة / الفاتورة</th>
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">نوع العملية</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">البائع المسؤول</th>
                      <th className="p-3">طريقة التحصيل</th>
                      <th className="p-3">المبلغ المحصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-stone-300">
                    {filteredInflows.map((tx) => {
                      const isDebtPayment = tx.id.startsWith('pay_');
                      const actualInflowAmount = isDebtPayment ? Math.abs(tx.grandTotal) : (tx.grandTotal || 0);

                      return (
                        <tr key={tx.id} className="hover:bg-stone-950/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-amber-400">
                            #{tx.receiptNumber}
                          </td>
                          <td className="p-3 text-stone-400">
                            {new Date(tx.timestamp).toLocaleString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 font-bold">
                            {isDebtPayment ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                                💵 سداد مديونية العميل
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-stone-950 text-stone-300 border border-stone-800">
                                🛒 فاتورة مبيعات
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-stone-100">{tx.customerName || 'عميل نقدي'}</td>
                          <td className="p-3 font-bold text-stone-300">{tx.primaryAssociateName}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-stone-950 text-stone-400 border border-stone-800">
                              {isDebtPayment 
                                ? (tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش' ? 'كاش 💵' : 'فيزا / بطاقة 💳') 
                                : (tx.paymentMethod === 'cash' || tx.paymentMethod === 'كاش' 
                                    ? 'كاش 💵' 
                                    : (tx.paymentMethod === 'installment' || tx.paymentMethod === 'تقسيط شهري' ? 'تقسيط 📅' : 'بطاقة 💳'))}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-extrabold text-white text-sm">
                            {actualInflowAmount.toLocaleString()} ج.م
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
      )}

      {/* ======================================================== */}
      {/* TAB C: SHIFT CLOSING AND SHIFT CLOSURES ARCHIVE          */}
      {/* ======================================================== */}
      {subTab === 'shifts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Shift Closure Action Form (7 Cols) */}
            <form
              onSubmit={handleCompleteShiftClose}
              className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-6"
            >
              <div className="flex items-center space-x-2 space-x-reverse text-amber-500">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-base font-extrabold text-stone-100">
                  واجهة ومحضر تقفيل الوردية الحالية وتسليم الدرج
                </h2>
              </div>

              {/* Step 1: Select Employee and shift range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-950 p-4 rounded-2xl border border-stone-800/80">
                
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-xs font-bold text-stone-400">البائع المسؤول المراد تقفيل ورديته</label>
                  <select
                    value={shiftCloseEmployeeId}
                    onChange={(e) => setShiftCloseEmployeeId(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="all_associates">جميع الموظفين (تقفيل وردية مجمعة للمحل)</option>
                    {associates.map((assoc) => (
                      <option key={assoc.id} value={assoc.id}>
                        {assoc.name} (كود البائع: {assoc.pin})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">تاريخ ووقت بداية الوردية</label>
                  <input
                    type="datetime-local"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">تاريخ ووقت نهاية الوردية (الآن)</label>
                  <input
                    type="datetime-local"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

              </div>

              {/* Step 2: System Calculations vs Actual drawer cash */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-amber-500 tracking-wider">
                  الحسابات التقديرية التلقائية للفترة الزمنية المحددة:
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 text-center">
                    <span className="text-[10px] text-stone-400 font-bold block">إجمالي مبيعات الوردية</span>
                    <span className="text-sm font-mono font-extrabold text-stone-100 block mt-1">
                      {shiftSalesSum.toLocaleString()} ج.م
                    </span>
                    <span className="text-[9px] text-stone-500 block mt-0.5">{shiftSalesCount} فواتير</span>
                  </div>

                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 text-center">
                    <span className="text-[10px] text-stone-400 font-bold block">المقبوضات كاش المتوقعة</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-400 block mt-1">
                      {shiftExpectedCashTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-[9px] text-stone-500 block mt-0.5">شامل مديونيات كاش</span>
                  </div>

                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 text-center">
                    <span className="text-[10px] text-stone-400 font-bold block">مقبوضات الفيزا المتوقعة</span>
                    <span className="text-sm font-mono font-extrabold text-indigo-400 block mt-1">
                      {shiftExpectedCardTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-[9px] text-stone-500 block mt-0.5">مدفوعات بطاقة</span>
                  </div>

                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 text-center">
                    <span className="text-[10px] text-stone-400 font-bold block">مبيعات التقسيط بالوردية</span>
                    <span className="text-sm font-mono font-extrabold text-amber-400 block mt-1">
                      {shiftExpectedInstallmentTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-[9px] text-stone-500 block mt-0.5">عقود الوردية</span>
                  </div>

                </div>
              </div>

              {/* Step 3: Drawer Cash Reconciliation Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-200 block">
                      المبلغ النقدي الفعلي بالدرج (كاش) <span className="text-amber-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        value={drawerActualCash || ''}
                        onChange={(e) => setDrawerActualCash(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="أدخل المبلغ المقبوض باليد..."
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-3 text-sm text-amber-400 font-extrabold focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute left-3 top-3 text-xs text-stone-500">ج.م</span>
                    </div>
                  </div>

                  {/* Discrepancy indicator */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 block">حالة الخزينة والدرج (العجز / الزيادة)</label>
                    <div className={`p-3.5 rounded-xl border font-bold text-center flex flex-col justify-center h-[50px] ${
                      shiftDiscrepancy === 0
                        ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/60'
                        : shiftDiscrepancy < 0
                        ? 'bg-rose-950/30 text-rose-400 border-rose-900/60'
                        : 'bg-amber-950/30 text-amber-400 border-amber-900/60'
                    }`}>
                      {shiftDiscrepancy === 0 ? (
                        <span className="text-xs font-extrabold">مطابق تماماً ✓ (0 ج.م)</span>
                      ) : shiftDiscrepancy < 0 ? (
                        <span className="text-xs font-extrabold">عجز بقيمة: {Math.abs(shiftDiscrepancy).toLocaleString()} ج.م ⚠️</span>
                      ) : (
                        <span className="text-xs font-extrabold">زيادة بقيمة: {shiftDiscrepancy.toLocaleString()} ج.م 💰</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Additional notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">ملاحظات تسليم الوردية والخزينة</label>
                  <textarea
                    rows={2}
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="ملاحظات حول عهدة الدرج، الفئات النقدية، أو عجز مسجل..."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Form submit */}
              <button
                type="submit"
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 space-x-reverse transition-all shadow-lg active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>إتمام تقفيل الوردية الحالية وحفظ المحضر</span>
              </button>

            </form>

            {/* Shift Archive / Previous closures list (5 Cols) */}
            <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-extrabold text-stone-100">سجل أرشيف الورديات المغلقة</h2>
                </div>
                <span className="text-xs font-mono bg-stone-950 border border-stone-850 px-2.5 py-0.5 rounded-full text-stone-400 font-bold">
                  {closedShifts.length} وردية
                </span>
              </div>

              {closedShifts.length === 0 ? (
                <div className="py-12 text-center text-stone-600 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-stone-700" />
                  <p className="text-xs font-bold">لم يتم إغلاق أي وردية بعد</p>
                  <p className="text-[10px]">استخدم واجهة تقفيل الوردية على اليمين لتسجيل أول وردية مغلقة</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {closedShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="bg-stone-950 border border-stone-850 rounded-2xl p-4 space-y-3 hover:border-stone-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-stone-100 block">{shift.associateName}</span>
                          <span className="text-[9px] text-stone-400 block mt-0.5">
                            {new Date(shift.endTime).toLocaleString('ar-EG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Discrepancy badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          shift.discrepancy === 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-900/60'
                            : shift.discrepancy < 0
                            ? 'bg-rose-950 text-rose-300 border border-rose-900/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-900/60'
                        }`}>
                          {shift.discrepancy === 0 
                            ? 'مطابق تماماً ✓' 
                            : shift.discrepancy < 0 
                            ? `عجز: ${Math.abs(shift.discrepancy).toLocaleString()} ج.م` 
                            : `زيادة: ${shift.discrepancy.toLocaleString()} ج.م`}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-850/60 text-center">
                        <div>
                          <span className="text-[9px] text-stone-500 block">المقبوض كاش</span>
                          <span className="text-xs font-mono font-bold text-stone-200">{shift.actualCash.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-500 block">الرصيد التقديري</span>
                          <span className="text-xs font-mono font-bold text-stone-200">{shift.expectedCash.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-500 block">الفواتير</span>
                          <span className="text-xs font-mono font-bold text-stone-200">{shift.salesCount}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-stone-400">
                        <span className="truncate max-w-[160px] italic">"{shift.notes}"</span>
                        <button
                          type="button"
                          onClick={() => setSelectedShiftToPrint(shift)}
                          className="px-2 py-1 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-lg flex items-center space-x-1 space-x-reverse border border-stone-800"
                        >
                          <Printer className="w-3 h-3 text-amber-500" />
                          <span>عرض وطباعة المحضر</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SHIFT CLOSURE PRINT RECEIPT MODAL                         */}
      {/* ======================================================== */}
      {selectedShiftToPrint && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white text-stone-900 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            
            {/* Close button */}
            <button
              onClick={() => setSelectedShiftToPrint(null)}
              className="absolute top-4 left-4 p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full transition-all"
            >
              ✕
            </button>

            {/* Receipt Printable Container */}
            <div id="shift-print-receipt" className="space-y-4 text-center font-mono text-xs">
              
              <div className="border-b border-dashed border-stone-300 pb-3">
                <h3 className="font-extrabold text-base tracking-tight text-stone-900">أسماء للأدوات المنزلية</h3>
                <p className="text-[10px] text-stone-500 mt-0.5">محضر ومستند رسمي لتقفيل وإغلاق الوردية</p>
                <p className="text-[9px] text-stone-400 font-bold mt-1">الرقم المرجعي: #{selectedShiftToPrint.id}</p>
              </div>

              {/* Shift Details */}
              <div className="text-right space-y-1.5 text-[11px] border-b border-dashed border-stone-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-stone-500">اسم الكاشير/الموظف:</span>
                  <span className="font-bold text-stone-900">{selectedShiftToPrint.associateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">وقت البداية:</span>
                  <span className="font-mono text-stone-800">{new Date(selectedShiftToPrint.startTime).toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">وقت الإغلاق والتسليم:</span>
                  <span className="font-mono text-stone-800">{new Date(selectedShiftToPrint.endTime).toLocaleString('ar-EG')}</span>
                </div>
              </div>

              {/* Finances */}
              <div className="text-right space-y-1.5 text-[11px] border-b border-dashed border-stone-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-stone-500">عدد مبيعات الوردية:</span>
                  <span className="font-bold text-stone-900">{selectedShiftToPrint.salesCount} فاتورة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">إجمالي حجم المبيعات:</span>
                  <span className="font-mono font-bold text-stone-900">{selectedShiftToPrint.totalSales.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">تحصيل مديونيات آجلة:</span>
                  <span className="font-mono font-bold text-stone-900">+{selectedShiftToPrint.totalDebtCollected.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">المقبوضات بالبطاقة (شبكة):</span>
                  <span className="font-mono text-stone-800">{selectedShiftToPrint.totalCard.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">جدولة تقسيط الوردية:</span>
                  <span className="font-mono text-stone-800">{selectedShiftToPrint.totalInstallment.toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* Reconciliation values */}
              <div className="text-right space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500 font-bold">الرصيد النقدي المتوقع (كاش):</span>
                  <span className="font-mono font-extrabold text-stone-900">{selectedShiftToPrint.expectedCash.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-xs border-t border-stone-200 pt-1.5">
                  <span className="text-stone-500 font-bold">المبلغ الفعلي المقبوض (كاش):</span>
                  <span className="font-mono font-extrabold text-amber-600">{selectedShiftToPrint.actualCash.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-xs border-t border-stone-200 pt-1.5 font-bold">
                  <span className="text-stone-600 font-extrabold">مقدار العجز / الزيادة:</span>
                  <span className={`font-mono font-extrabold ${
                    selectedShiftToPrint.discrepancy === 0
                      ? 'text-emerald-600'
                      : selectedShiftToPrint.discrepancy < 0
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}>
                    {selectedShiftToPrint.discrepancy === 0 
                      ? 'مطابق (0 ج.م)' 
                      : selectedShiftToPrint.discrepancy < 0 
                      ? `عجز: ${Math.abs(selectedShiftToPrint.discrepancy).toLocaleString()} ج.م` 
                      : `زيادة: ${selectedShiftToPrint.discrepancy.toLocaleString()} ج.م`}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="text-right text-[10px] text-stone-500 italic px-2 py-1 bg-stone-50 rounded-xl">
                ملاحظات: {selectedShiftToPrint.notes || 'لا توجد'}
              </div>

              {/* Signatures placeholder */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-[9px] border-t border-dashed border-stone-300">
                <div className="text-center">
                  <p className="text-stone-400">توقيع المستلِم (المشرف)</p>
                  <p className="mt-6 border-b border-stone-300 w-24 mx-auto"></p>
                </div>
                <div className="text-center">
                  <p className="text-stone-400">توقيع المستلِم (الكاشير)</p>
                  <p className="mt-6 border-b border-stone-300 w-24 mx-auto"></p>
                </div>
              </div>

            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة المحضر</span>
              </button>
              <button
                onClick={() => setSelectedShiftToPrint(null)}
                className="px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-2xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AnalyticsView;
