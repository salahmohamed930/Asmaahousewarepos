import React from 'react';
import { Transaction } from '../../types';
import { Printer, X, ShoppingBag, Sparkles, User, Hash } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { printElementById } from '../../utils/printHelper';
import { BarcodeItem } from '../Common/BarcodeItem';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { associates, settings } = usePOS();
  if (!transaction) return null;

  const printSettings = settings?.printSettings || {
    headerText: 'أسماء للأدوات المنزلية',
    footerText: 'شكرًا لزيارتكم! نسعد دائمًا بخدمتكم.',
    showSellerCode: true,
    showQRCode: true,
    showLogo: true,
    receiptType: 'thermal' as const
  };

  const handlePrint = () => {
    printElementById('printable-receipt', {
      pageTitle: `فاتورة-${transaction.receiptNumber}`,
      isThermalReceipt: printSettings.receiptType !== 'a4',
      pageCssSize: printSettings.receiptType === 'a4' ? 'A4 portrait' : '80mm auto',
      customStyles: `
        #printable-receipt {
          padding: 8px 12px;
          margin: 0 auto;
          max-width: ${printSettings.receiptType === 'a4' ? '100%' : '80mm'};
        }
      `,
    });
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
      <div className={`bg-stone-900 border border-stone-800 rounded-3xl w-full p-6 shadow-2xl relative text-stone-100 my-8 transition-all ${
        printSettings.receiptType === 'a4' ? 'max-w-4xl' : 'max-w-md'
      }`}>
        
        {/* Style block for perfect physical print scaling without blank page bug */}
        <style>{`
          @media print {
            @page {
              margin: 4mm;
              size: ${printSettings.receiptType === 'a4' ? 'A4 portrait' : '80mm auto'} !important;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-receipt-wrap, #printable-receipt-wrap * {
              visibility: visible !important;
            }
            #printable-receipt-wrap {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              display: block !important;
            }
            #printable-receipt {
              position: relative !important;
              left: auto !important;
              top: auto !important;
              width: 100% !important;
              max-width: ${printSettings.receiptType === 'a4' ? '100%' : '80mm'} !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              padding: 8px !important;
              margin: 0 auto !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}</style>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors no-print"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Thermal/A4 Receipt Card */}
        <div id="printable-receipt-wrap" className="w-full">
          <div 
            id="printable-receipt" 
            className={`bg-stone-50 text-stone-900 rounded-2xl p-6 font-sans text-xs shadow-inner mx-auto space-y-4 ${
              printSettings.receiptType === 'a4' 
                ? 'w-full max-w-4xl min-h-[600px] border border-stone-300' 
                : 'max-w-md w-full'
            }`}
          >
            
            {/* Receipt Header */}
            <div className="text-center pb-4 border-b border-dashed border-stone-300 space-y-1">
              {printSettings.showLogo !== false && (
                <div className="w-12 h-12 bg-amber-600 text-white rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
              <h1 className="text-lg font-black tracking-tight text-stone-900">
                {printSettings.headerText || 'أسماء للأدوات المنزلية'}
              </h1>
              <p className="text-[10px] text-stone-500 font-bold">
                {transaction.status === 'مسترجعة' || transaction.items.some((i) => i.quantity < 0)
                  ? 'مرتجع مبيعات رسمي'
                  : printSettings.receiptType === 'a4'
                  ? 'فاتورة مبيعات وضمان رسمية (A4)'
                  : 'فاتورة مبيعات رقمية ورقية'}
              </p>
              <p className="text-[11px] text-amber-700 font-mono font-extrabold mt-1">
                رقم الفاتورة: #{transaction.receiptNumber}
              </p>
              <p className="text-[10px] text-stone-500 font-mono">
                {new Date(transaction.timestamp).toLocaleString('ar-EG')}
              </p>
            </div>

            {/* Customer & Seller PIN Meta */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1.5 text-[11px]">
              <div className="grid grid-cols-2 gap-2">
                {printSettings.showSellerCode !== false && (
                  <div className="flex justify-between items-center bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-lg">
                    <span className="text-stone-500 font-bold">كود البائع:</span>
                    <span className="font-mono font-extrabold text-amber-800">
                      كود: {sellerPinCode}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-lg">
                  <span className="text-stone-500 font-bold">طريقة الدفع:</span>
                  <span className="font-bold text-stone-800">
                    {transaction.paymentMethod === 'cash' || transaction.paymentMethod === 'كاش'
                      ? 'كاش 💵'
                      : transaction.paymentMethod === 'installment' || transaction.paymentMethod === 'تقسيط شهري'
                      ? 'تقسيط 📅'
                      : transaction.paymentMethod === 'دفع متعدد'
                      ? 'دفع مجزأ / متعدد 🧾'
                      : transaction.paymentMethod === 'نقاط ولاء'
                      ? 'نقاط الولاء 🌟'
                      : 'بطاقة / جملة 💳'}
                  </span>
                </div>
              </div>

              {transaction.customerName && (
                <div className="flex justify-between items-center bg-stone-100/50 border border-stone-200 px-3 py-1.5 rounded-lg mt-1">
                  <span className="text-stone-500 font-bold">اسم العميل:</span>
                  <span className="font-extrabold text-stone-900">
                    {transaction.customerName}
                  </span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-stone-300">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase text-stone-500 border-b border-stone-300 bg-stone-100">
                    <th className="p-2">الصنف والوصف</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-center">سعر الوحدة</th>
                    <th className="p-2 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {transaction.items.map((item, idx) => (
                    <tr key={idx} className="text-[11px] hover:bg-stone-100/30">
                      <td className="p-2 font-bold text-stone-900 leading-tight">
                        {item.productName}
                        <span className="block text-[9px] text-stone-400 font-mono mt-0.5">{item.sku}</span>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-stone-700">{item.quantity}</td>
                      <td className="p-2 text-center font-mono text-stone-700">
                        {item.totalPrice !== (item.unitPrice || 0) * item.quantity ? (
                          <div className="flex flex-col items-center">
                            <span className="line-through text-[10px] text-stone-400">
                              {(item.unitPrice || 0).toLocaleString()} ج.م
                            </span>
                            <span className="text-emerald-700 font-bold text-[11px]">
                              {(Math.round((item.totalPrice / item.quantity) * 100) / 100).toLocaleString()} ج.م
                            </span>
                          </div>
                        ) : (
                          <span>{(item.unitPrice || 0).toLocaleString()} ج.م</span>
                        )}
                      </td>
                      <td className="p-2 text-left font-mono font-extrabold text-stone-950">
                        {item.totalPrice !== (item.unitPrice || 0) * item.quantity ? (
                          <div className="flex flex-col items-end">
                            <span className="line-through text-[10px] text-stone-400 font-medium">
                              {((item.unitPrice || 0) * item.quantity).toLocaleString()} ج.م
                            </span>
                            <span className="text-emerald-700 font-black">
                              {(item.totalPrice || 0).toLocaleString()} ج.م
                            </span>
                          </div>
                        ) : (
                          <span>{(item.totalPrice || 0).toLocaleString()} ج.م</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals */}
            <div className="py-2 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>المجموع الفرعي للأصناف:</span>
                <span className="font-mono font-bold">{subtotal.toLocaleString()} ج.م</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  <span>إجمالي الخصم الممنوح:</span>
                  <span className="font-mono font-extrabold">-{discountTotal.toLocaleString()} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-stone-950 pt-2 border-t border-stone-300">
                <span>
                  {transaction.status === 'مسترجعة' || transaction.items.some((i) => i.quantity < 0)
                    ? 'إجمالي قيمة المرتجع المسترد:'
                    : 'الإجمالي النهائي المستحق:'}
                </span>
                <span className="font-mono text-base text-amber-800 font-black">{grandTotal.toLocaleString()} ج.م</span>
              </div>

              {transaction.splitPayments && transaction.splitPayments.length > 0 ? (
                <div className="pt-2 border-t border-dashed border-stone-200 mt-2 space-y-1 bg-stone-100/50 p-2.5 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-500 block mb-1">تفاصيل الدفع المجزأ:</span>
                  {transaction.splitPayments.map((p, pIdx) => (
                    <div key={pIdx} className="flex justify-between text-[11px] text-stone-800 font-medium">
                      <span>{p.method}:</span>
                      <span className="font-mono font-bold">{p.amount.toLocaleString()} ج.م</span>
                    </div>
                  ))}
                </div>
              ) : (
                transaction.amountPaid !== undefined && transaction.amountPaid !== grandTotal && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dotted border-stone-200">
                    <div className="flex justify-between text-emerald-800 bg-emerald-50/50 border border-emerald-100 px-2 py-1 rounded-md text-[10px] font-bold">
                      <span>المدفوع:</span>
                      <span className="font-mono">{(transaction.amountPaid || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-rose-800 bg-rose-50/50 border border-rose-100 px-2 py-1 rounded-md text-[10px] font-bold">
                      <span>المتبقي مديونية:</span>
                      <span className="font-mono">{(transaction.amountDeferred || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Custom Footer Text */}
            {printSettings.footerText && (
              <div className="text-center pt-3 border-t border-dashed border-stone-300 text-[10px] text-stone-500 font-bold leading-relaxed">
                {printSettings.footerText}
              </div>
            )}

            {/* Custom QR Code option */}
            {printSettings.showQRCode !== false && (
              <div className="flex flex-col items-center justify-center pt-3 border-t border-dashed border-stone-300">
                <div className="w-16 h-16 bg-white border border-stone-200 p-1 rounded-lg flex items-center justify-center">
                  <svg className="w-full h-full text-stone-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2,2 H8 V8 H2 Z M4,4 V6 H6 V4 Z M16,2 H22 V8 H16 Z M18,4 V6 H20 V4 Z M2,16 H8 V22 H2 Z M4,18 V20 H6 V18 Z M10,10 H14 V14 H10 Z M12,2 H14 V4 H12 Z M10,6 H12 V8 H10 Z M14,16 H16 V18 H14 Z M10,18 H12 V20 H10 Z M12,20 H14 V22 H12 Z M16,10 H18 V12 H16 Z M18,12 H20 V14 H18 Z M20,16 H22 V18 H20 Z M18,20 H20 V22 H18 Z" />
                  </svg>
                </div>
                <span className="text-[8px] text-stone-400 mt-1 font-bold">فاتورة مبيعات معتمدة رقمياً</span>
              </div>
            )}

          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-5 flex items-center space-x-2 space-x-reverse no-print">
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
