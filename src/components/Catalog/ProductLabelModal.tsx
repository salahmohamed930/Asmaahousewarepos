import React, { useState } from 'react';
import { Product } from '../../types';
import { Printer, X, Tag, Check, Copy, Sliders } from 'lucide-react';

interface ProductLabelModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const [printCount, setPrintCount] = useState<number>(1);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [storeName, setStoreName] = useState<string>('أسماء للأدوات المنزلية');
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'large'>('standard');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Generate SVG barcode lines deterministically from string barcode
  const generateBarcodeLines = (str: string) => {
    const chars = str.split('');
    return chars.map((char, index) => {
      const code = char.charCodeAt(0);
      const width = (code % 3) + 1; // 1px, 2px, or 3px
      const isSpace = (code + index) % 7 === 0;
      return { width, isSpace, key: index };
    });
  };

  const barcodePattern = generateBarcodeLines(product.barcode || product.sku || '000000');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Printable Area - Only this will be styled for print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-price-labels, #printable-price-labels * {
            visibility: visible !important;
          }
          #printable-price-labels {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 no-print">
        {/* Modal Header */}
        <div className="p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">
                طباعة ملصق السعر والباركود
              </h3>
              <p className="text-xs text-stone-400">
                إعداد طباعة الملصق للصنف: <span className="text-amber-400 font-bold">{product.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-950 border border-stone-800 p-4 rounded-2xl text-xs">
            {/* Print Count */}
            <div>
              <label className="block text-stone-400 font-bold mb-1.5">عدد الملصقات للطباعة</label>
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={printCount}
                  onChange={(e) => setPrintCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Label Size */}
            <div>
              <label className="block text-stone-400 font-bold mb-1.5">حجم الملصق</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="standard">قياسي (50mm × 30mm)</option>
                <option value="compact">مدمج (40mm × 25mm)</option>
                <option value="large">كبير (60mm × 40mm)</option>
              </select>
            </div>

            {/* Header Text */}
            <div>
              <label className="block text-stone-400 font-bold mb-1.5">اسم المحل بالملصق</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Label Preview Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300 flex items-center space-x-1.5 space-x-reverse">
              <Tag className="w-4 h-4 text-amber-400" />
              <span>معاينة الملصق (مطابق للمواصفات):</span>
            </span>
            <span className="text-[11px] text-stone-500">
              يحتوي على (اسم الصنف - باركود - سعر الكاش - سعر التقسيط #)
            </span>
          </div>

          {/* Sticker Preview Box */}
          <div className="bg-stone-950 p-6 rounded-3xl border border-stone-800 flex justify-center">
            <div className="bg-white text-black rounded-xl p-3 shadow-2xl border-2 border-stone-300 w-64 min-h-[140px] flex flex-col justify-between text-center select-none space-y-2">
              {/* Store Header */}
              {showStoreName && (
                <div className="border-b border-black/20 pb-1">
                  <h5 className="text-[10px] font-black tracking-wide text-black uppercase">
                    {storeName}
                  </h5>
                </div>
              )}

              {/* Product Name */}
              <div>
                <h4 className="text-xs font-black text-black leading-tight line-clamp-2 px-1">
                  {product.name}
                </h4>
              </div>

              {/* Barcode Lines */}
              <div className="my-1 py-1 bg-stone-50 rounded flex flex-col items-center justify-center">
                <div className="h-8 flex items-center justify-center space-x-[2px] px-2 overflow-hidden">
                  {barcodePattern.map((b) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.width}px` }}
                      className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] font-extrabold tracking-widest text-black mt-0.5">
                  {product.barcode || product.sku}
                </span>
              </div>

              {/* Prices Section */}
              <div className="border-t border-black/30 pt-1.5 grid grid-cols-2 gap-1 text-[11px] font-black dir-rtl">
                <div className="bg-stone-100 p-1 rounded border border-black/10">
                  <span className="text-[8px] text-stone-600 block leading-none mb-0.5">سعر الكاش</span>
                  <span className="font-mono text-xs font-black text-black">
                    {(product.priceCash || 0).toLocaleString()} ج.م
                  </span>
                </div>

                <div className="bg-stone-100 p-1 rounded border border-black/10">
                  <span className="text-[8px] text-stone-600 block leading-none mb-0.5">سعر التقسيط</span>
                  <span className="font-mono text-xs font-black text-black flex items-center justify-center space-x-1 space-x-reverse">
                    <span>{(product.priceInstallment || 0).toLocaleString()} ج.م</span>
                    <span className="text-amber-700 font-bold text-xs">#</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-stone-950 border-t border-stone-800 flex items-center justify-between no-print">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-all"
          >
            إلغاء
          </button>

          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-amber-950 flex items-center space-x-2 space-x-reverse transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة {printCount} ملصق الآن</span>
          </button>
        </div>
      </div>

      {/* Secret Printable Output Element (Hidden on Screen, Visible on Print) */}
      <div id="printable-price-labels" className="hidden print:block p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
          {Array.from({ length: printCount }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white text-black border border-black p-2.5 rounded flex flex-col justify-between text-center space-y-1 w-[50mm] h-[30mm] break-inside-avoid page-break-inside-avoid"
              style={{ width: labelSize === 'compact' ? '40mm' : labelSize === 'large' ? '60mm' : '50mm', height: labelSize === 'compact' ? '25mm' : labelSize === 'large' ? '40mm' : '30mm' }}
            >
              {showStoreName && (
                <div className="text-[8px] font-extrabold border-b border-black/30 pb-0.5 uppercase">
                  {storeName}
                </div>
              )}

              <div className="text-[10px] font-black line-clamp-1 leading-tight">
                {product.name}
              </div>

              {/* Barcode */}
              <div className="flex flex-col items-center justify-center my-0.5">
                <div className="h-6 flex items-center justify-center space-x-[1px] px-1 overflow-hidden w-full">
                  {barcodePattern.map((b) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.width}px` }}
                      className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                    />
                  ))}
                </div>
                <div className="font-mono text-[8px] font-bold">
                  {product.barcode || product.sku}
                </div>
              </div>

              {/* Prices: Cash & Installment with # */}
              <div className="border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 text-[9px] font-extrabold">
                <div className="text-right">
                  <span className="text-[7px] block">كاش:</span>
                  <span className="font-mono">{product.priceCash} ج.م</span>
                </div>
                <div className="text-left">
                  <span className="text-[7px] block">تقسيط:</span>
                  <span className="font-mono">{product.priceInstallment} ج.م #</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
