import React, { useState } from 'react';
import { Transaction } from '../../types';
import { Printer, X, FileText } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { printElementById } from '../../utils/printHelper';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { associates, settings } = usePOS();

  const defaultPrintSettings = settings?.printSettings || {
    headerText: 'أسماء للأدوات المنزليه',
    address: 'اخر شارع المدارس امام دار المناسبات حى الصفا',
    phoneNumbers: '01229028133 - 01222334884',
    footerText: 'شكرا و دائما فى خدمتكم',
    footerSubText: 'visit us again',
    facebookUrl: 'https://facebook.com',
    showSellerCode: true,
    showQRCode: true,
    showLogo: false,
    receiptType: 'thermal' as const,
  };

  const [receiptType, setReceiptType] = useState<'thermal' | 'a4'>(
    defaultPrintSettings.receiptType || 'thermal'
  );

  if (!transaction) return null;

  const primaryAssoc = associates.find(
    (a) => a.id === transaction.primaryAssociateId || a.id === (transaction as any).associateId
  );
  const sellerName = primaryAssoc ? primaryAssoc.name : (transaction.primaryAssociateName || 'Admin');

  const subtotal = transaction.subtotal || 0;
  const discountTotal = transaction.discountTotal || 0;
  const grandTotal = transaction.grandTotal || subtotal - discountTotal;
  const isReturn = transaction.status === 'مسترجعة' || transaction.items.some((i) => i.quantity < 0);

  // Price & number formatting helper (e.g. 520.0, 135.0, 2.0)
  const formatPrice = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === '') return '0.0';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return String(val);
    return Number.isInteger(num) ? `${num}.0` : num.toFixed(1);
  };

  // Date formatting: Day - Month - Year (e.g. 15 - 7 - 2026)
  const formatReceiptDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return `${d.getDate()} - ${d.getMonth() + 1} - ${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  // Time formatting: Hour:Minute (e.g. 18:3)
  const formatReceiptTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return `${d.getHours()}:${d.getMinutes()}`;
    } catch {
      return '';
    }
  };

  const getPaymentTypeName = (method: string): string => {
    if (method === 'cash' || method === 'كاش' || method === 'نقداً (كاش)') return 'كاش';
    if (method === 'installment' || method === 'تقسيط شهري' || method === 'تقسيط') return 'تقسيط';
    if (method === 'آجل / حساب جملة' || method === 'آجل' || method === 'credit') return 'آجل';
    if (method === 'فيزا / كارت') return 'فيزا / كارت';
    if (method === 'محفظة إلكترونية') return 'محفظة إلكترونية';
    if (method === 'دفع متعدد') return 'دفع متعدد';
    if (method === 'نقاط ولاء') return 'نقاط ولاء';
    return method || 'كاش';
  };

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
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          font-size: ${receiptType === 'a4' ? '11.5px' : '10px'} !important;
          font-weight: 800 !important;
        }
        #printable-receipt {
          padding: ${receiptType === 'a4' ? '12mm 15mm' : '2mm 3mm'} !important;
          margin: 0 auto !important;
          max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
          width: 100% !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          font-size: ${receiptType === 'a4' ? '11.5px' : '10px'} !important;
          font-weight: 800 !important;
          line-height: 1.35 !important;
        }
        table.receipt-items-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 6px 0 !important;
          font-weight: 800 !important;
        }
        table.receipt-items-table thead tr {
          background-color: #d1d5db !important;
          border-top: 1.5px solid #000000 !important;
          border-bottom: 1.5px solid #000000 !important;
          font-weight: 900 !important;
        }
        table.receipt-items-table th, table.receipt-items-table td {
          padding: 3px 2px !important;
          color: #000000 !important;
          font-size: ${receiptType === 'a4' ? '11px' : '9.5px'} !important;
          font-weight: 800 !important;
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
              margin: ${receiptType === 'a4' ? '8mm' : '1mm 2mm'};
              size: ${receiptType === 'a4' ? 'A4 portrait' : '80mm auto'} !important;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-size: ${receiptType === 'a4' ? '11.5px' : '10px'} !important;
              font-weight: 800 !important;
              font-family: 'Cairo', system-ui, sans-serif !important;
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
              font-size: ${receiptType === 'a4' ? '11.5px' : '10px'} !important;
              font-weight: 800 !important;
            }
            table.receipt-items-table {
              border-collapse: collapse !important;
              width: 100% !important;
              font-weight: 800 !important;
            }
            table.receipt-items-table thead tr {
              background-color: #d1d5db !important;
              border-top: 1.5px solid #000000 !important;
              border-bottom: 1.5px solid #000000 !important;
              font-weight: 900 !important;
            }
            table.receipt-items-table th, table.receipt-items-table td {
              padding: 3px 2px !important;
              font-size: ${receiptType === 'a4' ? '11px' : '9.5px'} !important;
              font-weight: 800 !important;
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
            className={`bg-white text-black rounded-2xl p-5 font-sans shadow-2xl mx-auto space-y-2.5 ${
              receiptType === 'a4' 
                ? 'w-full max-w-3xl min-h-[600px] border-2 border-stone-300 text-[11.5px] font-extrabold' 
                : 'max-w-md w-full border border-stone-200 text-[10px] font-extrabold'
            }`}
          >
            
            {/* 1. Header (Centered store name, address, phone numbers) */}
            <div className="text-center space-y-0.5 pb-1 border-b border-transparent">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-black leading-tight">
                {defaultPrintSettings.headerText || 'أسماء للأدوات المنزليه'}
              </h1>
              {defaultPrintSettings.address && (
                <p className="text-[10px] text-black font-extrabold leading-tight">
                  {defaultPrintSettings.address}
                </p>
              )}
              {defaultPrintSettings.phoneNumbers && (
                <p className="text-[10.5px] text-black font-mono font-black leading-tight" dir="ltr">
                  {defaultPrintSettings.phoneNumbers}
                </p>
              )}
            </div>

            {/* 2. Metadata Section (Right-aligned key-value list with colons) */}
            <div className="text-[10.5px] leading-relaxed space-y-1 font-black text-black text-right pt-1">
              <div>
                <span className="font-extrabold">رقم الفاتوره : </span>
                <span className="font-mono font-black text-black">{transaction.receiptNumber}</span>
              </div>
              <div>
                <span className="font-extrabold">نوع الفاتوره : </span>
                <span className="font-black text-black">{getPaymentTypeName(transaction.paymentMethod)}</span>
              </div>
              <div>
                <span className="font-extrabold">حالة الفاتوره : </span>
                <span className="font-black text-black">{isReturn ? 'مرتجع' : 'بيع'}</span>
              </div>
              <div>
                <span className="font-extrabold">تاريخ الفاتوره : </span>
                <span className="font-mono font-black text-black">{formatReceiptDate(transaction.timestamp)}</span>
              </div>
              <div>
                <span className="font-extrabold">الساعه : </span>
                <span className="font-mono font-black text-black">{formatReceiptTime(transaction.timestamp)}</span>
              </div>
              <div>
                <span className="font-extrabold">اسم الكاشير : </span>
                <span className="font-black text-black">{sellerName}</span>
              </div>
            </div>

            {/* 3. Items Section (Shaded header, no vertical lines, clean columns) */}
            <div className="w-full my-1">
              <table className="receipt-items-table w-full border-collapse text-[10px] text-black font-black">
                <thead>
                  <tr className="bg-stone-200/90 font-black border-y-2 border-black text-black">
                    <th className="py-1 px-1 text-right w-[46%] font-black">الصنف</th>
                    <th className="py-1 px-1 text-center w-[18%] font-black">السعر</th>
                    <th className="py-1 px-1 text-center w-[16%] font-black">الكميه</th>
                    <th className="py-1 px-1 text-left w-[20%] font-black">الاجمالي</th>
                  </tr>
                </thead>
                <tbody className="font-black">
                  {transaction.items.map((item, idx) => (
                    <tr key={idx} className="leading-tight">
                      <td className="py-1 px-1 text-right align-top font-black text-[10px] text-black">
                        {item.productName}
                      </td>
                      <td className="py-1 px-1 text-center align-top font-mono font-black text-[10px] text-black">
                        {formatPrice(item.unitPrice)}
                      </td>
                      <td className="py-1 px-1 text-center align-top font-mono font-black text-[10px] text-black">
                        {formatPrice(item.quantity)}
                      </td>
                      <td className="py-1 px-1 text-left align-top font-mono font-black text-[10px] text-black">
                        {formatPrice(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Totals Summary (Right-aligned, matching the image format) */}
            <div className="pt-2 text-[11.5px] font-black text-black text-right space-y-1">
              <div>
                <span className="font-extrabold">الاجمالي : </span>
                <span className="font-mono font-black">{formatPrice(grandTotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div>
                  <span className="font-extrabold">الخصم : </span>
                  <span className="font-mono font-black">{formatPrice(discountTotal)}</span>
                </div>
              )}
              <div>
                <span className="font-extrabold">المدفوع : </span>
                <span className="font-mono font-black">{formatPrice(transaction.amountPaid ?? grandTotal)}</span>
              </div>
              <div>
                <span className="font-extrabold">المتبقي : </span>
                <span className="font-mono font-black">{formatPrice(transaction.amountDeferred ?? 0)}</span>
              </div>
            </div>

            {/* 5. Footer (Bottom-left FaceBook QR Code & Bottom-right / Center Greeting Note) */}
            <div className="pt-3 mt-2 flex items-end justify-between">
              {/* Facebook QR Code */}
              {defaultPrintSettings.showQRCode !== false && (
                <div className="flex flex-col items-start space-y-1">
                  <span className="text-[10px] font-black text-black font-sans">FaceBook</span>
                  <div className="p-0.5 bg-white border border-black rounded">
                    <QRCodeSVG
                      value={defaultPrintSettings.facebookUrl || 'https://facebook.com'}
                      size={68}
                      level="M"
                    />
                  </div>
                </div>
              )}

              {/* Thank You Note */}
              <div className="text-center font-black text-black space-y-0.5 pb-1">
                <p className="text-[11.5px] font-black leading-tight">
                  {defaultPrintSettings.footerText || 'شكرا و دائما فى خدمتكم'}
                </p>
                <p className="text-[10.5px] font-sans font-black leading-tight" dir="ltr">
                  {defaultPrintSettings.footerSubText || 'visit us again'}
                </p>
              </div>
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

