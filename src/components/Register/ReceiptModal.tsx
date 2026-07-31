import React from 'react';
import { Transaction } from '../../types';
import { Printer, X, ShoppingBag, Sparkles, User, Hash } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { associates } = usePOS();
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const primaryAssoc = associates.find(
    (a) => a.id === transaction.primaryAssociateId || a.id === (transaction as any).associateId
  );
  const sellerPinCode = primaryAssoc ? primaryAssoc.pin : '101';

  const subtotal = transaction.subtotal || 0;
  const discountTotal = transaction.discountTotal || 0;
  const grandTotal = transaction.grandTotal || subtotal - discountTotal;

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Thermal Receipt Card */}
        <div id="printable-receipt" className="bg-stone-50 text-stone-900 rounded-2xl p-6 font-sans text-xs shadow-inner">
          
          {/* Receipt Header */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300 space-y-1">
            <div className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-base font-extrabold tracking-tight text-stone-900">
              أسماء للأدوات المنزلية
            </h1>
            <p className="text-[10px] text-stone-500 font-bold">فاتورة مبيعات رقمية ورقية</p>
            <p className="text-[11px] text-amber-700 font-mono font-extrabold mt-1">
              رقم الفاتورة: #{transaction.receiptNumber}
            </p>
            <p className="text-[10px] text-stone-500 font-mono">
              {new Date(transaction.timestamp).toLocaleString('ar-EG')}
            </p>
          </div>

          {/* Customer & Seller PIN Meta */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-bold">كود البائع:</span>
              <span className="font-mono font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                كود: {sellerPinCode}
              </span>
            </div>

            {transaction.customerName && (
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">العميل:</span>
                <span className="font-bold text-stone-800">
                  {transaction.customerName}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-stone-500 font-bold">طريقة الدفع:</span>
              <span className="font-bold text-stone-800">
                {transaction.paymentMethod === 'cash' || transaction.paymentMethod === 'كاش'
                  ? 'كاش 💵'
                  : transaction.paymentMethod === 'installment' || transaction.paymentMethod === 'تقسيط شهري'
                  ? 'تقسيط 📅'
                  : 'بطاقة / جملة 💳'}
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-3 border-b border-dashed border-stone-300">
            <table className="w-full text-right">
              <thead>
                <tr className="text-[10px] uppercase text-stone-500 border-b border-stone-200">
                  <th className="pb-1">الصنف</th>
                  <th className="pb-1 text-center">الكمية</th>
                  <th className="pb-1 text-center">السعر</th>
                  <th className="pb-1 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transaction.items.map((item, idx) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1.5 pl-1 font-bold text-stone-800 leading-tight">
                      {item.productName}
                      <span className="block text-[9px] text-stone-400 font-mono">{item.sku}</span>
                    </td>
                    <td className="py-1.5 text-center font-mono text-stone-700">{item.quantity}</td>
                    <td className="py-1.5 text-center font-mono text-stone-700">
                      {(item.unitPrice || 0).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-left font-mono font-bold text-stone-900">
                      {(item.totalPrice || 0).toLocaleString()} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="py-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>المجموع الفرعي:</span>
              <span className="font-mono font-bold">{subtotal.toLocaleString()} ج.م</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>إجمالي الخصم:</span>
                <span className="font-mono">-{discountTotal.toLocaleString()} ج.م</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-stone-950 pt-1.5 border-t border-stone-300">
              <span>الإجمالي النهائي:</span>
              <span className="font-mono text-amber-800">{grandTotal.toLocaleString()} ج.م</span>
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="mt-5 flex items-center space-x-2 space-x-reverse">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse transition-colors shadow-lg"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الفاتورة</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReceiptModal;
