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
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'large' | 'thermal_1.5x1' | 'thermal_1x1.5'>('thermal_1.5x1');

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

  const isThermal = labelSize.startsWith('thermal');
  const isThermal15 = labelSize === 'thermal_1.5x1';
  const isThermal10 = labelSize === 'thermal_1x1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Printable Area - Only this will be styled for print */}
      <style>{`
        @media print {
          @page {
            size: ${
              labelSize === 'thermal_1.5x1' ? '1.5in 1.0in' :
              labelSize === 'thermal_1x1.5' ? '1.0in 1.5in' :
              labelSize === 'compact' ? '40mm 25mm' :
              labelSize === 'large' ? '60mm 40mm' : '50mm 30mm'
            } !important;
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
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
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
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
                <option value="thermal_1.5x1">ملصق حراري 1.5 × 1 بوصة (38mm × 25mm عرضي)</option>
                <option value="thermal_1x1.5">ملصق حراري 1 × 1.5 بوصة (25mm × 38mm طولي)</option>
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
            <div 
              className="bg-white text-black rounded-xl p-3 shadow-2xl border-2 border-stone-300 flex flex-col justify-between text-center select-none space-y-1.5 transition-all duration-300 overflow-hidden"
              style={{
                width: 
                  labelSize === 'thermal_1.5x1' ? '240px' : 
                  labelSize === 'thermal_1x1.5' ? '160px' : 
                  labelSize === 'compact' ? '180px' : 
                  labelSize === 'large' ? '280px' : '220px',
                height: 
                  labelSize === 'thermal_1.5x1' ? '160px' : 
                  labelSize === 'thermal_1x1.5' ? '240px' : 
                  labelSize === 'compact' ? '112.5px' : 
                  labelSize === 'large' ? '186px' : '132px',
              }}
            >
              {/* Store Header */}
              {showStoreName && (
                <div className="border-b border-black/20 pb-0.5">
                  <h5 className={`font-black tracking-wide text-black uppercase ${
                    isThermal ? 'text-[8px]' : 'text-[10px]'
                  }`}>
                    {storeName}
                  </h5>
                </div>
              )}

              {/* Product Name */}
              <div>
                <h4 className={`font-black text-black leading-tight line-clamp-1 px-1 ${
                  isThermal ? 'text-[9px]' : 'text-xs'
                }`}>
                  {product.name}
                </h4>
              </div>

              {/* Barcode Lines */}
              <div className="my-0.5 py-0.5 bg-stone-50 rounded flex flex-col items-center justify-center">
                <div className={`flex items-center justify-center space-x-[1.5px] px-1 overflow-hidden ${
                  isThermal15 ? 'h-6 w-11/12' : isThermal10 ? 'h-7 w-5/6' : 'h-8'
                }`}>
                  {barcodePattern.map((b) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.width}px` }}
                      className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                    />
                  ))}
                </div>
                <span className={`font-mono font-extrabold tracking-wider text-black mt-0.5 ${
                  isThermal ? 'text-[8px]' : 'text-[10px]'
                }`}>
                  {product.barcode || product.sku}
                </span>
              </div>

              {/* Prices Section */}
              <div className={`border-t border-black/30 pt-1 grid grid-cols-2 gap-1 font-black dir-rtl ${
                isThermal ? 'text-[9px]' : 'text-[11px]'
              }`}>
                <div className="bg-stone-100 p-0.5 rounded border border-black/10">
                  <span className={`text-stone-600 block leading-none mb-0.5 ${
                    isThermal ? 'text-[6px]' : 'text-[8px]'
                  }`}>سعر الكاش</span>
                  <span className={`font-mono font-black text-black ${
                    isThermal ? 'text-[9px]' : 'text-xs'
                  }`}>
                    {(product.priceCash || 0).toLocaleString()} ج.م
                  </span>
                </div>

                <div className="bg-stone-100 p-0.5 rounded border border-black/10">
                  <span className={`text-stone-600 block leading-none mb-0.5 ${
                    isThermal ? 'text-[6px]' : 'text-[8px]'
                  }`}>سعر التقسيط</span>
                  <span className={`font-mono font-black text-black flex items-center justify-center space-x-1 space-x-reverse ${
                    isThermal ? 'text-[9px]' : 'text-xs'
                  }`}>
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
      <div id="printable-price-labels" className="hidden print:block p-0 m-0">
        <div className={labelSize.startsWith('thermal') ? "flex flex-col items-center p-0 m-0 w-full" : "grid grid-cols-2 sm:grid-cols-3 gap-2 p-2"}>
          {Array.from({ length: printCount }).map((_, idx) => (
            <div
              key={idx}
              className={`bg-white text-black flex flex-col justify-between text-center break-inside-avoid page-break-inside-avoid ${
                labelSize.startsWith('thermal') 
                  ? 'border-0 p-1.5' 
                  : 'border border-black p-2.5 rounded'
              }`}
              style={{
                width: 
                  labelSize === 'thermal_1.5x1' ? '1.5in' : 
                  labelSize === 'thermal_1x1.5' ? '1.0in' : 
                  labelSize === 'compact' ? '40mm' : 
                  labelSize === 'large' ? '60mm' : '50mm',
                height: 
                  labelSize === 'thermal_1.5x1' ? '1.0in' : 
                  labelSize === 'thermal_1x1.5' ? '1.5in' : 
                  labelSize === 'compact' ? '25mm' : 
                  labelSize === 'large' ? '40mm' : '30mm',
                pageBreakAfter: 'always',
                breakAfter: 'page',
                boxSizing: 'border-box'
              }}
            >
              {showStoreName && (
                <div className={`font-extrabold border-b border-black/30 pb-0.5 uppercase leading-none ${
                  labelSize === 'thermal_1.5x1' ? 'text-[7px]' : labelSize === 'thermal_1x1.5' ? 'text-[6px]' : 'text-[8px]'
                }`}>
                  {storeName}
                </div>
              )}

              <div className={`font-black line-clamp-1 leading-tight ${
                labelSize === 'thermal_1.5x1' ? 'text-[8px]' : labelSize === 'thermal_1x1.5' ? 'text-[7px]' : 'text-[10px]'
              }`}>
                {product.name}
              </div>

              {/* Barcode */}
              <div className="flex flex-col items-center justify-center my-0.5">
                <div className={`flex items-center justify-center space-x-[1px] px-1 overflow-hidden w-full ${
                  labelSize === 'thermal_1.5x1' ? 'h-4' : labelSize === 'thermal_1x1.5' ? 'h-5' : 'h-6'
                }`}>
                  {barcodePattern.map((b) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.width}px` }}
                      className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                    />
                  ))}
                </div>
                <div className={`font-mono font-bold leading-none mt-0.5 ${
                  labelSize === 'thermal_1.5x1' ? 'text-[6.5px]' : labelSize === 'thermal_1x1.5' ? 'text-[6px]' : 'text-[8px]'
                }`}>
                  {product.barcode || product.sku}
                </div>
              </div>

              {/* Prices: Cash & Installment with # */}
              <div className={`border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 font-extrabold leading-none ${
                labelSize.startsWith('thermal') ? 'text-[7px]' : 'text-[9px]'
              }`}>
                <div className="text-right">
                  <span className={`${labelSize.startsWith('thermal') ? 'text-[5.5px]' : 'text-[7px]'} block mb-0.5`}>كاش:</span>
                  <span className="font-mono">{product.priceCash} ج.م</span>
                </div>
                <div className="text-left">
                  <span className={`${labelSize.startsWith('thermal') ? 'text-[5.5px]' : 'text-[7px]'} block mb-0.5`}>تقسيط:</span>
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
