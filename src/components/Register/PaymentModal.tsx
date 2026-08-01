import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { PaymentMethod, Transaction } from '../../types';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Gift,
  X,
  CheckCircle2,
  DollarSign,
  HeartHandshake,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { cart, currentAssociate, splitAssociates, selectedCustomer, taxRate, globalPriceTier, completeTransaction } =
    usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>('');
  const [isPartialPayment, setIsPartialPayment] = useState<boolean>(false);
  const [partialPaidAmount, setPartialPaidAmount] = useState<string>('');

  if (!isOpen || !currentAssociate) return null;

  // Helper to determine the unit price of a cart item based on current settings
  const getItemUnitPrice = (item: any): number => {
    if (item.overridePrice !== undefined && item.overridePrice > 0) return item.overridePrice;
    const tier = item.selectedPriceTier || globalPriceTier;
    if (tier === 'cash') return item.product.priceCash || 0;
    if (tier === 'installment') return item.product.priceInstallment || 0;
    if (tier === 'wholesale') return item.product.priceWholesale || 0;
    return item.product.priceCash || 0;
  };

  // Calculate Cart Totals
  let subtotal = 0;
  let discountTotal = 0;

  cart.forEach((item) => {
    const unitPrice = getItemUnitPrice(item);
    const lineTotal = unitPrice * item.quantity;
    const lineDisc = (lineTotal * item.discountPercent) / 100;
    subtotal += lineTotal;
    discountTotal += lineDisc;
  });

  const netSubtotal = subtotal - discountTotal;
  const taxTotal = Math.round(netSubtotal * taxRate * 100) / 100;

  const tipAmount =
    tipPercent > 0
      ? Math.round((netSubtotal * tipPercent * 100) / 100)
      : parseFloat(customTip) || 0;

  const grandTotal = Math.round((netSubtotal + taxTotal + tipAmount) * 100) / 100;

  const isCreditEligible = selectedCustomer?.isCreditEligible || false;

  // Calculate final paid and deferred
  let paidAmount = grandTotal;
  let deferredAmount = 0;

  if (selectedCustomer && isCreditEligible) {
    if (paymentMethod === 'آجل / حساب جملة') {
      if (isPartialPayment) {
        paidAmount = Math.min(grandTotal, Math.max(0, parseFloat(partialPaidAmount) || 0));
        deferredAmount = Math.max(0, grandTotal - paidAmount);
      } else {
        paidAmount = 0;
        deferredAmount = grandTotal;
      }
    } else {
      if (isPartialPayment) {
        paidAmount = Math.min(grandTotal, Math.max(0, parseFloat(partialPaidAmount) || 0));
        deferredAmount = Math.max(0, grandTotal - paidAmount);
      } else {
        paidAmount = grandTotal;
        deferredAmount = 0;
      }
    }
  } else {
    if (paymentMethod === 'آجل / حساب جملة') {
      paidAmount = 0;
      deferredAmount = grandTotal;
    } else {
      paidAmount = grandTotal;
      deferredAmount = 0;
    }
  }

  // Cash Calculations
  const tenderNumber = parseFloat(cashTendered) || 0;
  const targetRequiredAmount = (paymentMethod === 'كاش' && isPartialPayment) ? paidAmount : grandTotal;
  const changeDue = Math.max(0, tenderNumber - targetRequiredAmount);

  // Projected Commission calculation
  const primaryAssocRate = currentAssociate.commissionRate;
  const totalSplitPercent = splitAssociates.reduce((acc, s) => acc + s.sharePercentage, 0);
  const primarySharePercent = Math.max(0, 100 - totalSplitPercent);
  const projectedPrimaryCommission =
    Math.round(((netSubtotal * primarySharePercent) / 100) * primaryAssocRate * 100) / 100;

  const handleQuickCash = (amount: number) => {
    setCashTendered(amount.toString());
  };

  const handleProcessPayment = () => {
    if (paymentMethod === 'آجل / حساب جملة' && !selectedCustomer) {
      setPaymentError('يجب اختيار عميل لتسجيل مبيعات الآجل.');
      return;
    }

    if (paymentMethod === 'آجل / حساب جملة' && selectedCustomer && !isCreditEligible) {
      setPaymentError(`العميل (${selectedCustomer.name}) غير مؤهل للمعاملات الآجلة.`);
      return;
    }

    if (isPartialPayment && !selectedCustomer) {
      setPaymentError('يجب اختيار عميل لتفعيل الدفع الجزئي والآجل.');
      return;
    }

    if (isPartialPayment && selectedCustomer && !isCreditEligible) {
      setPaymentError(`العميل (${selectedCustomer.name}) غير مؤهل للمعاملات الآجلة والدفع الجزئي.`);
      return;
    }

    // Cash Validation
    const requiredCash = isPartialPayment ? paidAmount : grandTotal;
    if (paymentMethod === 'كاش' && tenderNumber < requiredCash) {
      setPaymentError(`المبلغ المدفوع (${tenderNumber.toLocaleString()} ج.م) أقل من المبلغ المطلوب (${requiredCash.toLocaleString()} ج.م).`);
      return;
    }

    // Check credit limit
    if (selectedCustomer && isCreditEligible && deferredAmount > 0) {
      const currentDebt = selectedCustomer.currentDebt || 0;
      const creditLimit = selectedCustomer.creditLimit || 0;
      if (currentDebt + deferredAmount > creditLimit) {
        setPaymentError(`المبلغ المطلوب ترحيله للآجل (${deferredAmount.toLocaleString()} ج.م) سيتجاوز الحد الائتماني المتبقي للعميل (${(creditLimit - currentDebt).toLocaleString()} ج.م).`);
        return;
      }
    }

    setPaymentError('');
    setIsProcessing(true);

    setTimeout(() => {
      try {
        let details = '';
        if (paymentMethod === 'فيزا / كارت') {
          details = 'بطاقة دفع فيزا رقم ' + Math.floor(1000 + Math.random() * 9000);
        } else if (paymentMethod === 'كاش') {
          details = `المستلم: ${tenderNumber.toLocaleString()} ج.م | الباقي: ${changeDue.toLocaleString()} ج.م`;
        } else if (paymentMethod === 'محفظة إلكترونية') {
          details = 'دفع إلكتروني عبر الهاتف الذكي NFC';
        } else if (paymentMethod === 'آجل / حساب جملة') {
          details = 'تسجيل آجل على حساب العميل';
        } else if (paymentMethod === 'تقسيط شهري') {
          details = 'تقسيط شهري متفق عليه مع العميل';
        }

        if (deferredAmount > 0) {
          details += ` | (دفع جزئي: تم دفع ${paidAmount.toLocaleString()} ج.م وتأجيل ${deferredAmount.toLocaleString()} ج.م)`;
        }

        const completedTx = completeTransaction(paymentMethod, 0, details, '', paidAmount, deferredAmount);
        setIsProcessing(false);
        onSuccess(completedTx);
      } catch (err: any) {
        setIsProcessing(false);
        setPaymentError(err.message || 'فشلت عملية إتمام الدفع');
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-stone-100 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 space-x-reverse mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">إتمام الدفع وتحصيل الفاتورة</h2>
            <p className="text-xs text-stone-400">
              نقطة بيع #01 • البائع المسؤول: {currentAssociate.name}
            </p>
          </div>
        </div>

        {/* Order Summary Box */}
        <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-400">
              <span>المجموع الفرعي ({cart.reduce((a, c) => a + c.quantity, 0)} أصناف)</span>
              <span className="font-mono text-stone-200">{subtotal.toLocaleString()} ج.م</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>إجمالي الخصومات المطبقة</span>
                <span className="font-mono">-{discountTotal.toLocaleString()} ج.م</span>
              </div>
            )}

            <div className="flex justify-between text-stone-400">
              <span>ضريبة القيمة المضافة ({(taxRate * 100).toFixed(0)}%)</span>
              <span className="font-mono text-stone-200">{taxTotal.toLocaleString()} ج.م</span>
            </div>

            {tipAmount > 0 && (
              <div className="flex justify-between text-indigo-400 font-bold">
                <span>إضافة / مكافأة البائع</span>
                <span className="font-mono">+{tipAmount.toLocaleString()} ج.م</span>
              </div>
            )}

            <div className="border-t border-stone-800 pt-2.5 mt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-white">الإجمالي النهائي المطلوب</span>
              <span className="text-2xl font-mono font-extrabold text-amber-400">
                {grandTotal.toLocaleString()} ج.م
              </span>
            </div>
          </div>

          {/* Associate Commission Badge */}
          <div className="mt-3 bg-stone-900 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 space-x-reverse">
              <img
                src={currentAssociate.avatar}
                alt={currentAssociate.name}
                className="w-6 h-6 rounded-lg object-cover"
              />
              <span className="text-stone-300">
                عمولة البائع: {currentAssociate.name}{' '}
                {splitAssociates.length > 0 ? `(تقسيم ${primarySharePercent}%)` : ''}
              </span>
            </div>
            <div className="text-emerald-400 font-mono font-semibold text-xs flex items-center space-x-1 space-x-reverse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>+{projectedPrimaryCommission.toLocaleString()} ج.م عمولة</span>
            </div>
          </div>
        </div>

        {/* Customer Credit Information */}
        {selectedCustomer && (
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-stone-800 pb-2">
              <span className="font-bold text-stone-300">العميل المرتبط بالفاتورة:</span>
              <span className="text-amber-400 font-bold">{selectedCustomer.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1 text-[11px]">
              <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                <span className="text-stone-500 block mb-0.5">الحد الائتماني</span>
                <span className="font-mono text-stone-200 font-bold">
                  {selectedCustomer.isCreditEligible ? `${(selectedCustomer.creditLimit || 0).toLocaleString()} ج.م` : 'غير مؤهل للآجل'}
                </span>
              </div>
              <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                <span className="text-stone-500 block mb-0.5">المديونية الحالية</span>
                <span className="font-mono text-rose-400 font-bold">
                  {(selectedCustomer.currentDebt || 0).toLocaleString()} ج.م
                </span>
              </div>
              <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                <span className="text-stone-500 block mb-0.5">الحد المتبقي</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {selectedCustomer.isCreditEligible 
                    ? `${Math.max(0, (selectedCustomer.creditLimit || 0) - (selectedCustomer.currentDebt || 0)).toLocaleString()} ج.م` 
                    : '0 ج.م'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tip Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 space-x-reverse">
              <HeartHandshake className="w-4 h-4 text-indigo-400" />
              <span>مكافأة أو حافز للبائع (اختياري)</span>
            </span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[0, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  setTipPercent(pct);
                  setCustomTip('');
                }}
                className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                  tipPercent === pct && !customTip
                    ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                    : 'bg-stone-950 text-stone-300 border-stone-800 hover:bg-stone-800'
                }`}
              >
                {pct === 0 ? 'بدون' : `${pct}%`}
              </button>
            ))}

            <div className="relative">
              <input
                type="number"
                placeholder="قيمة..."
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  setTipPercent(0);
                }}
                className="w-full h-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-center text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
            اختر طريقة الدفع والتحصيل
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'كاش', label: 'كاش / نقدي', icon: Banknote },
              { id: 'فيزا / كارت', label: 'فيزا / كارت', icon: CreditCard },
              { id: 'محفظة إلكترونية', label: 'محفظة ذكية', icon: Smartphone },
              { id: 'آجل / حساب جملة', label: 'حساب آجل', icon: Gift },
            ].map((m) => {
              const Icon = m.icon;
              const isSel = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    isSel
                      ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-lg shadow-amber-950/50'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Partial Payment Toggle and Input */}
        {selectedCustomer && isCreditEligible && (
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  id="partialPayToggle"
                  checked={isPartialPayment || paymentMethod === 'آجل / حساب جملة'}
                  disabled={paymentMethod === 'آجل / حساب جملة'}
                  onChange={(e) => {
                    setIsPartialPayment(e.target.checked);
                    if (e.target.checked) {
                      setPartialPaidAmount('');
                    }
                  }}
                  className="w-4 h-4 rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-950"
                />
                <label htmlFor="partialPayToggle" className="text-xs font-bold text-stone-300 cursor-pointer">
                  {paymentMethod === 'آجل / حساب جملة' 
                    ? 'دفع جزء من الفاتورة الآن وتأجيل المتبقي' 
                    : 'تفعيل الدفع الجزئي وترحيل المتبقي للآجل'}
                </label>
              </div>
              {(isPartialPayment || paymentMethod === 'آجل / حساب جملة') && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  دفع جزئي نشط
                </span>
              )}
            </div>

            {(isPartialPayment || paymentMethod === 'آجل / حساب جملة') && (
              <div className="space-y-3 pt-2 border-t border-stone-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-400 mb-1">المبلغ المدفوع الآن (ج.م)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={partialPaidAmount}
                      onChange={(e) => setPartialPaidAmount(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none text-left font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-400 mb-1">المبلغ المرحل للمديونية</label>
                    <div className="w-full bg-stone-900/50 border border-stone-800 rounded-xl px-3 py-2 text-rose-400 text-left font-mono font-bold">
                      {deferredAmount.toLocaleString()} ج.م
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-stone-400 bg-stone-900 p-2 rounded-xl flex justify-between">
                  <span>المديونية المتوقعة للعميل بعد المعاملة:</span>
                  <span className="font-mono text-rose-400 font-bold">
                    {((selectedCustomer.currentDebt || 0) + deferredAmount).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cash Tender Input UI (Only when Cash selected) */}
        {paymentMethod === 'كاش' && (
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-300">المبلغ المستلم من العميل (ج.م)</label>
              <div className="flex space-x-1.5 space-x-reverse">
                {[
                  Math.ceil(targetRequiredAmount),
                  Math.ceil(targetRequiredAmount / 50) * 50,
                  Math.ceil(targetRequiredAmount / 100) * 100,
                  Math.ceil(targetRequiredAmount / 200) * 200,
                ].map((amt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickCash(amt)}
                    className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono rounded-lg"
                  >
                    {amt.toLocaleString()} ج.م
                  </button>
                ))}
              </div>
            </div>

            <input
              type="number"
              step="1"
              placeholder="0.00"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2.5 font-mono text-xl text-stone-100 focus:outline-none text-left"
            />

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-stone-400">الباقي المستحق للعميل:</span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                {changeDue.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {paymentError && (
          <p className="text-center text-rose-400 text-xs font-medium mb-4">{paymentError}</p>
        )}

        {/* Submit Payment Button */}
        <button
          onClick={handleProcessPayment}
          disabled={isProcessing}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl text-base font-extrabold shadow-xl shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
        >
          {isProcessing ? (
            <span className="flex items-center space-x-2 space-x-reverse">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>جاري تأكيد وتسجيل المعاملة...</span>
            </span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {deferredAmount > 0 
                  ? `تأكيد المعاملة (مدفوع: ${paidAmount.toLocaleString()} ج.م | آجل: ${deferredAmount.toLocaleString()} ج.م)`
                  : `إتمام وطباعة الفاتورة (${grandTotal.toLocaleString()} ج.م)`}
              </span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};

export default PaymentModal;
