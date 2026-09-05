import React, { useState } from 'react';
import { Customer, Transaction } from '../../types';
import { Printer, X, FileText, Calendar, User, Phone, MapPin, DollarSign, CreditCard } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { smartPrintElementById } from '../../utils/printHelper';

interface CustomerStatementReceiptModalProps {
  customer: Customer;
  onClose: () => void;
  initialFormat?: 'thermal' | 'a4';
}

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return '';
  }
}

function formatPrice(num: number | null | undefined): string {
  const val = Number(num) || 0;
  return val.toLocaleString('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export const CustomerStatementReceiptModal: React.FC<CustomerStatementReceiptModalProps> = ({
  customer,
  onClose,
  initialFormat = 'thermal',
}) => {
  const { transactions, settings } = usePOS();
  const [receiptType, setReceiptType] = useState<'thermal' | 'a4'>(initialFormat);

  const defaultPrintSettings = settings?.printSettings || {
    headerText: 'أسماء للأدوات المنزليه',
    address: 'اخر شارع المدارس امام دار المناسبات حى الصفا',
    phoneNumbers: '01229028133 - 01222334884',
    footerText: 'شكرا و دائما فى خدمتكم',
    footerSubText: 'visit us again',
    showQRCode: false,
  };

  // Date 3 months ago
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  // Filter transactions for this customer
  const customerTx = (transactions || []).filter((t) => {
    if (!t) return false;
    if (t.customerId && t.customerId === customer.id) return true;
    if (t.customerName && t.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase()) return true;
    return false;
  });

  // Separate transactions prior to 3 months ago and within 3 months
  const priorTx = customerTx.filter((t) => new Date(t.timestamp) < threeMonthsAgo);
  const periodTx = customerTx
    .filter((t) => new Date(t.timestamp) >= threeMonthsAgo)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Helper to determine debt effect
  const getDebtEffect = (tx: Transaction) => {
    const isPayment = tx.items.some(
      (item) => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || tx.id.startsWith('pay_')
    );
    if (isPayment) {
      const amount = Math.abs(tx.grandTotal || tx.amountPaid || 0);
      return { isPayment: true, debtDelta: -amount, amount, isCreditSale: false };
    }
    let deferred = 0;
    if (tx.amountDeferred !== undefined) {
      deferred = tx.amountDeferred;
    } else if ((tx as any).paymentMethod === 'آجل' || (tx as any).status === 'آجل') {
      deferred = tx.grandTotal || 0;
    }
    return {
      isPayment: false,
      debtDelta: deferred,
      amount: tx.grandTotal || 0,
      deferredAmount: deferred,
      isCreditSale: deferred > 0,
    };
  };

  // Calculate prior opening debt balance
  let calculatedPriorDebt = 0;
  priorTx.forEach((t) => {
    const effect = getDebtEffect(t);
    calculatedPriorDebt = Math.max(0, calculatedPriorDebt + effect.debtDelta);
  });

  const openingBalance = calculatedPriorDebt;

  // Totals for last 3 months
  let periodSalesTotal = 0;
  let periodPaymentsTotal = 0;
  let periodDeferredTotal = 0;

  // Build statement entries with running balance
  let runningBalance = openingBalance;

  const statementEntries = periodTx.map((tx) => {
    const effect = getDebtEffect(tx);

    if (effect.isPayment) {
      periodPaymentsTotal += effect.amount;
      runningBalance = Math.max(0, runningBalance - effect.amount);
    } else {
      periodSalesTotal += effect.amount;
      periodDeferredTotal += (effect.deferredAmount || 0);
      runningBalance = Math.max(0, runningBalance + (effect.deferredAmount || 0));
    }

    let defaultDesc = effect.isPayment ? 'سداد دفعة / قسط' : 'فاتورة مبيعات';
    if (!effect.isPayment && effect.deferredAmount && effect.deferredAmount > 0) {
      if (effect.deferredAmount < effect.amount) {
        defaultDesc = `فاتورة مبيعات (آجل جزئي ${formatPrice(effect.deferredAmount)})`;
      } else {
        defaultDesc = 'فاتورة مبيعات (آجل بالكامل)';
      }
    }

    return {
      id: tx.id,
      receiptNumber: tx.receiptNumber,
      timestamp: tx.timestamp,
      isPayment: effect.isPayment,
      amount: effect.amount,
      debtDelta: effect.debtDelta,
      balanceAfter: runningBalance,
      notes: tx.notes || defaultDesc,
      paymentMethod: tx.paymentMethod || 'كاش',
    };
  });

  const endingBalance = customer.currentDebt !== undefined ? customer.currentDebt : runningBalance;

  const handlePrint = async () => {
    await smartPrintElementById('printable-statement-receipt', {
      docType: 'invoice',
      printSettings: settings?.printSettings,
      pageTitle: `كشف-حساب-${customer.name}`,
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
          font-size: ${receiptType === 'a4' ? '12px' : '10px'} !important;
          font-weight: 800 !important;
        }
        #printable-statement-receipt {
          padding: ${receiptType === 'a4' ? '12mm 15mm' : '2mm 3mm'} !important;
          margin: 0 auto !important;
          max-width: ${receiptType === 'a4' ? '100%' : '80mm'} !important;
          width: 100% !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          font-size: ${receiptType === 'a4' ? '12px' : '10px'} !important;
          font-weight: 800 !important;
          line-height: 1.35 !important;
        }
        table.statement-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 6px 0 !important;
          font-weight: 800 !important;
        }
        table.statement-table thead tr {
          background-color: #e5e7eb !important;
          border-top: 1.5px solid #000000 !important;
          border-bottom: 1.5px solid #000000 !important;
          font-weight: 900 !important;
        }
        table.statement-table th, table.statement-table td {
          padding: 4px 2px !important;
          color: #000000 !important;
          font-size: ${receiptType === 'a4' ? '11px' : '9px'} !important;
          font-weight: 800 !important;
          border-bottom: 1px dashed #d1d5db !important;
        }
      `,
    });
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
      <div
        className={`bg-stone-900 border border-stone-800 rounded-3xl w-full p-6 shadow-2xl relative text-stone-100 my-8 transition-all ${
          receiptType === 'a4' ? 'max-w-4xl' : 'max-w-xl'
        }`}
      >
        {/* Print Media Query Fallback */}
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
              font-size: ${receiptType === 'a4' ? '12px' : '10px'} !important;
              font-weight: 800 !important;
              font-family: 'Cairo', system-ui, sans-serif !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-statement-wrap, #printable-statement-wrap * {
              visibility: visible !important;
            }
            #printable-statement-wrap {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              display: block !important;
            }
            #printable-statement-receipt {
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
              font-size: ${receiptType === 'a4' ? '12px' : '10px'} !important;
              font-weight: 800 !important;
            }
            .no-print {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}</style>

        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4 no-print">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">كشف حساب العميل (آخر 3 أشهر)</h3>
              <p className="text-xs text-stone-400">طباعة ملخص وحركة الحساب الحرارية</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Toggle Receipt Format */}
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
                حراري (80mm)
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
                ورق كبير (A4)
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between mb-4 no-print bg-stone-950 p-3 rounded-2xl border border-stone-800">
          <span className="text-xs text-stone-300 font-bold">
            العميل: <span className="text-amber-400 font-extrabold">{customer.name}</span>
          </span>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center space-x-2 space-x-reverse"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة كشف الحساب</span>
          </button>
        </div>

        {/* Printable Content Container */}
        <div id="printable-statement-wrap" className="w-full flex justify-center bg-stone-950/40 p-2 sm:p-4 rounded-2xl border border-stone-850 overflow-x-auto">
          <div
            id="printable-statement-receipt"
            className={`bg-white text-black font-sans leading-tight shadow-2xl rounded-sm dir-rtl text-right ${
              receiptType === 'a4' ? 'w-full p-8' : 'w-[80mm] max-w-[80mm] p-2'
            }`}
            style={{
              color: '#000000',
              backgroundColor: '#ffffff',
              fontFamily: "'Cairo', system-ui, -apple-system, sans-serif",
            }}
          >
            {/* Header / Store Info */}
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <h2 className="text-base font-black tracking-tight text-black uppercase mb-0.5">
                {defaultPrintSettings.headerText}
              </h2>
              <p className="text-[10px] font-extrabold text-black leading-tight">
                {defaultPrintSettings.address}
              </p>
              <p className="text-[10px] font-black text-black font-mono">
                📞 {defaultPrintSettings.phoneNumbers}
              </p>
            </div>

            {/* Document Title Banner */}
            <div className="text-center bg-black text-white py-1 px-2 my-2 rounded-xs font-black text-xs">
              كشف حساب عميل (آخر 3 أشهر)
            </div>

            {/* Customer & Period Details */}
            <div className="text-[10px] font-extrabold space-y-1 border-b border-black pb-2 mb-2">
              <div className="flex justify-between">
                <span>اسم العميل:</span>
                <span className="font-black">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span>رقم الهاتف:</span>
                <span className="font-mono font-black">{customer.phone}</span>
              </div>
              {customer.address && (
                <div className="flex justify-between">
                  <span>العنوان:</span>
                  <span>{customer.address}</span>
                </div>
              )}
              {customer.monthlyInstallmentAmount && customer.monthlyInstallmentAmount > 0 ? (
                <div className="flex justify-between text-black">
                  <span>القسط الشهري:</span>
                  <span className="font-mono font-black">{formatPrice(customer.monthlyInstallmentAmount)} ج.م</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 border-t border-gray-300 text-[9px] text-gray-800">
                <span>تاريخ إصدار الكشف:</span>
                <span className="font-mono font-black">{formatDate(now.toISOString())}</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-800">
                <span>الفترة المغطاة:</span>
                <span className="font-mono font-black">{formatDate(threeMonthsAgo.toISOString())} إلى {formatDate(now.toISOString())}</span>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-gray-100 border border-black p-2 rounded-xs mb-2 text-[10px] font-extrabold space-y-1">
              <div className="flex justify-between">
                <span>مديونية سابقة (قبل 3 أشهر):</span>
                <span className="font-mono font-black">{formatPrice(openingBalance)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span>مبيعات الفواتير (آخر 3 أشهر):</span>
                <span className="font-mono font-black">{formatPrice(periodSalesTotal)} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>إجمالي المسدد (آخر 3 أشهر):</span>
                <span className="font-mono font-black">- {formatPrice(periodPaymentsTotal)} ج.م</span>
              </div>
              <div className="flex justify-between border-t border-black pt-1 font-black text-xs text-black">
                <span>إجمالي المديونية الحالية:</span>
                <span className="font-mono">{formatPrice(endingBalance)} ج.م</span>
              </div>
            </div>

            {/* Transactions Movement Table */}
            <div className="my-2">
              <div className="text-[10px] font-black text-center mb-1 bg-gray-200 py-0.5 border border-black">
                حركة الحساب والتسديدات التفصيلية
              </div>

              {statementEntries.length === 0 ? (
                <div className="text-center py-3 text-[10px] font-bold text-gray-600 border border-dashed border-gray-400">
                  لا توجد حركات أو فواتير مسجلة خلال آخر 3 أشهر.
                </div>
              ) : (
                <table className="statement-table w-full text-right">
                  <thead>
                    <tr className="bg-gray-200 border-y border-black text-[9px] font-black">
                      <th className="p-1 text-right">التاريخ</th>
                      <th className="p-1 text-right">البيان</th>
                      <th className="p-1 text-left">المبلغ</th>
                      <th className="p-1 text-left">المديونية المتبقية</th>
                    </tr>
                  </thead>
                  <tbody className="text-[9px] font-extrabold">
                    {statementEntries.map((entry, idx) => (
                      <tr key={entry.id || idx} className="border-b border-gray-300">
                        <td className="p-1 font-mono">{formatDate(entry.timestamp)}</td>
                        <td className="p-1">
                          <span className={entry.isPayment ? 'font-black text-emerald-800' : 'font-bold'}>
                            {entry.isPayment ? `سداد #${entry.receiptNumber}` : `فاتورة #${entry.receiptNumber}`}
                          </span>
                        </td>
                        <td className={`p-1 text-left font-mono font-black ${entry.isPayment ? 'text-emerald-800' : ''}`}>
                          {entry.isPayment ? `-` : `+`}{formatPrice(entry.amount)}
                        </td>
                        <td className="p-1 text-left font-mono font-black">
                          {formatPrice(entry.balanceAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Notice */}
            <div className="text-center border-t-2 border-black pt-2 mt-3 space-y-0.5">
              <p className="text-[10px] font-black">{defaultPrintSettings.footerText}</p>
              <p className="text-[8px] font-mono font-bold text-gray-700">{defaultPrintSettings.footerSubText}</p>
              <p className="text-[8px] text-gray-600 font-mono mt-1">تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
