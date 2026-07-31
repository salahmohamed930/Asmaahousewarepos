import React from 'react';
import { Transaction } from '../../types';
import { Printer, CheckCircle, Mail, X, ShoppingBag, Sparkles, User } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Thermal Receipt Card */}
        <div id="printable-receipt" className="bg-stone-50 text-stone-900 rounded-2xl p-6 font-sans text-xs shadow-inner">
          
          {/* Receipt Header */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300">
            <div className="w-10 h-10 bg-stone-900 text-stone-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-base font-extrabold tracking-tight uppercase">Apex Retail</h1>
            <p className="text-[10px] text-stone-500">5th Avenue Flagship Store • Terminal #01</p>
            <p className="text-[10px] text-stone-500 font-mono mt-1">{transaction.receiptNumber}</p>
            <p className="text-[10px] text-stone-400">
              {new Date(transaction.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Customer & Associate Meta */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-500">Sales Associate:</span>
              <span className="font-bold text-stone-800">{transaction.primaryAssociateName}</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-medium text-stone-800">{transaction.customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Payment Method:</span>
              <span className="font-medium text-stone-800">{transaction.paymentMethod}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-3 border-b border-dashed border-stone-300">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-stone-400 border-b border-stone-200">
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transaction.items.map((item, idx) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1.5 pr-1 font-medium text-stone-800 leading-tight">
                      {item.productName}
                      <span className="block text-[9px] text-stone-400 font-mono">{item.sku}</span>
                    </td>
                    <td className="py-1.5 text-center font-mono text-stone-600">{item.quantity}</td>
                    <td className="py-1.5 text-right font-mono text-stone-600">
                      ${item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold text-stone-800">
                      ${item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span className="font-mono">${transaction.subtotal.toFixed(2)}</span>
            </div>

            {transaction.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discounts</span>
                <span className="font-mono">-${transaction.discountTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-stone-600">
              <span>Sales Tax</span>
              <span className="font-mono">${transaction.taxTotal.toFixed(2)}</span>
            </div>

            {transaction.tipTotal > 0 && (
              <div className="flex justify-between text-indigo-600">
                <span>Associate Tip</span>
                <span className="font-mono">+${transaction.tipTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-1 border-t border-stone-200">
              <span>Grand Total</span>
              <span className="font-mono">${transaction.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Associate Commission Attribution Summary */}
          <div className="pt-3 bg-emerald-50 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-emerald-100">
            <div className="flex items-center space-x-1 text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Associate Sales Attribution</span>
            </div>

            <div className="space-y-1 text-[11px]">
              {transaction.commissions.map((comm, idx) => (
                <div key={idx} className="flex justify-between items-center text-emerald-950">
                  <span>
                    {comm.associateName}{' '}
                    <span className="text-[9px] text-emerald-700">({comm.sharePercentage}%)</span>
                  </span>
                  <div className="text-right font-mono font-semibold">
                    ${comm.saleAmount.toFixed(2)}{' '}
                    <span className="text-[10px] text-emerald-600">
                      (+${comm.commissionAmount.toFixed(2)} comm)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 border border-stone-700 transition-colors"
          >
            <Printer className="w-4 h-4 text-stone-300" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={() => {
              alert(`Receipt sent to ${transaction.customerName || 'Customer email'}`);
            }}
            className="p-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition-colors"
            title="Email Receipt"
          >
            <Mail className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 transition-all flex items-center justify-center space-x-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Done / Next Sale</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReceiptModal;
