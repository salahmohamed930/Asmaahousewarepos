import React, { useState } from 'react';
import { Transaction } from '../../types';
import { Printer, X, ShoppingBag, Sparkles, User, Hash, FileText, CheckCircle2 } from 'lucide-react';
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

  const defaultPrintSettings = settings?.printSettings || {
    headerText: 'أسماء للأدوات المنزلية',
    footerText: 'شكرًا لزيارتكم! نسعد دائمًا بخدمتكم.',
    showSellerCode: true,
    showQRCode: true,
    showLogo: true,
    receiptType: 'thermal' as const
  };

  const [receiptType, setReceiptType] = useState<'thermal' | 'a4'>(
    defaultPrintSettings.receiptType || 'thermal'
  );

  const primaryAssoc = associates.find(
    (a) => a.id === transaction.primaryAssociateId || a.id === (transaction as any).associateId
  );
  const sellerPinCode = primaryAssoc ? primaryAssoc.pin : '101';
  const sellerName = primaryAssoc ? primaryAssoc.name : 'الكاشير';

  const subtotal = transaction.subtotal || 0;
  const discountTotal = transaction.discountTotal || 0;
  const grandTotal = transaction.grandTotal || subtotal - discountTotal;
  const isReturn = transaction.status === 'مسترجعة' || transaction.items.some((i) => i.quantity < 0);

  const handlePrint = () => {
    printElementById('printable-receipt', {
      pageTitle: `فاتورة-${transaction.receiptNumber}`,
      isThermalReceipt: receiptType !== 'a4',
      pageCssSize: receiptType === 'a4' ? 'A4 portrait' : '80mm auto',
      customStyles: `
        *, *::before, *::after {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-size: ${receiptType === 'a4' ? '10px' : '8.5px'} !important;
        }
        #printable-receipt {
          padding: ${receiptType === 'a4' ? '12mm 15mm' : '3mm 4mm'} !important;
          margin: 0 auto !important;
          max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
          width: 100% !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          font-size: ${receiptType === 'a4' ? '10px' : '8.5px'} !important;
          line-height: 1.35 !important;
        }
        /* Table ONLY around items */
        table.receipt-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 5px 0 !important;
          border: 1.2px solid #000000 !important;
        }
        table.receipt-table th, table.receipt-table td {
          border: 1px solid #000000 !important;
          padding: 2.5px 4px !important;
          text-align: right !important;
          color: #000000 !important;
          font-size: ${receiptType === 'a4' ? '9.5px' : '8px'} !important;
        }
        table.receipt-table th {
          background-color: #f2f2f2 !important;
          font-weight: 900 !important;
          text-align: center !important;
        }
      `,
    });
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
      <div className={`bg-stone-900 border border-stone-800 rounded-3xl w-full p-6 shadow-2xl relative text-stone-100 my-8 transition-all ${
        receiptType === 'a4' ? 'max-w-4xl' : 'max-w-xl'
      }`}>
        
        {/* Style block for Print dialog fallback */}
        <style>{`
          @media print {
            @page {
              margin: ${receiptType === 'a4' ? '8mm' : '1.5mm'};
              size: ${receiptType === 'a4' ? 'A4 portrait' : '80mm auto'} !important;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-size: ${receiptType === 'a4' ? '10px' : '8.5px'} !important;
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
              max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              padding: 4px !important;
              margin: 0 auto !important;
              border: none !important;
              font-size: ${receiptType === 'a4' ? '10px' : '8.5px'} !important;
            }
            table.receipt-table {
              border-collapse: collapse !important;
              border: 1.2px solid #000000 !important;
              width: 100% !important;
            }
            table.receipt-table th, table.receipt-table td {
              border: 1px solid #000000 !important;
              padding: 2.5px 4px !important;
              font-size: ${receiptType === 'a4' ? '9.5px' : '8px'} !important;
            }
            table.receipt-table th {
              background-color: #f2f2f2 !important;
            }
            .no-print {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}</style>

        {/* Close Button & Print Mode Toggle Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4 no-print">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">
                {isReturn ? 'معاينة إيصال المرتجع' : 'معاينة وطباعة الفاتورة'}
              </h3>
              <p className="text-xs text-stone-400 font-mono">
                فاتورة رقم: #{transaction.receiptNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Format Switcher */}
            <div className="bg-stone-950 p-1 rounded-xl border border-stone-800 flex items-center">
              <button
                type="button"
                onClick={() => setReceiptType('thermal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  receiptType === 'thermal'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                إيصال حراري (80mm)
              </button>
              <button
                type="button"
                onClick={() => setReceiptType('a4')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  receiptType === 'a4'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                فاتورة رسمية (A4)
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Thermal / A4 Receipt Card */}
        <div id="printable-receipt-wrap" className="w-full max-h-[70vh] overflow-y-auto pr-1">
          <div 
            id="printable-receipt" 
            className={`bg-white text-black rounded-2xl p-4 font-sans shadow-2xl mx-auto space-y-2 ${
              receiptType === 'a4' 
                ? 'w-full max-w-3xl min-h-[600px] border-2 border-stone-300 text-[10px]' 
                : 'max-w-md w-full border border-stone-200 text-[8.5px]'
            }`}
          >
            
            {/* Receipt Header */}
            <div className="text-center pb-1.5 border-b border-black space-y-0.5">
              {defaultPrintSettings.showLogo !== false && (
                <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center mx-auto mb-0.5 shadow-sm">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
              )}
              <h1 className="text-sm sm:text-base font-black tracking-tight text-black leading-tight">
                {defaultPrintSettings.headerText || 'أسماء للأدوات المنزلية'}
              </h1>
              <div className="inline-block bg-black text-white px-2 py-0.5 rounded font-bold text-[9px]">
                {isReturn
                  ? 'إيصال مرتجع مبيعات رسمي'
                  : receiptType === 'a4'
                  ? 'فاتورة مبيعات وضمان معتمدة (A4)'
                  : 'فاتورة مبيعات نقدية'}
              </div>
            </div>

            {/* Meta Info Section (Clean Key-Value Rows without grid border) */}
            <div className="py-1 border-b border-dashed border-stone-400 text-[8.5px] leading-relaxed space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-stone-700">
                  رقم الفاتورة: <strong className="font-mono font-black text-black">#{transaction.receiptNumber}</strong>
                </span>
                <span className="text-stone-700 font-mono text-[8px]">
                  {new Date(transaction.timestamp).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-700">
                  العميل: <strong className="font-bold text-black">{transaction.customerName || 'عميل نقدي / عام'}</strong>
                </span>
                <span className="text-stone-700">
                  الدفع: <strong className="font-bold text-black">
                    {transaction.paymentMethod === 'cash' || transaction.paymentMethod === 'كاش'
                      ? 'نقداً (كاش)'
                      : transaction.paymentMethod === 'installment' || transaction.paymentMethod === 'تقسيط شهري'
                      ? 'تقسيط شهري'
                      : transaction.paymentMethod === 'دفع متعدد'
                      ? 'دفع مجزأ'
                      : transaction.paymentMethod === 'نقاط ولاء'
                      ? 'نقاط الولاء'
                      : 'أجل / بطاقة'}
                  </strong>
                </span>
              </div>

              {defaultPrintSettings.showSellerCode !== false && (
                <div className="flex items-center justify-between text-[8px] text-stone-600">
                  <span>
                    الكاشير / البائع: <strong className="text-black font-semibold">{sellerName}</strong> (كود: <span className="font-mono">{sellerPinCode}</span>)
                  </span>
                  {transaction.tableNumber && (
                    <span>طاولة: {transaction.tableNumber}</span>
                  )}
                </div>
              )}
            </div>

            {/* Line Items Table (THE ONLY BORDERED GRID TABLE IN THE RECEIPT) */}
            <div className="w-full overflow-x-auto my-1">
              <table className="receipt-table w-full border-collapse text-[8px] text-black">
                <thead>
                  <tr className="bg-stone-100 font-black text-black">
                    <th className="p-1 text-center w-6">م</th>
                    <th className="p-1 text-right">الصنف والبيان</th>
                    <th className="p-1 text-center w-10">الكمية</th>
                    <th className="p-1 text-center w-14">السعر</th>
                    <th className="p-1 text-left w-16">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-1 text-center font-mono font-bold text-[8px]">
                        {idx + 1}
                      </td>
                      <td className="p-1 font-bold leading-tight">
                        <span className="block text-[8.5px] text-black">{item.productName}</span>
                        {item.sku && (
                          <span className="block text-[7px] text-stone-500 font-mono">
                            كود: {item.sku}
                          </span>
                        )}
                      </td>
                      <td className="p-1 text-center font-mono font-black text-[9px]">
                        {item.quantity}
                      </td>
                      <td className="p-1 text-center font-mono text-[8px]">
                        {(item.unitPrice || 0).toLocaleString()}
                      </td>
                      <td className="p-1 text-left font-mono font-black text-[8.5px]">
                        {(item.totalPrice || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Section (Clean list without outer grid table) */}
            <div className="pt-1 border-t border-dashed border-stone-400 space-y-1">
              <div className="space-y-0.5 text-[8.5px]">
                <div className="flex justify-between items-center text-stone-700">
                  <span>مجموع الأصناف:</span>
                  <span className="font-mono font-bold text-black">{subtotal.toLocaleString()} ج.م</span>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between items-center text-rose-700 font-bold">
                    <span>قيمة الخصم الممنوح:</span>
                    <span className="font-mono font-black">-{discountTotal.toLocaleString()} ج.م</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 px-1.5 bg-stone-100 rounded border-y border-black font-black text-black">
                  <span className="text-[9.5px]">
                    {isReturn ? 'إجمالي المرتجع المسترد:' : 'صافي القيمة المستحقة:'}
                  </span>
                  <span className="font-mono font-black text-[12px]">
                    {grandTotal.toLocaleString()} ج.م
                  </span>
                </div>

                {/* Paid / Deferred breakdown */}
                {transaction.amountPaid !== undefined && transaction.amountPaid !== grandTotal && (
                  <div className="space-y-0.5 pt-0.5 text-[8px]">
                    <div className="flex justify-between text-stone-600">
                      <span>المدفوع:</span>
                      <span className="font-mono font-bold text-black">{(transaction.amountPaid || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>المتبقي أجل:</span>
                      <span className="font-mono font-black">{(transaction.amountDeferred || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Split payments breakdown if available (clean minimalist list) */}
            {transaction.splitPayments && transaction.splitPayments.length > 0 && (
              <div className="p-1 bg-stone-50 rounded border border-stone-300 text-[8px] space-y-0.5">
                <div className="font-bold text-stone-700 border-b border-stone-200 pb-0.5">تفاصيل الدفع:</div>
                {transaction.splitPayments.map((p, pIdx) => (
                  <div key={pIdx} className="flex justify-between">
                    <span className="text-stone-600">{p.method}</span>
                    <span className="font-mono font-bold">{p.amount.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Footer Message */}
            {defaultPrintSettings.footerText && (
              <div className="text-center pt-1 border-t border-dotted border-stone-400 text-[8px] font-bold text-stone-700 leading-tight">
                {defaultPrintSettings.footerText}
              </div>
            )}

            {/* Barcode of Receipt */}
            <div className="pt-1 flex flex-col items-center justify-center space-y-0.5">
              <BarcodeItem
                value={transaction.receiptNumber || '000000'}
                height={14}
                width={1.05}
                fontSize={7}
                displayValue={true}
              />
              {defaultPrintSettings.showQRCode !== false && (
                <span className="text-[7px] text-stone-500 font-medium">
                  فاتورة مبيعات إلكترونية معتمدة
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-5 flex items-center space-x-2 space-x-reverse no-print">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse transition-colors shadow-lg active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>
              {receiptType === 'a4' ? 'طباعة فاتورة A4 الرسمية' : 'طباعة الإيصال الحراري (80mm)'}
            </span>
          </button>
          
          <button
            onClick={onClose}
            className="px-5 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReceiptModal;
