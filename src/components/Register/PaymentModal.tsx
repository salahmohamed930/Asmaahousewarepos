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
  const { cart, currentAssociate, splitAssociates, selectedCustomer, taxRate, completeTransaction } =
    usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>('');

  if (!isOpen || !currentAssociate) return null;

  // Calculate Cart Totals
  let subtotal = 0;
  let discountTotal = 0;

  cart.forEach((item) => {
    const lineTotal = item.product.price * item.quantity;
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

  // Cash Calculations
  const tenderNumber = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderNumber - grandTotal);

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
    if (paymentMethod === 'Cash' && tenderNumber < grandTotal) {
      setPaymentError(`Cash tendered ($${tenderNumber.toFixed(2)}) is less than total amount.`);
      return;
    }

    setPaymentError('');
    setIsProcessing(true);

    setTimeout(() => {
      try {
        let details = '';
        if (paymentMethod === 'Credit Card') {
          details = 'Visa Chip ending in ' + Math.floor(1000 + Math.random() * 9000);
        } else if (paymentMethod === 'Cash') {
          details = `Tendered: $${tenderNumber.toFixed(2)} | Change: $${changeDue.toFixed(2)}`;
        } else if (paymentMethod === 'Apple Pay') {
          details = 'Contactless NFC Payment Verified';
        }

        const completedTx = completeTransaction(paymentMethod, tipAmount, details);
        setIsProcessing(false);
        onSuccess(completedTx);
      } catch (err: any) {
        setIsProcessing(false);
        setPaymentError(err.message || 'Payment processing failed');
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-stone-100 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Register Checkout</h2>
            <p className="text-xs text-stone-400">
              Terminal #01 • Operator: {currentAssociate.name}
            </p>
          </div>
        </div>

        {/* Order Summary Box */}
        <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-400">
              <span>Items Subtotal ({cart.reduce((a, c) => a + c.quantity, 0)})</span>
              <span className="font-mono text-stone-200">${subtotal.toFixed(2)}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discounts Applied</span>
                <span className="font-mono">-${discountTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-stone-400">
              <span>Est. Sales Tax ({(taxRate * 100).toFixed(0)}%)</span>
              <span className="font-mono text-stone-200">${taxTotal.toFixed(2)}</span>
            </div>

            {tipAmount > 0 && (
              <div className="flex justify-between text-indigo-400">
                <span>Associate Tip</span>
                <span className="font-mono">+${tipAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-stone-800 pt-2.5 mt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-white">Grand Total</span>
              <span className="text-2xl font-mono font-extrabold text-emerald-400">
                ${grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Associate Commission Badge */}
          <div className="mt-3 bg-stone-900 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <img
                src={currentAssociate.avatar}
                alt={currentAssociate.name}
                className="w-6 h-6 rounded-lg object-cover"
              />
              <span className="text-stone-300">
                {currentAssociate.name}{' '}
                {splitAssociates.length > 0 ? `(${primarySharePercent}% split)` : ''}
              </span>
            </div>
            <div className="text-emerald-400 font-mono font-semibold text-xs flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>+${projectedPrimaryCommission.toFixed(2)} Comm.</span>
            </div>
          </div>
        </div>

        {/* Tip Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <HeartHandshake className="w-4 h-4 text-indigo-400" />
              <span>Associate Tip (Optional)</span>
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
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-stone-950 text-stone-300 border-stone-800 hover:bg-stone-800'
                }`}
              >
                {pct === 0 ? 'No Tip' : `${pct}%`}
              </button>
            ))}

            <div className="relative">
              <input
                type="number"
                placeholder="Custom $"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  setTipPercent(0);
                }}
                className="w-full h-full bg-stone-950 border border-stone-800 focus:border-indigo-500 rounded-xl text-center text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'Credit Card', label: 'Card / Chip', icon: CreditCard },
              { id: 'Cash', label: 'Cash', icon: Banknote },
              { id: 'Apple Pay', label: 'Contactless', icon: Smartphone },
              { id: 'Store Credit', label: 'Store Credit', icon: Gift },
            ].map((m) => {
              const Icon = m.icon;
              const isSel = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    isSel
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50'
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

        {/* Cash Tender Input UI (Only when Cash selected) */}
        {paymentMethod === 'Cash' && (
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-300">Amount Tendered ($)</label>
              <div className="flex space-x-1.5">
                {[
                  Math.ceil(grandTotal),
                  20,
                  50,
                  100,
                ].map((amt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickCash(amt)}
                    className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono rounded-lg"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 font-mono text-xl text-stone-100 focus:outline-none"
            />

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-stone-400">Change Due to Customer:</span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                ${changeDue.toFixed(2)}
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
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl text-base font-extrabold shadow-xl shadow-emerald-950/80 flex items-center justify-center space-x-2 transition-all"
        >
          {isProcessing ? (
            <span className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Authorizing Transaction...</span>
            </span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Complete Sale (${grandTotal.toFixed(2)})</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};

export default PaymentModal;
