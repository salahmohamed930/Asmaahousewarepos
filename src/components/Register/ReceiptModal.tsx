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
        }
        #printable-receipt {
          padding: ${receiptType === 'a4' ? '15mm 18mm' : '4mm 6mm'} !important;
          margin: 0 auto !important;
          max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
          width: 100% !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
        }
        table.receipt-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 4px 0 !important;
        }
        table.receipt-table th, table.receipt-table td {
          border: 1px solid #000000 !important;
          padding: 4px 6px !important;
          text-align: right !important;
          color: #000000 !important;
        }
        table.receipt-table th {
          background-color: #f0f0f0 !important;
          font-weight: 900 !important;
        }
        table.meta-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-bottom: 6px !important;
        }
        table.meta-table td {
          border: 1px solid #333333 !important;
          padding: 3px 6px !important;
          font-size: 10px !important;
        }
        table.totals-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-top: 4px !important;
        }
        table.totals-table td {
          border: 1px solid #000000 !important;
          padding: 4px 6px !important;
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
              margin: ${receiptType === 'a4' ? '10mm' : '2mm'};
              size: ${receiptType === 'a4' ? 'A4 portrait' : '80mm auto'} !important;
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
              max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              padding: 6px !important;
              margin: 0 auto !important;
              border: none !important;
            }
            table.receipt-table th, table.receipt-table td {
              border: 1px solid #000000 !important;
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
            className={`bg-white text-black rounded-2xl p-5 font-sans text-xs shadow-2xl mx-auto space-y-3 ${
              receiptType === 'a4' 
                ? 'w-full max-w-3xl min-h-[600px] border-2 border-stone-300' 
                : 'max-w-md w-full border border-stone-200'
            }`}
          >
            
            {/* Receipt Header */}
            <div className="text-center pb-2 border-b-2 border-black space-y-1">
              {defaultPrintSettings.showLogo !== false && (
                <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center mx-auto mb-1 shadow-sm">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              )}
              <h1 className="text-base sm:text-lg font-black tracking-tight text-black">
                {defaultPrintSettings.headerText || 'أسماء للأدوات المنزلية'}
              </h1>
              <div className="inline-block bg-black text-white px-3 py-0.5 rounded-md font-bold text-[11px]">
                {isReturn
                  ? 'إيصال مرتجع مبيعات رسمي'
                  : receiptType === 'a4'
                  ? 'فاتورة مبيعات وضمان معتمدة (A4)'
                  : 'فاتورة مبيعات ضريبية ورقية'}
              </div>
            </div>

            {/* Meta Table (Structured Data Grid) */}
            <table className="meta-table w-full border-collapse text-[10px] text-black">
              <tbody>
                <tr>
                  <td className="border border-black bg-stone-100 font-bold w-1/4 p-1.5">رقم الفاتورة:</td>
                  <td className="border border-black font-mono font-black w-1/4 p-1.5">#{transaction.receiptNumber}</td>
                  <td className="border border-black bg-stone-100 font-bold w-1/4 p-1.5">التاريخ والوقت:</td>
                  <td className="border border-black font-mono w-1/4 p-1.5 text-[9.5px]">
                    {new Date(transaction.timestamp).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black bg-stone-100 font-bold p-1.5">اسم العميل:</td>
                  <td className="border border-black font-bold p-1.5">
                    {transaction.customerName || 'عميل نقدي / عام'}
                  </td>
                  <td className="border border-black bg-stone-100 font-bold p-1.5">طريقة الدفع:</td>
                  <td className="border border-black font-bold p-1.5">
                    {transaction.paymentMethod === 'cash' || transaction.paymentMethod === 'كاش'
                      ? 'نقداً (كاش)'
                      : transaction.paymentMethod === 'installment' || transaction.paymentMethod === 'تقسيط شهري'
                      ? 'تقسيط شهري'
                      : transaction.paymentMethod === 'دفع متعدد'
                      ? 'دفع مجزأ'
                      : transaction.paymentMethod === 'نقاط ولاء'
                      ? 'نقاط الولاء'
                      : 'بطاقة / جملة'}
                  </td>
                </tr>
                {defaultPrintSettings.showSellerCode !== false && (
                  <tr>
                    <td className="border border-black bg-stone-100 font-bold p-1.5">الكاشير / البائع:</td>
                    <td className="border border-black font-mono font-bold p-1.5" colSpan={3}>
                      {sellerName} (كود: {sellerPinCode})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Line Items Table (Clean Solid Border Grid) */}
            <div className="w-full overflow-x-auto">
              <table className="receipt-table w-full border-collapse text-[10px] text-black">
                <thead>
                  <tr className="bg-stone-200 border-b border-black font-black text-black">
                    <th className="border border-black p-1.5 text-center w-8">م</th>
                    <th className="border border-black p-1.5 text-right">الصنف والبيان</th>
                    <th className="border border-black p-1.5 text-center w-12">الكمية</th>
                    <th className="border border-black p-1.5 text-center w-16">السعر</th>
                    <th className="border border-black p-1.5 text-left w-20">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border border-black p-1.5 text-center font-mono font-bold text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="border border-black p-1.5 font-bold leading-tight">
                        <span className="block text-[10.5px] text-black">{item.productName}</span>
                        {item.sku && (
                          <span className="block text-[8.5px] text-stone-600 font-mono">
                            كود: {item.sku}
                          </span>
                        )}
                      </td>
                      <td className="border border-black p-1.5 text-center font-mono font-black text-[11px]">
                        {item.quantity}
                      </td>
                      <td className="border border-black p-1.5 text-center font-mono text-[10px]">
                        {(item.unitPrice || 0).toLocaleString()} ج.م
                      </td>
                      <td className="border border-black p-1.5 text-left font-mono font-black text-[11px]">
                        {(item.totalPrice || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Table */}
            <div className="w-full flex justify-end">
              <table className="totals-table w-full sm:w-2/3 border-collapse text-[10.5px] text-black mr-auto">
                <tbody>
                  <tr>
                    <td className="border border-black bg-stone-100 font-bold p-1.5 w-1/2">
                      مجموع الأصناف:
                    </td>
                    <td className="border border-black font-mono font-bold p-1.5 text-left w-1/2">
                      {subtotal.toLocaleString()} ج.م
                    </td>
                  </tr>

                  {discountTotal > 0 && (
                    <tr>
                      <td className="border border-black bg-stone-100 font-bold p-1.5 text-rose-800">
                        قيمة الخصم الممنوح:
                      </td>
                      <td className="border border-black font-mono font-black p-1.5 text-left text-rose-800">
                        -{discountTotal.toLocaleString()} ج.م
                      </td>
                    </tr>
                  )}

                  <tr className="bg-stone-100 font-black text-black">
                    <td className="border-2 border-black p-2 text-[11.5px] font-black">
                      {isReturn ? 'إجمالي المرتجع المسترد:' : 'صافي القيمة المستحقة:'}
                    </td>
                    <td className="border-2 border-black p-2 font-mono font-black text-left text-base">
                      {grandTotal.toLocaleString()} ج.م
                    </td>
                  </tr>

                  {/* Split payments / Amount Paid / Deferred */}
                  {transaction.amountPaid !== undefined && transaction.amountPaid !== grandTotal && (
                    <>
                      <tr>
                        <td className="border border-black bg-stone-50 font-bold p-1 text-[9.5px]">
                          المدفوع نقداً:
                        </td>
                        <td className="border border-black font-mono font-bold p-1 text-left text-[10px]">
                          {(transaction.amountPaid || 0).toLocaleString()} ج.م
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black bg-stone-50 font-bold p-1 text-[9.5px]">
                          المتبقي أجل / مديونية:
                        </td>
                        <td className="border border-black font-mono font-black p-1 text-left text-rose-700 text-[10px]">
                          {(transaction.amountDeferred || 0).toLocaleString()} ج.م
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Split payments breakdown if available */}
            {transaction.splitPayments && transaction.splitPayments.length > 0 && (
              <table className="w-full border border-black border-collapse text-[9.5px]">
                <thead>
                  <tr className="bg-stone-100 border-b border-black">
                    <th className="border border-black p-1 text-right" colSpan={2}>
                      تفاصيل الدفع المجزأ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.splitPayments.map((p, pIdx) => (
                    <tr key={pIdx}>
                      <td className="border border-black p-1">{p.method}</td>
                      <td className="border border-black p-1 font-mono font-bold text-left">
                        {p.amount.toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Custom Footer Message */}
            {defaultPrintSettings.footerText && (
              <div className="text-center pt-2 border-t border-black text-[9.5px] font-bold text-stone-800">
                {defaultPrintSettings.footerText}
              </div>
            )}

            {/* Barcode & QR code of Receipt */}
            <div className="pt-2 border-t border-dotted border-black flex flex-col items-center justify-center space-y-1">
              <BarcodeItem
                value={transaction.receiptNumber || '000000'}
                height={18}
                width={1.2}
                fontSize={8}
                displayValue={true}
              />
              {defaultPrintSettings.showQRCode !== false && (
                <span className="text-[7.5px] text-stone-600 font-bold">
                  فاتورة إلكترونية معتمدة بنظام نقطة البيع
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
              {receiptType === 'a4' ? 'طباعة فاتورة A4 داخل جدول' : 'طباعة الإيصال الحراري داخل جدول'}
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
