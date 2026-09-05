import React, { useState, useMemo } from 'react';
import { Customer, Transaction, PaymentMethod } from '../../types';
import { usePOS } from '../../context/POSContext';
import { 
  X, 
  FileText, 
  CreditCard, 
  History, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  PlusCircle,
  Sparkles,
  Phone,
  Mail,
  UserCheck,
  MapPin,
  Edit,
  Save,
  User,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  ArrowUpDown
} from 'lucide-react';
import { ReceiptModal } from '../Register/ReceiptModal';
import { InvoiceDetailModal } from '../Common/InvoiceDetailModal';
import { CustomerStatementReceiptModal } from './CustomerStatementReceiptModal';
import { matchesArabicQuery } from '../../utils/textUtils';

interface CustomerAccountModalProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
}

type ActiveSubTab = 'overview' | 'statement' | 'invoices' | 'payments';

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  customer,
  isOpen,
  onClose
}) => {
  const { transactions, payCustomerDebt, updateCustomer } = usePOS();
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('overview');
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  
  // Statement search & pagination
  const [statementSearch, setStatementSearch] = useState<string>('');
  const [statementPage, setStatementPage] = useState<number>(1);
  const statementPageSize = 10;

  // Invoice search & pagination inside customer account
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const invoicePageSize = 10;

  // Payments search & pagination inside customer account
  const [paymentSearch, setPaymentSearch] = useState<string>('');
  const [paymentPage, setPaymentPage] = useState<number>(1);
  const paymentPageSize = 10;
  
  // Basic Info States (Name, Phone, Email)
  const [customerName, setCustomerName] = useState<string>(customer.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(customer.phone || '');
  const [customerEmail, setCustomerEmail] = useState<string>(customer.email || '');
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState<boolean>(false);
  const [basicInfoSuccess, setBasicInfoSuccess] = useState<string>('');

  // Credit eligibility states
  const [isCreditEligible, setIsCreditEligible] = useState<boolean>(customer.isCreditEligible || false);
  const [creditLimitInput, setCreditLimitInput] = useState<string>(String(customer.creditLimit || 0));
  const [monthlyInstallmentInput, setMonthlyInstallmentInput] = useState<string>(String(customer.monthlyInstallmentAmount || 0));
  const [creditSuccess, setCreditSuccess] = useState<string>('');

  // Customer notes state
  const [customerNotes, setCustomerNotes] = useState<string>(customer.notes || '');
  const [notesSavedMessage, setNotesSavedMessage] = useState<string>('');

  // Customer address state
  const [customerAddress, setCustomerAddress] = useState<string>(customer.address || '');
  const [addressSavedMessage, setAddressSavedMessage] = useState<string>('');

  React.useEffect(() => {
    setCustomerName(customer.name || '');
    setCustomerPhone(customer.phone || '');
    setCustomerEmail(customer.email || '');
    setIsCreditEligible(customer.isCreditEligible || false);
    setCreditLimitInput(String(customer.creditLimit || 0));
    setMonthlyInstallmentInput(String(customer.monthlyInstallmentAmount || 0));
    setCustomerNotes(customer.notes || '');
    setCustomerAddress(customer.address || '');
  }, [customer]);

  // Payment states in sidebar/modal
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  // Filter transactions for this customer
  const customerTx = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return transactions.filter(t => {
      if (!t) return false;
      if (t.customerId && t.customerId === customer.id) return true;
      if (t.customerName && t.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase()) return true;
      return false;
    });
  }, [transactions, customer.id, customer.name]);

  // Helper to determine debt effect of a transaction
  const getDebtEffect = (tx: Transaction) => {
    const isPayment = tx.items.some(
      (item) => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || tx.id.startsWith('pay_')
    );
    if (isPayment) {
      const amount = Math.abs(tx.grandTotal || tx.amountPaid || 0);
      return { isPayment: true, debtDelta: -amount, amount, deferredAmount: 0, isCreditSale: false };
    }
    let deferred = 0;
    if (tx.amountDeferred !== undefined) {
      deferred = tx.amountDeferred;
    } else if ((tx as any).paymentMethod === 'آجل' || (tx as any).status === 'آجل') {
      deferred = tx.grandTotal || 0;
    }
    return {
      isPayment: false,
      debtDelta: deferred,
      amount: tx.grandTotal || 0,
      deferredAmount: deferred,
      isCreditSale: deferred > 0,
    };
  };

  // Build a complete map of transaction ID -> running balance after transaction (Sorted Chronologically)
  const { statementEntries, runningBalanceMap } = useMemo(() => {
    if (!customerTx || customerTx.length === 0) {
      return { statementEntries: [], runningBalanceMap: new Map<string, number>() };
    }

    // Sort chronologically ascending (oldest first)
    const sorted = [...customerTx].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let runningBal = 0;
    const map = new Map<string, number>();

    const entries = sorted.map((tx) => {
      const effect = getDebtEffect(tx);
      if (effect.isPayment) {
        runningBal = Math.max(0, runningBal - effect.amount);
      } else {
        runningBal = Math.max(0, runningBal + (effect.deferredAmount || 0));
      }
      map.set(tx.id, runningBal);

      let defaultDesc = effect.isPayment ? 'سداد دفعة / قسط مديونية' : 'فاتورة مبيعات';
      if (!effect.isPayment && effect.deferredAmount > 0) {
        if (effect.deferredAmount < effect.amount) {
          defaultDesc = `فاتورة مبيعات (آجل جزئي: ${effect.deferredAmount.toLocaleString()} ج.م)`;
        } else {
          defaultDesc = 'فاتورة مبيعات (آجل بالكامل)';
        }
      }

      return {
        tx,
        id: tx.id,
        receiptNumber: tx.receiptNumber,
        timestamp: tx.timestamp,
        isPayment: effect.isPayment,
        amount: effect.amount,
        deferredAmount: effect.deferredAmount,
        debtDelta: effect.debtDelta,
        balanceAfter: runningBal,
        description: tx.notes || defaultDesc,
        paymentMethod: tx.paymentMethod || 'كاش',
        associateName: tx.primaryAssociateName || 'الكاشير'
      };
    });

    return { statementEntries: entries, runningBalanceMap: map };
  }, [customerTx]);
  
  // Filter invoices (excluding pure debt payments)
  const invoices = useMemo(() => {
    return customerTx.filter(t => {
      const isPayment = t.items.some(item => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || t.id.startsWith('pay_'));
      return !isPayment;
    });
  }, [customerTx]);

  // Filter payments
  const payments = useMemo(() => {
    return customerTx.filter(t => {
      return t.items.some(item => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || t.id.startsWith('pay_'));
    });
  }, [customerTx]);

  // Filtered statement entries (Chronological reverse for view - newest first)
  const filteredStatementEntries = useMemo(() => {
    const q = statementSearch.trim();
    // Start with newest entries on top for display
    const reversed = [...statementEntries].reverse();
    if (!q) return reversed;
    return reversed.filter(entry => {
      const matchReceipt = matchesArabicQuery(entry.receiptNumber, q);
      const matchDesc = matchesArabicQuery(entry.description, q);
      const matchDate = matchesArabicQuery(entry.timestamp, q);
      const matchAssociate = matchesArabicQuery(entry.associateName, q);
      const matchAmount = matchesArabicQuery(String(entry.amount || ''), q) || matchesArabicQuery(String(entry.deferredAmount || ''), q);
      return matchReceipt || matchDesc || matchDate || matchAssociate || matchAmount;
    });
  }, [statementEntries, statementSearch]);

  // Paginated statement
  const totalStatementPages = Math.max(1, Math.ceil(filteredStatementEntries.length / statementPageSize));
  const paginatedStatement = useMemo(() => {
    const start = (statementPage - 1) * statementPageSize;
    return filteredStatementEntries.slice(start, start + statementPageSize);
  }, [filteredStatementEntries, statementPage]);

  // Filtered invoices by search query
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim();
    if (!q) return invoices;
    return invoices.filter(tx => {
      const matchReceipt = matchesArabicQuery(tx.receiptNumber, q);
      const matchAssociate = matchesArabicQuery(tx.primaryAssociateName, q);
      const matchStatus = matchesArabicQuery(tx.status, q);
      const matchItem = tx.items.some(item => matchesArabicQuery(item.productName || (item as any).product?.name, q));
      const matchDate = matchesArabicQuery(tx.timestamp, q);
      const matchNotes = matchesArabicQuery(tx.notes, q);
      const matchAmount = matchesArabicQuery(String(tx.grandTotal || tx.subtotal || ''), q);
      return matchReceipt || matchAssociate || matchStatus || matchItem || matchDate || matchNotes || matchAmount;
    });
  }, [invoices, invoiceSearch]);

  // Paginated invoices
  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / invoicePageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * invoicePageSize;
    return filteredInvoices.slice(start, start + invoicePageSize);
  }, [filteredInvoices, invoicePage]);

  // Filtered payments by search query
  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim();
    if (!q) return payments;
    return payments.filter(p => {
      const matchReceipt = matchesArabicQuery(p.receiptNumber, q);
      const matchAssociate = matchesArabicQuery(p.primaryAssociateName, q);
      const matchNotes = matchesArabicQuery(p.notes, q);
      const matchMethod = matchesArabicQuery(p.paymentMethod, q);
      const matchAmount = matchesArabicQuery(String(p.amountPaid || p.grandTotal || ''), q);
      return matchReceipt || matchAssociate || matchNotes || matchMethod || matchAmount;
    });
  }, [payments, paymentSearch]);

  // Paginated payments
  const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * paymentPageSize;
    return filteredPayments.slice(start, start + paymentPageSize);
  }, [filteredPayments, paymentPage]);

  if (!isOpen) return null;

  const handleSaveBasicInfo = () => {
    if (!customerName.trim()) return;
    updateCustomer({
      ...customer,
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail.trim(),
    });
    setBasicInfoSuccess('تم حفظ اسم العميل ورقم الهاتف بنجاح!');
    setIsEditingBasicInfo(false);
    setTimeout(() => setBasicInfoSuccess(''), 3000);
  };

  const currentDebt = customer.currentDebt || 0;
  const creditLimit = customer.creditLimit || 0;
  const remainingLimit = customer.isCreditEligible ? Math.max(0, creditLimit - currentDebt) : 0;
  const monthlyInstallment = customer.monthlyInstallmentAmount || 0;

  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const remainingDebtAfterPayment = Math.max(0, currentDebt - parsedPaymentAmount);

  const handlePayInstallments = (count: number) => {
    if (monthlyInstallment > 0) {
      const calculated = Math.min(currentDebt, monthlyInstallment * count);
      setPaymentAmount(String(calculated > 0 ? calculated : monthlyInstallment * count));
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('برجاء إدخال مبلغ صحيح أكبر من صفر.');
      return;
    }

    if (amt > currentDebt && currentDebt > 0) {
      if (!confirm(`المبلغ المدخل (${amt.toLocaleString()} ج.م) أكبر من قيمة المديونية الحالية (${currentDebt.toLocaleString()} ج.م). هل تريد الاستمرار؟`)) {
        return;
      }
    }

    try {
      const newTx = await payCustomerDebt(
        customer.id,
        amt,
        paymentMethod,
        paymentNotes || (monthlyInstallment > 0 && amt === monthlyInstallment ? 'سداد قسط شهري' : 'سداد دفعة من المديونية')
      );
      setCompletedTx(newTx);
      setPaymentSuccess(`تم تسجيل دفعة السداد بقيمة ${amt.toLocaleString()} ج.م بنجاح وتخفيض مديونية العميل!`);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError('حدث خطأ أثناء تسجيل عملية السداد.');
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col text-stone-100">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center space-x-3 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            
            {!isEditingBasicInfo ? (
              <div className="flex-1">
                <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
                  <h2 className="text-lg font-extrabold text-stone-100">كشف حساب العميل: {customer.name}</h2>
                  <button
                    onClick={() => setIsEditingBasicInfo(true)}
                    className="text-[11px] px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-bold transition-all flex items-center space-x-1 space-x-reverse"
                    title="تعديل اسم العميل ورقم الهاتف"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل الاسم / الهاتف</span>
                  </button>
                </div>
                <div className="flex items-center space-x-4 space-x-reverse text-xs text-stone-400 mt-1">
                  <span className="flex items-center space-x-1 space-x-reverse font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-500" />
                    <span>{customer.phone}</span>
                  </span>
                  {customer.email && (
                    <span className="flex items-center space-x-1 space-x-reverse">
                      <Mail className="w-3.5 h-3.5 text-stone-500" />
                      <span>{customer.email}</span>
                    </span>
                  )}
                  {customer.address && (
                    <span className="flex items-center space-x-1 space-x-reverse truncate max-w-xs">
                      <MapPin className="w-3.5 h-3.5 text-stone-500" />
                      <span>{customer.address}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-stone-950 p-3 rounded-2xl border border-amber-500/40 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-1">اسم العميل</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 text-xs focus:border-amber-500 focus:outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 text-xs font-mono focus:border-amber-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                  <button
                    onClick={() => {
                      setCustomerName(customer.name || '');
                      setCustomerPhone(customer.phone || '');
                      setIsEditingBasicInfo(false);
                    }}
                    className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveBasicInfo}
                    className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 space-x-reverse"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 space-x-reverse shrink-0">
            <button
              type="button"
              onClick={() => setShowStatementModal(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 space-x-reverse shadow-lg"
              title="طباعة كشف حساب حراري للعميل لآخر 3 أشهر"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة كشف حساب (3 أشهر)</span>
              <span className="sm:hidden">كشف حساب</span>
            </button>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-stone-950/60 border-b border-stone-800 px-6 py-2 shrink-0 flex space-x-2 space-x-reverse overflow-x-auto">
          <button
            onClick={() => { setActiveTab('overview'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'overview'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-extrabold shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>ملخص الحساب والمديونية</span>
          </button>

          <button
            onClick={() => { setActiveTab('statement'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'statement'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-extrabold shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>كشف حركة الحساب والمديونية ({statementEntries.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('invoices'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'invoices'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-extrabold shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>فواتير المبيعات ({invoices.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('payments'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'payments'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-extrabold shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل السدادات والأقساط ({payments.length})</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Financial Summary */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Credit Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">المديونية الحالية</span>
                    <span className={`font-mono text-base font-black block ${currentDebt > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                      {currentDebt.toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-amber-400 block mb-1 font-bold">القسط الشهري المفترض</span>
                    <span className="font-mono text-base font-extrabold text-amber-300 block">
                      {(customer.monthlyInstallmentAmount || 0) > 0 ? `${(customer.monthlyInstallmentAmount || 0).toLocaleString()} ج.م` : 'غير محدد'}
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">الحد الائتماني</span>
                    <span className="font-mono text-base font-extrabold text-stone-300 block">
                      {customer.isCreditEligible ? `${creditLimit.toLocaleString()} ج.م` : 'غير مفعل'}
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">الحد المتبقي</span>
                    <span className="font-mono text-base font-extrabold text-emerald-400 block">
                      {customer.isCreditEligible ? `${remainingLimit.toLocaleString()} ج.م` : '0 ج.م'}
                    </span>
                  </div>
                </div>

                {/* Loyalty & Purchases */}
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-stone-400 block mb-1 font-medium">نقاط الولاء النشطة</span>
                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-mono font-extrabold text-amber-400 text-sm">{customer.loyaltyPoints} نقطة</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 block mb-1 font-medium">إجمالي حجم المبيعات (المدفوع والآجل)</span>
                    <span className="font-mono font-extrabold text-stone-100 text-sm">{(customer.totalSpent || 0).toLocaleString()} ج.م</span>
                  </div>
                </div>

                {/* Account Details Checklist */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-stone-400 mb-2 border-b border-stone-900 pb-2">تفاصيل العضوية والآجل</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">حالة أهلية الآجل:</span>
                      <span className={customer.isCreditEligible ? "text-emerald-400 font-bold" : "text-rose-400"}>
                        {customer.isCreditEligible ? "مؤهل للآجل والجملة" : "غير مؤهل"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">فئة الأسعار الافتراضية:</span>
                      <span className="text-stone-300 font-bold">
                        {customer.isCreditEligible ? "سعر الجملة آجل" : "نقدي عادي"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">مجموع الفواتير المسجلة:</span>
                      <span className="text-stone-300 font-mono font-bold">{invoices.length} فواتير</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">دفعات السداد المكتملة:</span>
                      <span className="text-emerald-400 font-mono font-bold">{payments.length} عمليات</span>
                    </div>
                  </div>
                </div>

                {/* Customer Address / عنوان العميل */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>عنوان / سكن العميل</span>
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="اكتب عنوان العميل هنا بالتفصيل..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none text-xs"
                    />
                    <div className="flex justify-between items-center">
                      {addressSavedMessage ? (
                        <span className="text-[10px] text-emerald-400 font-bold animate-pulse">{addressSavedMessage}</span>
                      ) : (
                        <span className="text-[10px] text-stone-500">سيتم حفظ العنوان في قاعدة بيانات العميل</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateCustomer({
                            ...customer,
                            address: customerAddress
                          });
                          setAddressSavedMessage('تم حفظ العنوان بنجاح!');
                          setTimeout(() => setAddressSavedMessage(''), 3000);
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] rounded-xl transition-all"
                      >
                        حفظ العنوان
                      </button>
                    </div>
                  </div>
                </div>

                {/* Customer Notes / ملاحظات العميل */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                      <FileText className="w-3.5 h-3.5" />
                      <span>ملاحظات ومذكرة خاصة بالعميل</span>
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <textarea
                      placeholder="اكتب أي ملاحظات خاصة بهذا العميل هنا (مثلاً: مواعيد سداد الأقساط، شروط خاصة بالدفع)..."
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none text-xs"
                    />
                    <div className="flex justify-between items-center">
                      {notesSavedMessage ? (
                        <span className="text-[10px] text-emerald-400 font-bold animate-pulse">{notesSavedMessage}</span>
                      ) : (
                        <span className="text-[10px] text-stone-500">سيتم حفظ هذه الملاحظات بشكل دائم في حساب العميل</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateCustomer({
                            ...customer,
                            notes: customerNotes
                          });
                          setNotesSavedMessage('تم حفظ الملاحظات بنجاح!');
                          setTimeout(() => setNotesSavedMessage(''), 3000);
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] rounded-xl transition-all"
                      >
                        حفظ الملاحظات
                      </button>
                    </div>
                  </div>
                </div>

                {/* Credit Eligibility / Qualification Form */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-stone-200">إدارة تأهيل الشراء الآجل والأقساط</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isCreditEligible ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                    }`}>
                      {isCreditEligible ? 'مؤهل للشراء الآجل والجملة' : 'غير مؤهل حالياً'}
                    </span>
                  </div>

                  {creditSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-2.5 flex items-start space-x-1.5 space-x-reverse">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{creditSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-stone-400 block font-medium">تغيير حالة أهلية الآجل</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !isCreditEligible;
                          setIsCreditEligible(nextVal);
                          if (!nextVal) {
                            setCreditLimitInput('0');
                          } else if (parseFloat(creditLimitInput) === 0) {
                            setCreditLimitInput('10000');
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold border transition-all flex items-center justify-center space-x-2 space-x-reverse ${
                          isCreditEligible 
                            ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-stone-900 hover:bg-stone-850 text-stone-300 border-stone-800'
                        }`}
                      >
                        <CheckCircle className={`w-4 h-4 ${isCreditEligible ? 'text-emerald-400' : 'text-stone-500'}`} />
                        <span>{isCreditEligible ? 'مؤهل (اضغط لإلغاء التأهيل)' : 'غير مؤهل (اضغط للتأهيل)'}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 block font-medium">سقف المديونية / حد الائتمان (ج.م)</label>
                      <input
                        type="number"
                        disabled={!isCreditEligible}
                        value={creditLimitInput}
                        onChange={(e) => setCreditLimitInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-700 font-mono text-left focus:border-amber-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-amber-400 block font-bold">المبلغ المفترض تسديده شهرياً / القسط الشهري (ج.م)</label>
                      <input
                        type="number"
                        step="any"
                        value={monthlyInstallmentInput}
                        onChange={(e) => setMonthlyInstallmentInput(e.target.value)}
                        placeholder="أدخل قيمة القسط المفترض تسديده شهرياً..."
                        className="w-full bg-stone-900 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-stone-500">يساعد في سرعة تحصيل الأقساط وتوليد خيارات الدفع بنقرة واحدة</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-stone-900">
                    <button
                      type="button"
                      onClick={() => {
                        const limit = parseFloat(creditLimitInput) || 0;
                        const instAmt = parseFloat(monthlyInstallmentInput) || 0;
                        updateCustomer({
                          ...customer,
                          isCreditEligible,
                          creditLimit: isCreditEligible ? limit : 0,
                          monthlyInstallmentAmount: instAmt,
                        });
                        setCreditSuccess('تم تحديث بيانات التأهيل والقسط الشهري بنجاح!');
                        setTimeout(() => setCreditSuccess(''), 3000);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-bold rounded-xl transition-all text-xs"
                    >
                      حفظ تعديلات التأهيل والقسط
                    </button>
                  </div>
                </div>

              </div>

              {/* Unified Installment & Debt Payment Section in Sidebar */}
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 space-x-reverse mb-4 border-b border-stone-900 pb-3">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-100">سداد الأقساط والمديونيات</h3>
                      <p className="text-[10px] text-stone-400">تحصيل فوري وتخفيض مباشر للرصيد</p>
                    </div>
                  </div>

                  {paymentSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-3 mb-4 space-y-2">
                      <div className="flex items-start space-x-2 space-x-reverse">
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                        <span>{paymentSuccess}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 space-x-reverse pt-1">
                        {completedTx && (
                          <button
                            type="button"
                            onClick={() => setCompletedTx(completedTx)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>إيصال السداد</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowStatementModal(true)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>كشف حساب</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {paymentError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl p-3 mb-4 flex items-start space-x-2 space-x-reverse">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {currentDebt === 0 ? (
                    <div className="text-center py-8 text-stone-500 space-y-2 bg-stone-900/30 rounded-2xl border border-stone-850 p-4">
                      <CheckCircle className="w-9 h-9 text-emerald-500 mx-auto opacity-50" />
                      <p className="text-xs font-bold text-stone-300">الحساب مسدد بالكامل</p>
                      <p className="text-[11px] text-stone-500">لا توجد مديونيات أو أقساط مستحقة على هذا العميل حالياً.</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePayDebt} className="space-y-4 text-xs">
                      
                      {/* Installment Quick Pill Buttons */}
                      {monthlyInstallment > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-amber-300 font-bold">القسط الشهري:</span>
                            <span className="font-mono font-black text-amber-200">{monthlyInstallment.toLocaleString()} ج.م</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handlePayInstallments(1)}
                              className="py-1 px-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              سداد شهر
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePayInstallments(2)}
                              className="py-1 px-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              سداد شهرين
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-amber-400 font-bold">مبلغ السداد المستلم (ج.م)</label>
                          <button
                            type="button"
                            onClick={() => setPaymentAmount(currentDebt.toString())}
                            className="text-[10px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold transition-all"
                          >
                            سداد الكل ({currentDebt.toLocaleString()} ج.م)
                          </button>
                        </div>
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-300 font-mono text-base font-black focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Remaining Balance Preview */}
                      {parsedPaymentAmount > 0 && (
                        <div className="bg-stone-900 border border-stone-850 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-stone-400">المديونية بعد السداد:</span>
                          <span className={`font-mono font-black ${remainingDebtAfterPayment === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {remainingDebtAfterPayment.toLocaleString()} ج.م
                          </span>
                        </div>
                      )}

                      <div>
                        <label className="block text-stone-400 mb-1 font-medium">طريقة السداد</label>
                        <select
                          value={paymentMethod}
                          onChange={(e: any) => setPaymentMethod(e.target.value)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none cursor-pointer font-bold"
                        >
                          <option value="كاش">كاش (نقدي)</option>
                          <option value="فيزا / كارت">فيزا / كارت</option>
                          <option value="محفظة إلكترونية">محفظة إلكترونية (فودافون كاش / إنستاباي)</option>
                          <option value="تحويل بنكي">تحويل بنكي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-stone-400 mb-1 font-medium">ملاحظات حول دفعة السداد (اختياري)</label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="ملاحظات حول القسط أو رقم التحويل..."
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-700 focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 space-x-reverse"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>تسجيل وحفظ السداد</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* STATEMENT / CHRONOLOGICAL ACCOUNT LEDGER TAB */}
          {activeTab === 'statement' && (
            <div className="space-y-4">
              
              {/* Header Info & Statement Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950/60 p-3.5 rounded-2xl border border-stone-800">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-stone-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث في كشف الحساب (رقم الفاتورة/الإيصال، البيان، التاريخ، الكاشير)..."
                    value={statementSearch}
                    onChange={(e) => {
                      setStatementSearch(e.target.value);
                      setStatementPage(1);
                    }}
                    className="w-full bg-stone-900 border border-stone-800 text-xs text-stone-100 rounded-xl pr-9 pl-8 py-2 focus:outline-none focus:border-amber-500"
                  />
                  {statementSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatementSearch('');
                        setStatementPage(1);
                      }}
                      className="absolute left-2.5 top-2 text-stone-400 hover:text-stone-200 text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-3 space-x-reverse text-xs">
                  <div className="bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-800">
                    <span className="text-stone-400">إجمالي المديونية الحالية: </span>
                    <strong className={`font-mono font-black ${currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {currentDebt.toLocaleString()} ج.م
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStatementModal(true)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center space-x-1 space-x-reverse transition-all shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة حرارية</span>
                  </button>
                </div>
              </div>

              {filteredStatementEntries.length === 0 ? (
                <div className="text-center py-12 text-stone-500 space-y-3 bg-stone-950/40 border border-stone-800/60 rounded-3xl">
                  <Receipt className="w-12 h-12 text-stone-600 mx-auto" />
                  <p className="text-xs">
                    {statementSearch ? 'لم يتم العثور على حركات مطابقة لبحثك.' : 'لا توجد حركات مبيعات أو سدادات مسجلة لهذا العميل حتى الآن.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedStatement.map((entry, idx) => {
                    return (
                      <div
                        key={entry.id || `st_${idx}`}
                        className={`bg-stone-950 border rounded-2xl p-4 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          entry.isPayment 
                            ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                            : entry.deferredAmount > 0 
                              ? 'border-rose-500/30 hover:border-rose-500/50' 
                              : 'border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        {/* Left Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1">
                            <span className="font-mono font-extrabold text-amber-400 text-sm">{entry.receiptNumber}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              entry.isPayment 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                : entry.deferredAmount > 0 
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                                  : 'bg-stone-800 text-stone-300 border border-stone-700'
                            }`}>
                              {entry.isPayment ? '💵 سداد دفعة / قسط' : entry.deferredAmount > 0 ? '💳 فاتورة مبيعات (آجل)' : '🛍️ فاتورة نقدية'}
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              طريقة الدفع: {entry.paymentMethod}
                            </span>
                          </div>

                          <div className="text-stone-300 font-medium text-xs">
                            {entry.description}
                          </div>

                          <div className="flex items-center space-x-3 space-x-reverse text-stone-400 text-[11px]">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-stone-600" />
                              <span>{new Date(entry.timestamp).toLocaleString('ar-EG')}</span>
                            </span>
                            <span>•</span>
                            <span>المسؤول: {entry.associateName}</span>
                          </div>
                        </div>

                        {/* Transaction Amounts & Running Balance */}
                        <div className="flex items-center space-x-6 space-x-reverse bg-stone-900/60 p-3 rounded-xl border border-stone-850 shrink-0">
                          
                          <div className="text-right">
                            <span className="text-[10px] text-stone-500 block font-bold">قيمة المعاملة</span>
                            <span className={`font-mono text-sm font-extrabold ${entry.isPayment ? 'text-emerald-400' : 'text-stone-200'}`}>
                              {entry.isPayment ? '-' : '+'}{entry.amount.toLocaleString()} ج.م
                            </span>
                            {entry.deferredAmount > 0 && entry.deferredAmount < entry.amount && (
                              <span className="text-[10px] text-rose-400 block font-mono">
                                (آجل: {entry.deferredAmount.toLocaleString()})
                              </span>
                            )}
                          </div>

                          {/* Highlighted Running Balance After Transaction */}
                          <div className="text-left border-r border-stone-800 pr-4">
                            <span className="text-[10px] text-amber-400 block font-extrabold">المديونية المتبقية بعد المعاملة</span>
                            <span className={`font-mono text-sm font-black ${entry.balanceAfter > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {entry.balanceAfter.toLocaleString()} ج.م
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5 space-x-reverse">
                            {!entry.isPayment && (
                              <button
                                type="button"
                                onClick={() => setSelectedTxForDetail(entry.tx)}
                                className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all"
                                title="عرض تفاصيل الفاتورة"
                              >
                                👁️
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCompletedTx(entry.tx)}
                              className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-lg text-xs font-bold transition-all"
                              title="طباعة إيصال"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Statement Pagination */}
              {totalStatementPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs text-stone-400">
                  <span>
                    صفحة <strong className="text-amber-400">{statementPage}</strong> من <strong className="text-stone-200">{totalStatementPages}</strong>
                  </span>
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <button
                      type="button"
                      onClick={() => setStatementPage(p => Math.max(1, p - 1))}
                      disabled={statementPage <= 1}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatementPage(p => Math.min(totalStatementPages, p + 1))}
                      disabled={statementPage >= totalStatementPages}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <span>التالية</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {/* Invoices Search and Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950/60 p-3 rounded-2xl border border-stone-800">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-stone-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث في فواتير العميل (رقم الفاتورة، اسم المنتج، البائع، التاريخ)..."
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value);
                      setInvoicePage(1);
                    }}
                    className="w-full bg-stone-900 border border-stone-800 text-xs text-stone-100 rounded-xl pr-9 pl-8 py-2 focus:outline-none focus:border-amber-500"
                  />
                  {invoiceSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceSearch('');
                        setInvoicePage(1);
                      }}
                      className="absolute left-2.5 top-2 text-stone-400 hover:text-stone-200 text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-stone-400 font-bold shrink-0 flex items-center gap-2">
                  <span>إجمالي الفواتير: <strong className="text-amber-400 font-mono">{filteredInvoices.length}</strong></span>
                </div>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-stone-500 space-y-3 bg-stone-950/40 border border-stone-800/60 rounded-3xl">
                  <FileText className="w-12 h-12 text-stone-600 mx-auto" />
                  <p className="text-xs">
                    {invoiceSearch ? 'لم يتم العثور على فواتير مطابقة لبحثك.' : 'لم يتم العثور على فواتير مبيعات سابقة لهذا العميل.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedInvoices.map((tx, idx) => {
                    const totalItemsCount = tx.items.reduce((sum, item) => sum + item.quantity, 0);
                    const debtAfterTx = runningBalanceMap.get(tx.id);
                    return (
                      <div 
                        key={tx.id && tx.id !== 'null' ? tx.id : `inv_${idx}`}
                        className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 hover:border-stone-700 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1">
                            <span className="font-mono font-bold text-amber-400 text-sm">{tx.receiptNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === 'ملغاة' 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {tx.status}
                            </span>
                            {debtAfterTx !== undefined && (
                              <span className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-lg font-mono font-black">
                                رصيد المديونية بعد الفاتورة: {debtAfterTx.toLocaleString()} ج.م
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 space-x-reverse text-stone-400 text-[11px]">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-stone-600" />
                              <span>{new Date(tx.timestamp).toLocaleString('ar-EG')}</span>
                            </span>
                            <span>•</span>
                            <span>البائع: {tx.primaryAssociateName}</span>
                          </div>
                          {tx.notes && (
                            <p className="text-[11px] text-stone-400 italic">
                              {tx.notes}
                            </p>
                          )}
                        </div>

                        {/* Items Preview */}
                        <div className="bg-stone-900/60 rounded-xl p-2.5 max-w-xs w-full text-[11px] text-stone-400 border border-stone-800/50">
                          <span className="font-bold text-stone-300 block mb-1">المنتجات ({totalItemsCount}):</span>
                          <p className="truncate">
                            {tx.items.map(item => `${item.productName || (item as any).product?.name || 'منتج'} (x${item.quantity})`).join('، ')}
                          </p>
                        </div>

                        {/* Totals & Debt info */}
                        <div className="text-left font-mono shrink-0 flex flex-col justify-between items-end gap-2">
                          <div>
                            <div className="text-stone-300 font-extrabold text-sm mb-1">
                              {tx.grandTotal.toLocaleString()} ج.م
                            </div>
                            
                            {tx.amountDeferred !== undefined && tx.amountDeferred > 0 && (
                              <div className="text-[10px] text-rose-400 font-bold bg-rose-500/5 border border-rose-500/10 px-1.5 py-0.5 rounded">
                                مرحل آجل: {tx.amountDeferred.toLocaleString()} ج.م
                              </div>
                            )}
                            {tx.amountPaid !== undefined && tx.amountPaid > 0 && (
                              <div className="text-[10px] text-emerald-400 mt-0.5">
                                مدفوع كاشير: {tx.amountPaid.toLocaleString()} ج.م
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <button
                              type="button"
                              onClick={() => setSelectedTxForDetail(tx)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-[11px] font-extrabold transition-all"
                            >
                              فتح / تفاصيل 👁️
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompletedTx(tx)}
                              className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>طباعة</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invoices Pagination */}
              {totalInvoicePages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs text-stone-400">
                  <span>
                    صفحة <strong className="text-amber-400">{invoicePage}</strong> من <strong className="text-stone-200">{totalInvoicePages}</strong>
                  </span>
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <button
                      type="button"
                      onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                      disabled={invoicePage <= 1}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoicePage(p => Math.min(totalInvoicePages, p + 1))}
                      disabled={invoicePage >= totalInvoicePages}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <span>التالية</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS LOG TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {/* Payment search bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950/60 p-3 rounded-2xl border border-stone-800">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-stone-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث في سجل السدادات والأقساط (رقم الإيصال، الكاشير، الملاحظات)..."
                    value={paymentSearch}
                    onChange={(e) => {
                      setPaymentSearch(e.target.value);
                      setPaymentPage(1);
                    }}
                    className="w-full bg-stone-900 border border-stone-800 text-xs text-stone-100 rounded-xl pr-9 pl-8 py-2 focus:outline-none focus:border-amber-500"
                  />
                  {paymentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentSearch('');
                        setPaymentPage(1);
                      }}
                      className="absolute left-2.5 top-2 text-stone-400 hover:text-stone-200 text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-stone-400 font-bold shrink-0">
                  <span>إجمالي السدادات: <strong className="text-emerald-400 font-mono">{filteredPayments.length}</strong></span>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-stone-500 space-y-3 bg-stone-950/40 border border-stone-800/60 rounded-3xl">
                  <History className="w-12 h-12 text-stone-600 mx-auto" />
                  <p className="text-xs">
                    {paymentSearch ? 'لم يتم العثور على سجلات سداد مطابقة لبحثك.' : 'لا يوجد سجلات سداد أو دفعات مديونية مسجلة سابقاً.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedPayments.map((p, idx) => {
                    const debtAfterPmt = runningBalanceMap.get(p.id);
                    return (
                      <div 
                        key={p.id && p.id !== 'null' ? p.id : `pmt_${idx}`}
                        className="bg-stone-950 border border-emerald-500/20 rounded-2xl p-4 hover:border-emerald-500/40 transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1">
                            <span className="font-mono font-bold text-emerald-400">{p.receiptNumber}</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-500/20 font-bold">
                              عملية سداد دفعة / قسط
                            </span>
                            {debtAfterPmt !== undefined && (
                              <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-lg font-mono font-black">
                                رصيد المديونية بعد السداد: {debtAfterPmt.toLocaleString()} ج.م
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 space-x-reverse text-stone-400 text-[11px]">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-stone-600" />
                              <span>{new Date(p.timestamp).toLocaleString('ar-EG')}</span>
                            </span>
                            <span>•</span>
                            <span>الكاشير: {p.primaryAssociateName}</span>
                          </div>
                          {p.notes && (
                            <p className="text-stone-300 text-[11px] bg-stone-900/40 p-1.5 rounded-lg border border-stone-800/40 inline-block mt-1">
                              ملاحظة: {p.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-left font-mono flex flex-col items-end gap-1.5 shrink-0">
                          <div className="text-emerald-400 font-black text-base">
                            - {Math.abs(p.grandTotal).toLocaleString()} ج.م
                          </div>
                          <span className="text-[10px] text-stone-500">طريقة السداد: {p.paymentMethod}</span>
                          <button
                            type="button"
                            onClick={() => setCompletedTx(p)}
                            className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse mt-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة إيصال السداد</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Payments Pagination */}
              {totalPaymentPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs text-stone-400">
                  <span>
                    صفحة <strong className="text-emerald-400">{paymentPage}</strong> من <strong className="text-stone-200">{totalPaymentPages}</strong>
                  </span>
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <button
                      type="button"
                      onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                      disabled={paymentPage <= 1}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentPage(p => Math.min(totalPaymentPages, p + 1))}
                      disabled={paymentPage >= totalPaymentPages}
                      className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 rounded-lg border border-stone-800 flex items-center gap-1 font-bold"
                    >
                      <span>التالية</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Receipt Printable Modal */}
      {completedTx && (
        <ReceiptModal
          transaction={completedTx}
          onClose={() => setCompletedTx(null)}
        />
      )}

      {/* Invoice Detail / Edit Modal */}
      {selectedTxForDetail && (
        <InvoiceDetailModal
          transaction={selectedTxForDetail}
          onClose={() => setSelectedTxForDetail(null)}
        />
      )}

      {/* Customer 3-Month Statement Thermal Modal */}
      {showStatementModal && (
        <CustomerStatementReceiptModal
          customer={customer}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </div>
  );
};
