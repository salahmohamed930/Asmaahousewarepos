import React from 'react';
import { Transaction, Associate, AppSettings, Customer } from '../../types';
import { QRCodeSVG } from 'qrcode.react';

export interface ReceiptContentProps {
  transaction: Transaction;
  receiptType?: 'thermal' | 'a4';
  elementId?: string;
  settings?: AppSettings;
  associates?: Associate[];
  customers?: Customer[];
}

export const formatReceiptPrice = (val: number | string | undefined): string => {
  if (val === undefined || val === null || val === '') return '0.0';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return String(val);
  return Number.isInteger(num) ? `${num}.0` : num.toFixed(1);
};

export const formatReceiptDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} - ${d.getMonth() + 1} - ${d.getFullYear()}`;
  } catch {
    return '';
  }
};

export const formatReceiptTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
};

export const getReceiptInvoiceTypeLabel = (tx: Transaction): string => {
  if (!tx) return 'كاش';

  const method = String(tx.paymentMethod || '').trim();
  if (method === 'installment' || method === 'تقسيط شهري' || method === 'تقسيط') {
    return 'تقسيط';
  }
  if (method === 'wholesale' || method === 'جملة' || method === 'آجل / حساب جملة') {
    return 'جملة';
  }

  const items = tx.items || [];
  if (items.length > 0) {
    const hasInstallment = items.some(
      (i) => i.priceTier === 'installment' || (i as any).selectedPriceTier === 'installment'
    );
    if (hasInstallment) return 'تقسيط';

    const hasWholesale = items.some(
      (i) => i.priceTier === 'wholesale' || (i as any).selectedPriceTier === 'wholesale'
    );
    if (hasWholesale) return 'جملة';
  }

  if (method === 'آجل' || method === 'credit') return 'جملة';
  if (method === 'فيزا / كارت') return 'كاش (فيزا)';
  if (method === 'محفظة إلكترونية') return 'كاش (محفظة)';
  if (method === 'دفع متعدد') return 'كاش (متعدد)';
  if (method === 'نقاط ولاء') return 'نقاط ولاء';

  return 'كاش';
};

export const ReceiptContent: React.FC<ReceiptContentProps> = ({
  transaction,
  receiptType = 'thermal',
  elementId = 'printable-receipt',
  settings,
  associates = [],
  customers = [],
}) => {
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

  const primaryAssoc = associates.find(
    (a) => a.id === transaction.primaryAssociateId || a.id === (transaction as any).associateId
  );
  const sellerName = primaryAssoc ? primaryAssoc.name : (transaction.primaryAssociateName || 'Admin');

  const itemsSubtotal = (transaction.items || []).reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);

  const itemsDiscountTotal = (transaction.items || []).reduce((sum, item) => {
    return sum + (item.discountAmount || 0);
  }, 0);

  const discountTotal =
    transaction.discountTotal !== undefined
      ? transaction.discountTotal
      : Math.max(0, itemsSubtotal - (transaction.grandTotal || 0));

  const totalBeforeDiscount =
    itemsSubtotal > 0
      ? itemsSubtotal
      : transaction.subtotal || (transaction.grandTotal || 0) + discountTotal;

  const grandTotal = transaction.grandTotal || totalBeforeDiscount - discountTotal;
  const totalAfterDiscount = grandTotal;
  const isReturn = transaction.status === 'مسترجعة' || (transaction.items || []).some((i) => i.quantity < 0);

  const customer = customers.find(
    (c) =>
      (transaction.customerId && c.id === transaction.customerId) ||
      (transaction.customerName && c.name.trim().toLowerCase() === transaction.customerName.trim().toLowerCase())
  );

  const remainingDebtAmount = customer
    ? customer.currentDebt || 0
    : transaction.amountDeferred ?? 0;

  return (
    <div
      id={elementId}
      className={`bg-white text-black rounded-2xl p-5 font-sans shadow-2xl mx-auto space-y-2.5 ${
        receiptType === 'a4'
          ? 'w-full max-w-3xl min-h-[600px] border-2 border-stone-300 text-[11.5px] font-extrabold'
          : 'max-w-md w-full border border-stone-200 text-[10px] font-extrabold'
      }`}
      style={{
        direction: 'rtl',
        textAlign: 'right',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Cairo', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 1. Header */}
      <div className="text-center space-y-0.5 pb-1 border-b border-transparent" style={{ textAlign: 'center' }}>
        <h1 className="text-base sm:text-lg font-black tracking-tight text-black leading-tight" style={{ fontWeight: 900, margin: '2px 0' }}>
          {defaultPrintSettings.headerText || 'أسماء للأدوات المنزليه'}
        </h1>
        {defaultPrintSettings.address && (
          <p className="text-[10px] text-black font-extrabold leading-tight" style={{ margin: '1px 0', fontSize: '10px', fontWeight: 800 }}>
            {defaultPrintSettings.address}
          </p>
        )}
        {defaultPrintSettings.phoneNumbers && (
          <p className="text-[10.5px] text-black font-mono font-black leading-tight" dir="ltr" style={{ margin: '1px 0', fontSize: '10.5px', fontWeight: 900 }}>
            {defaultPrintSettings.phoneNumbers}
          </p>
        )}
      </div>

      {/* 2. Metadata Section */}
      <div className="text-[10.5px] leading-relaxed space-y-1 font-black text-black text-right pt-1" style={{ fontSize: '10.5px', lineHeight: 1.4 }}>
        <div>
          <span className="font-extrabold">رقم الفاتوره : </span>
          <span className="font-mono font-black text-black">{transaction.receiptNumber}</span>
        </div>
        <div>
          <span className="font-extrabold">نوع الفاتوره : </span>
          <span className="font-black text-black">{getReceiptInvoiceTypeLabel(transaction)}</span>
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
          <span className="font-extrabold">اسم البائع / الكاشير : </span>
          <span className="font-black text-black">{sellerName}</span>
        </div>
        {primaryAssoc?.pin && defaultPrintSettings.showSellerCode !== false && (
          <div>
            <span className="font-extrabold">كود البائع : </span>
            <span className="font-mono font-black text-black">{primaryAssoc.pin}</span>
          </div>
        )}
        {(transaction.customerName || customer?.name) && (
          <div>
            <span className="font-extrabold">اسم العميل : </span>
            <span className="font-black text-black">{transaction.customerName || customer?.name}</span>
          </div>
        )}
      </div>

      {/* 3. Items Section */}
      <div className="w-full my-1" style={{ margin: '6px 0' }}>
        <table className="receipt-items-table w-full border-collapse text-[10px] text-black font-black" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
          <thead>
            <tr className="bg-stone-200/90 font-black border-y-2 border-black text-black" style={{ backgroundColor: '#d1d5db', borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000' }}>
              <th className="py-1 px-1 text-right w-[38%] font-black" style={{ padding: '3px 2px', textAlign: 'right' }}>الصنف</th>
              <th className="py-1 px-1 text-center w-[16%] font-black" style={{ padding: '3px 2px', textAlign: 'center' }}>السعر</th>
              <th className="py-1 px-1 text-center w-[14%] font-black" style={{ padding: '3px 2px', textAlign: 'center' }}>الكميه</th>
              <th className="py-1 px-1 text-center w-[14%] font-black" style={{ padding: '3px 2px', textAlign: 'center' }}>الخصم</th>
              <th className="py-1 px-1 text-left w-[18%] font-black" style={{ padding: '3px 2px', textAlign: 'left' }}>الاجمالي</th>
            </tr>
          </thead>
          <tbody className="font-black">
            {(transaction.items || []).map((item, idx) => {
              const itemDiscount =
                item.discountAmount !== undefined
                  ? item.discountAmount
                  : Math.max(0, item.unitPrice * item.quantity - item.totalPrice);

              return (
                <tr key={item.productId ? `rcp_item_${item.productId}_${idx}` : `rcp_item_${idx}`} className="leading-tight" style={{ borderBottom: '1px dotted #e5e7eb' }}>
                  <td className="py-1 px-1 text-right align-top font-black text-[10px] text-black" style={{ padding: '3px 2px', textAlign: 'right' }}>
                    {item.productName}
                  </td>
                  <td className="py-1 px-1 text-center align-top font-mono font-black text-[10px] text-black" style={{ padding: '3px 2px', textAlign: 'center' }}>
                    {formatReceiptPrice(item.unitPrice)}
                  </td>
                  <td className="py-1 px-1 text-center align-top font-mono font-black text-[10px] text-black" style={{ padding: '3px 2px', textAlign: 'center' }}>
                    {formatReceiptPrice(item.quantity)}
                  </td>
                  <td className="py-1 px-1 text-center align-top font-mono font-black text-[10px] text-black" style={{ padding: '3px 2px', textAlign: 'center' }}>
                    {itemDiscount > 0 ? formatReceiptPrice(itemDiscount) : '0'}
                  </td>
                  <td className="py-1 px-1 text-left align-top font-mono font-black text-[10px] text-black" style={{ padding: '3px 2px', textAlign: 'left' }}>
                    {formatReceiptPrice(item.totalPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Totals Summary */}
      <div className="pt-2 text-[11.5px] font-black text-black text-right space-y-1" style={{ paddingTop: '8px', fontSize: '11px', lineHeight: 1.4 }}>
        <div>
          <span className="font-extrabold">الإجمالي قبل الخصم : </span>
          <span className="font-mono font-black">{formatReceiptPrice(totalBeforeDiscount)}</span>
        </div>
        {transaction.invoiceDiscount && transaction.invoiceDiscount.value > 0 ? (
          <>
            {itemsDiscountTotal > 0 && (
              <div>
                <span className="font-extrabold">خصم الأصناف : </span>
                <span className="font-mono font-black">{formatReceiptPrice(itemsDiscountTotal)}</span>
              </div>
            )}
            <div>
              <span className="font-extrabold">
                خصم إجمالي الفاتورة ({transaction.invoiceDiscount.type === 'percentage' ? `${transaction.invoiceDiscount.value}%` : 'مبلغ مالي'}) :{' '}
              </span>
              <span className="font-mono font-black">
                {formatReceiptPrice(transaction.invoiceDiscount.amount ?? discountTotal - itemsDiscountTotal)}
              </span>
            </div>
            {itemsDiscountTotal > 0 && (
              <div>
                <span className="font-extrabold">إجمالي الخصم : </span>
                <span className="font-mono font-black">{formatReceiptPrice(discountTotal)}</span>
              </div>
            )}
          </>
        ) : (
          discountTotal > 0 && (
            <div>
              <span className="font-extrabold">الخصم : </span>
              <span className="font-mono font-black">{formatReceiptPrice(discountTotal)}</span>
            </div>
          )
        )}
        <div>
          <span className="font-extrabold">الإجمالي بعد الخصم : </span>
          <span className="font-mono font-black">{formatReceiptPrice(totalAfterDiscount)}</span>
        </div>
        <div>
          <span className="font-extrabold">المدفوع : </span>
          <span className="font-mono font-black">{formatReceiptPrice(transaction.amountPaid ?? totalAfterDiscount)}</span>
        </div>
        <div>
          <span className="font-extrabold">المديونية المتبقية : </span>
          <span className="font-mono font-black">{formatReceiptPrice(remainingDebtAmount)}</span>
        </div>
      </div>

      {/* 5. Footer */}
      <div className="pt-3 mt-2 flex items-end justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px' }}>
        {/* Facebook QR Code */}
        {defaultPrintSettings.showQRCode !== false && (
          <div className="flex flex-col items-start space-y-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="text-[10px] font-black text-black font-sans" style={{ fontSize: '10px', fontWeight: 900 }}>FaceBook</span>
            <div className="p-0.5 bg-white border border-black rounded" style={{ padding: '2px', border: '1px solid black', borderRadius: '4px', background: '#ffffff' }}>
              <QRCodeSVG
                value={defaultPrintSettings.facebookUrl || 'https://facebook.com'}
                size={68}
                level="M"
              />
            </div>
          </div>
        )}

        {/* Thank You Note */}
        <div className="text-center font-black text-black space-y-0.5 pb-1" style={{ textAlign: 'center', flex: 1 }}>
          <p className="text-[11.5px] font-black leading-tight" style={{ fontSize: '11px', fontWeight: 900, margin: '2px 0' }}>
            {defaultPrintSettings.footerText || 'شكرا و دائما فى خدمتكم'}
          </p>
          <p className="text-[10.5px] font-sans font-black leading-tight" dir="ltr" style={{ fontSize: '10px', fontWeight: 900, margin: '2px 0' }}>
            {defaultPrintSettings.footerSubText || 'visit us again'}
          </p>
        </div>
      </div>
    </div>
  );
};
