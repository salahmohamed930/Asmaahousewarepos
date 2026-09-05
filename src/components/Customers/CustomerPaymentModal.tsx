import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer, PaymentMethod, Transaction } from '../../types';
import { 
  X, 
  DollarSign, 
  UserCheck, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  CreditCard, 
  Printer, 
  Calendar, 
  Receipt, 
  FileText,
  TrendingDown,
  ChevronDown,
  UserPlus,
  RefreshCw,
  Phone,
  MapPin
} from 'lucide-react';
import { ReceiptModal } from '../Register/ReceiptModal';
import { CustomerStatementReceiptModal } from './CustomerStatementReceiptModal';
import { matchesArabicQuery, normalizeArabicText } from '../../utils/textUtils';

interface CustomerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
}

type CustomerFilterTab = 'all' | 'indebted' | 'installments';

export const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({
  isOpen,
  onClose,
  initialCustomerId,
}) => {
  const { customers, payCustomerDebt } = usePOS();

  const [selectedCustId, setSelectedCustId] = useState<string>(initialCustomerId || '');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<CustomerFilterTab>('indebted');

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Auto-initialize selected customer when opening
  useEffect(() => {
    if (isOpen) {
      if (initialCustomerId) {
        setSelectedCustId(initialCustomerId);
        setIsSearchOpen(false);
      } else if (!selectedCustId) {
        const firstIndebted = customers.find((c) => (c.currentDebt || 0) > 0);
        if (firstIndebted) {
          setSelectedCustId(firstIndebted.id);
        } else if (customers.length > 0) {
          setSelectedCustId(customers[0].id);
        }
      }
    }
  }, [initialCustomerId, isOpen]);

  // When customer changes, populate amount if installment or debt is present
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setCompletedTx(null);

    const cust = customers.find((c) => c.id === selectedCustId);
    if (cust) {
      if (cust.monthlyInstallmentAmount && cust.monthlyInstallmentAmount > 0) {
        setPaymentAmount(String(cust.monthlyInstallmentAmount));
      } else if ((cust.currentDebt || 0) > 0) {
        setPaymentAmount(String(cust.currentDebt));
      } else {
        setPaymentAmount('');
      }
    }
  }, [selectedCustId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => String(c.id) === String(selectedCustId));
  }, [customers, selectedCustId]);

  const currentDebt = selectedCustomer?.currentDebt || 0;
  const monthlyInstallment = selectedCustomer?.monthlyInstallmentAmount || 0;
  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const remainingDebtAfterPayment = Math.max(0, currentDebt - parsedPaymentAmount);

  // Filter and search customers with Arabic-aware query
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim();

    return customers.filter((c) => {
      // 1. Tab filter
      if (filterTab === 'indebted' && (c.currentDebt || 0) <= 0) return false;
      if (filterTab === 'installments' && (!c.monthlyInstallmentAmount || c.monthlyInstallmentAmount <= 0)) return false;

      // 2. Search query filter
      if (q) {
        const matchName = matchesArabicQuery(c.name, q);
        const matchPhone = (c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) || (c.phone || '').includes(q);
        const matchAddress = matchesArabicQuery(c.address, q);
        const matchNotes = matchesArabicQuery(c.notes, q);
        const matchId = String(c.id) === q;

        if (!matchName && !matchPhone && !matchAddress && !matchNotes && !matchId) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Prioritize indebted and installment customers
      const debtDiff = (b.currentDebt || 0) - (a.currentDebt || 0);
      if (debtDiff !== 0) return debtDiff;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [customers, customerSearch, filterTab]);

  const countIndebted = useMemo(() => customers.filter((c) => (c.currentDebt || 0) > 0).length, [customers]);
  const countInstallments = useMemo(() => customers.filter((c) => (c.monthlyInstallmentAmount || 0) > 0).length, [customers]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustId(c.id);
    setIsSearchOpen(false);
    setCustomerSearch('');
  };

  const handlePayFull = () => {
    if (currentDebt > 0) {
      setPaymentAmount(String(currentDebt));
    }
  };

  const handlePayInstallments = (count: number) => {
    if (monthlyInstallment > 0) {
      const calculated = Math.min(currentDebt, monthlyInstallment * count);
      setPaymentAmount(String(calculated > 0 ? calculated : monthlyInstallment * count));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedCustomer) {
      setErrorMsg('يرجى اختيار حساب العميل أولاً من البحث.');
      return;
    }

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('يرجى إدخال مبلغ سداد صحيح أكبر من صفر.');
      return;
    }

    if (amt > currentDebt && currentDebt > 0) {
      if (!confirm(`المبلغ المدخل (${amt.toLocaleString()} ج.م) أكبر من المديونية الحالية (${currentDebt.toLocaleString()} ج.م). هل ترغب في المتابعة؟`)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const defaultDesc = monthlyInstallment > 0 && amt === monthlyInstallment
        ? `سداد قسط شهري (${amt.toLocaleString()} ج.م)`
        : `سداد دفعة مديونية / قسط (${amt.toLocaleString()} ج.م)`;

      const newTx = await payCustomerDebt(
        selectedCustomer.id,
        amt,
        paymentMethod,
        paymentNotes.trim() || defaultDesc
      );

      setCompletedTx(newTx);
      setSuccessMsg(`تم بنجاح سداد وتوثيق مبلغ ${amt.toLocaleString()} ج.م لحساب العميل (${selectedCustomer.name})!`);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل عملية سداد القسط/المديونية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 dir-rtl overflow-y-auto">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative text-stone-100 space-y-4 my-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-11 h-11 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-100 flex items-center gap-2">
                  <span>سداد الأقساط وتحصيل مديونيات العملاء</span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  البحث عن حساب العميل، تحصيل الأقساط الشهرية، وسداد المديونيات مع الإيصالات الفورية
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notifications */}
          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-bold">{successMsg}</span>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse pt-1">
                {completedTx && (
                  <button
                    type="button"
                    onClick={() => setCompletedTx(completedTx)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة إيصال السداد</span>
                  </button>
                )}
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowStatementModal(true)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>طباعة كشف حساب (3 أشهر)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs rounded-2xl p-3 flex items-center space-x-2 space-x-reverse">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-bold">{errorMsg}</span>
            </div>
          )}

          {/* Customer Search & Picker Box */}
          <div ref={searchContainerRef} className="space-y-2 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>البحث عن حساب العميل:</span>
              </label>
              
              {/* Filter Tabs */}
              <div className="flex items-center space-x-1 space-x-reverse text-[10px]">
                <button
                  type="button"
                  onClick={() => setFilterTab('indebted')}
                  className={`px-2 py-0.5 rounded-lg font-bold border transition-all ${
                    filterTab === 'indebted'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  المدينون ({countIndebted})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('installments')}
                  className={`px-2 py-0.5 rounded-lg font-bold border transition-all ${
                    filterTab === 'installments'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  أصحاب أقساط ({countInstallments})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-2 py-0.5 rounded-lg font-bold border transition-all ${
                    filterTab === 'all'
                      ? 'bg-stone-800 text-stone-100 border-stone-700 font-black'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  الكل ({customers.length})
                </button>
              </div>
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 absolute right-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="ابحث بالاسم (مثل: أحمد، محمد)، رقم الهاتف، أو العنوان..."
                value={customerSearch}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsSearchOpen(true);
                }}
                className="w-full bg-stone-950 border border-stone-800 rounded-2xl pr-10 pl-8 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 placeholder-stone-500"
              />
              {customerSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearch('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Live Search Dropdown / Floating Results */}
            {isSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-stone-950 border border-stone-800 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-stone-900">
                {filteredCustomers.length === 0 ? (
                  <div className="p-4 text-center text-stone-400 text-xs">
                    لم يتم العثور على أي عميل يطابق &quot;{customerSearch}&quot;
                  </div>
                ) : (
                  filteredCustomers.map((c) => {
                    const isSelected = String(c.id) === String(selectedCustId);
                    const debt = c.currentDebt || 0;
                    const installment = c.monthlyInstallmentAmount || 0;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full text-right p-3 hover:bg-stone-900 transition-colors flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-amber-500/10 border-r-4 border-amber-500' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 space-x-reverse min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-stone-850 border border-stone-800 flex items-center justify-center shrink-0 text-stone-300 font-bold text-xs">
                            <UserCheck className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-stone-100 truncate">{c.name}</div>
                            <div className="text-[10px] text-stone-400 font-mono flex items-center gap-1.5">
                              <span>📞 {c.phone || 'بدون هاتف'}</span>
                              {c.address && <span className="truncate">📍 {c.address}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 flex flex-col items-end space-y-0.5">
                          <span className={`text-[11px] font-mono font-black ${debt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {debt > 0 ? `${debt.toLocaleString()} ج.م` : 'خالي المديونية'}
                          </span>
                          {installment > 0 && (
                            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              قسط: {installment.toLocaleString()} ج.م
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected Customer Hero Profile Card */}
          {selectedCustomer ? (
            <div className="bg-stone-950 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 font-bold shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-stone-100">{selectedCustomer.name}</h4>
                      <button
                        type="button"
                        onClick={() => setIsSearchOpen(true)}
                        className="text-[10px] bg-stone-900 hover:bg-stone-800 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg font-bold transition-all"
                      >
                        تغيير
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                      📞 {selectedCustomer.phone || 'بدون هاتف'} {selectedCustomer.address ? `| 📍 ${selectedCustomer.address}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-[10px] text-stone-500 block font-bold">المديونية الحالية المستحقة</span>
                  <span className={`font-mono text-lg font-black ${currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {currentDebt.toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* Monthly Installment Information & Quick Installment Buttons */}
              {monthlyInstallment > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-bold text-amber-300">
                      قسط العميل الشهري: <strong className="font-mono text-amber-100 font-black">{monthlyInstallment.toLocaleString()} ج.م</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 space-x-reverse">
                    <button
                      type="button"
                      onClick={() => handlePayInstallments(1)}
                      className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-[10px] font-bold rounded-lg transition-all"
                    >
                      سداد قسط شهر
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePayInstallments(2)}
                      className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-[10px] font-bold rounded-lg transition-all"
                    >
                      شهرين ({(monthlyInstallment * 2).toLocaleString()})
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-6 text-center text-stone-400 text-xs">
              يرجى البحث واختيار حساب عميل من القائمة أعلاه لبدء تسجيل السداد
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Payment Amount & Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-bold text-amber-400">مبلغ السداد / التحصيل المستلم (ج.م):</label>
                <div className="flex items-center space-x-1.5 space-x-reverse">
                  {monthlyInstallment > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePayInstallments(1)}
                      className="text-[10px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-lg font-bold transition-all"
                    >
                      سداد القسط ({monthlyInstallment.toLocaleString()} ج.م)
                    </button>
                  )}

                  {currentDebt > 0 && (
                    <button
                      type="button"
                      onClick={handlePayFull}
                      className="text-[10px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-lg font-bold transition-all"
                    >
                      سداد المديونية كاملة ({currentDebt.toLocaleString()} ج.م)
                    </button>
                  )}
                </div>
              </div>

              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-300 font-mono text-lg font-black focus:outline-none focus:border-amber-500"
                required
              />

              {/* Dynamic Running Debt Preview */}
              {selectedCustomer && parsedPaymentAmount > 0 && (
                <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                  <span className="text-stone-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span>رصيد المديونية المتبقي بعد هذا السداد:</span>
                  </span>
                  <span className={`font-mono font-black text-sm ${remainingDebtAfterPayment === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {remainingDebtAfterPayment.toLocaleString()} ج.م
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-amber-400">طريقة الدفع / التحصيل:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(['كاش', 'فيزا / كارت', 'محفظة إلكترونية', 'تحويل بنكي'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      paymentMethod === method
                        ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold shadow'
                        : 'bg-stone-950 text-stone-300 border-stone-800 hover:bg-stone-800'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes / Reference */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-400">ملاحظات أو رقم مرجع السداد (اختياري):</label>
              <input
                type="text"
                placeholder="مثال: سداد قسط شهر سبتمبر، تحويل فودافون كاش، إيداع..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setShowStatementModal(true)}
                  className="px-3 py-2 bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>كشف الحساب (3 أشهر)</span>
                </button>
              )}

              <div className="flex items-center space-x-2 space-x-reverse mr-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedCustId}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-950 transition-all flex items-center space-x-2 space-x-reverse"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ السداد'}</span>
                </button>
              </div>
            </div>

          </form>

        </div>
      </div>

      {/* Receipt Printable Modal */}
      {completedTx && (
        <ReceiptModal
          transaction={completedTx}
          onClose={() => {
            setCompletedTx(null);
          }}
        />
      )}

      {/* Statement Printable Modal */}
      {showStatementModal && selectedCustomer && (
        <CustomerStatementReceiptModal
          customer={selectedCustomer}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </>
  );
};
