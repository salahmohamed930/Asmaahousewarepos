import React, { useState, useEffect } from 'react';
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
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { ReceiptModal } from '../Register/ReceiptModal';
import { CustomerStatementReceiptModal } from './CustomerStatementReceiptModal';

interface CustomerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
}

export const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({
  isOpen,
  onClose,
  initialCustomerId,
}) => {
  const { customers, payCustomerDebt, associates } = usePOS();

  const [selectedCustId, setSelectedCustId] = useState<string>(initialCustomerId || '');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustId(initialCustomerId);
    } else if (customers.length > 0 && !selectedCustId) {
      // Pick first customer with debt if available
      const indebted = customers.find((c) => (c.currentDebt || 0) > 0);
      if (indebted) setSelectedCustId(indebted.id);
    }
  }, [initialCustomerId, customers, isOpen]);

  // Reset alerts on customer change
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setCompletedTx(null);
  }, [selectedCustId]);

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === selectedCustId);
  const currentDebt = selectedCustomer?.currentDebt || 0;
  const monthlyInstallment = selectedCustomer?.monthlyInstallmentAmount || 0;
  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const remainingDebtAfterPayment = Math.max(0, currentDebt - parsedPaymentAmount);

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  });

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
      setErrorMsg('يرجى اختيار عميل أولاً.');
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
      const newTx = await payCustomerDebt(
        selectedCustomer.id,
        amt,
        paymentMethod,
        paymentNotes || (monthlyInstallment > 0 && amt === monthlyInstallment ? 'سداد قسط شهري' : 'سداد دفعة من المديونية')
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

  return (
    <>
      <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl overflow-y-auto">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-stone-100 space-y-5 my-8">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-11 h-11 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-100 flex items-center gap-2">
                  <span>سداد الأقساط وتحصيل مديونيات العملاء</span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  نافذة موحدة لتحصيل الأقساط الشهرية، تسوية المديونيات، وطباعة إيصالات الدفع وكشوف الحساب
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

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Customer Selection & Search */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-amber-400">اختيار / البحث عن العميل:</label>
              
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="بحث سريع باسم العميل، رقم الهاتف، أو العنوان..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl pr-9 pl-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 text-xs font-bold text-stone-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                required
              >
                <option value="">-- اختر عميل من القائمة --</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.currentDebt && c.currentDebt > 0 ? `مديونية: ${c.currentDebt.toLocaleString()} ج.م` : 'خالي المديونية'}
                    {c.monthlyInstallmentAmount && c.monthlyInstallmentAmount > 0 ? ` | قسط: ${c.monthlyInstallmentAmount.toLocaleString()} ج.م` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Info Card */}
            {selectedCustomer && (
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 bg-stone-900 border border-stone-800 rounded-xl flex items-center justify-center text-amber-400 font-bold">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-stone-100">{selectedCustomer.name}</h4>
                      <p className="text-[10px] text-stone-400 font-mono">📞 {selectedCustomer.phone}</p>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-stone-500 block font-bold">المديونية المستحقة حالياً</span>
                    <span className={`font-mono text-base font-black ${currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {currentDebt.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* Installment Badge if set */}
                {monthlyInstallment > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-amber-300">
                        القسط الشهري المفترض: <strong className="font-mono text-amber-100 font-black">{monthlyInstallment.toLocaleString()} ج.م</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => handlePayInstallments(1)}
                        className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-[10px] font-bold rounded-lg transition-all"
                      >
                        سداد شهر
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
            )}

            {/* Payment Amount & Quick Buttons */}
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
                      className="text-[10px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-bold transition-all"
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
                  <span>كشف الحساب</span>
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
