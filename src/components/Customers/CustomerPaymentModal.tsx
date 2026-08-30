import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer, PaymentMethod, Transaction } from '../../types';
import { X, DollarSign, UserCheck, CheckCircle, AlertCircle, Search, CreditCard, Printer } from 'lucide-react';
import { ReceiptModal } from '../Register/ReceiptModal';

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
  const { customers, payCustomerDebt, currentAssociate } = usePOS();

  const [selectedCustId, setSelectedCustId] = useState<string>(initialCustomerId || '');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustId(initialCustomerId);
    } else if (customers.length > 0 && !selectedCustId) {
      // Pick first customer with debt if available
      const indebted = customers.find((c) => (c.currentDebt || 0) > 0);
      if (indebted) setSelectedCustId(indebted.id);
    }
  }, [initialCustomerId, customers, isOpen]);

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === selectedCustId);
  const currentDebt = selectedCustomer?.currentDebt || 0;

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
      setErrorMsg('يرجى إدخال مبلغ صحيح أكبر من صفر.');
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
        paymentNotes
      );
      setCompletedTx(newTx);
      setSuccessMsg(`تم تسديد مبلغ ${amt.toLocaleString()} ج.م بنجاح لحساب العميل (${selectedCustomer.name})!`);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل دفعة السداد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100 space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-100">تسجيل سداد / تحصيل مديونية عميل</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">خصم المبالغ المسددة مباشرة من مديونية العميل وطباعة إيصال الفاتورة</p>
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
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs rounded-2xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{successMsg}</span>
              </div>
              {completedTx && (
                <button
                  type="button"
                  onClick={() => setCompletedTx(completedTx)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الإيصال</span>
                </button>
              )}
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
                  placeholder="بحث باسم العميل، رقم الهاتف، أو العنوان..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 text-xs font-bold text-stone-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                required
              >
                <option value="">-- اختر عميل من القائمة --</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.currentDebt && c.currentDebt > 0 ? `مديونية: ${c.currentDebt.toLocaleString()} ج.م` : 'خالي المديونية'}
                  </option>
                ))}
              </select>
            </div>

          {/* Customer Info Card */}
          {selectedCustomer && (
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-9 h-9 bg-stone-900 border border-stone-800 rounded-xl flex items-center justify-center text-amber-400 font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-stone-100">{selectedCustomer.name}</h4>
                    <p className="text-[10px] text-stone-400 font-mono">📞 {selectedCustomer.phone}</p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-[10px] text-stone-500 block font-bold">المديونية المستحقة</span>
                  <span className={`font-mono text-sm font-black ${currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {currentDebt.toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {selectedCustomer.monthlyInstallmentAmount && selectedCustomer.monthlyInstallmentAmount > 0 ? (
                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/25 p-2 rounded-xl text-xs">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    📅 القسط الشهري المفترض:
                    <span className="font-mono font-extrabold text-amber-200">{selectedCustomer.monthlyInstallmentAmount.toLocaleString()} ج.م</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(selectedCustomer.monthlyInstallmentAmount))}
                    className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-stone-950 text-[10px] font-black rounded-lg transition-all shadow"
                  >
                    تعبئة مبلغ القسط
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Payment Amount & Quick Fill */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-amber-400">مبلغ التحصيل / السداد (ج.م):</label>
              <div className="flex items-center space-x-1.5 space-x-reverse">
                {selectedCustomer?.monthlyInstallmentAmount && selectedCustomer.monthlyInstallmentAmount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(selectedCustomer.monthlyInstallmentAmount))}
                    className="text-[10px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg font-bold transition-all"
                  >
                    سداد القسط الشهري ({selectedCustomer.monthlyInstallmentAmount.toLocaleString()} ج.م)
                  </button>
                ) : null}

                {currentDebt > 0 && (
                  <button
                    type="button"
                    onClick={() => handlePayFull()}
                    className="text-[10px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg font-bold transition-all"
                  >
                    سداد المديونية بالكامل ({currentDebt.toLocaleString()} ج.م)
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
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-300 font-mono text-base font-extrabold focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-amber-400">طريقة الدفع / التحصيل:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {(['كاش', 'فيزا / كارت', 'محفظة إلكترونية'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
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

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-400">ملاحظات / رقم الإيصال:</label>
            <input
              type="text"
              placeholder="ملاحظات حول طريقة السداد أو التسليم..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex justify-end space-x-2 space-x-reverse pt-2">
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
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center space-x-2 space-x-reverse"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ السداد'}</span>
            </button>
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
          onClose();
        }}
      />
    )}
  </>
);
};
