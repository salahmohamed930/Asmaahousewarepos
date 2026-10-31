import React, { useState } from 'react';
import { Transaction } from '../../types';
import { Printer, X, FileText } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { CustomerStatementReceiptModal } from '../Customers/CustomerStatementReceiptModal';
import { ReceiptContent } from './ReceiptContent';
import { printInvoiceReceipt } from '../../utils/receiptPrinter';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { associates, settings, customers } = usePOS();

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
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!transaction) return null;

  const isReturn = transaction.status === 'مسترجعة' || (transaction.items || []).some((i) => i.quantity < 0);

  const customer = customers.find(
    (c) =>
      (transaction.customerId && c.id === transaction.customerId) ||
      (transaction.customerName && c.name.trim().toLowerCase() === transaction.customerName.trim().toLowerCase())
  );

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printInvoiceReceipt(transaction, {
        settings,
        associates,
        customers,
        receiptType,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
      <div className={`bg-stone-900 border border-stone-800 rounded-3xl w-full p-6 shadow-2xl relative text-stone-100 my-8 transition-all ${
        receiptType === 'a4' ? 'max-w-4xl' : 'max-w-xl'
      }`}>
        
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
            {customer && (
              <button
                type="button"
                onClick={() => setShowStatementModal(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow"
                title="طباعة كشف حساب لآخر 3 أشهر للعميل"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>كشف حساب (3 أشهر)</span>
              </button>
            )}

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
          <ReceiptContent
            transaction={transaction}
            receiptType={receiptType}
            elementId="printable-receipt"
            settings={settings}
            associates={associates}
            customers={customers}
          />
        </div>

        {/* Modal Actions */}
        <div className="mt-5 flex items-center space-x-2 space-x-reverse no-print">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse transition-colors shadow-lg active:scale-98 disabled:opacity-50"
          >
            <Printer className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
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

      {/* Customer 3-Month Statement Modal */}
      {showStatementModal && customer && (
        <CustomerStatementReceiptModal
          customer={customer}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </div>
  );
};

export default ReceiptModal;
