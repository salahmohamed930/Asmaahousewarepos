import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { Printer, X, Tag, Info, Layers, RefreshCw } from 'lucide-react';

interface ProductLabelModalProps {
  product?: Product | null;
  products?: Product[] | null;
  isOpen: boolean;
  onClose: () => void;
}

type PrintMode = 'thermal' | 'sheet';
type LabelSize = 'thermal_1.5x1' | 'thermal_2x1' | 'thermal_50x30' | 'thermal_1x1.5' | 'sheet_a4_3col' | 'sheet_a4_2col';

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({
  product,
  products,
  isOpen,
  onClose,
}) => {
  const isBulk = !!(products && products.length > 0);

  const targetProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    if (product) return [product];
    return [];
  }, [product, products]);

  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>('');

  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [storeName, setStoreName] = useState<string>('أسماء للأدوات المنزلية');
  const [printMode, setPrintMode] = useState<PrintMode>('thermal');
  const [labelSize, setLabelSize] = useState<LabelSize>('thermal_1.5x1');

  useEffect(() => {
    if (isOpen && targetProducts.length > 0) {
      const initialCounts: Record<string, number> = {};
      targetProducts.forEach((p) => {
        // Default count in bulk mode is the product's stock balance!
        initialCounts[p.id] = isBulk ? Math.max(0, p.stock) : 1;
      });
      setProductCounts(initialCounts);
      setSelectedPreviewId(targetProducts[0].id);
    }
  }, [isOpen, targetProducts, isBulk]);

  if (!isOpen || targetProducts.length === 0) return null;

  const totalPrintCount = targetProducts.reduce((sum, p) => sum + (productCounts[p.id] ?? 0), 0);
  const previewProduct = targetProducts.find((p) => p.id === selectedPreviewId) || targetProducts[0];

  const handlePrint = () => {
    if (totalPrintCount <= 0) return;
    window.print();
  };

  const resetAllToStock = () => {
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = Math.max(0, p.stock);
    });
    setProductCounts(updated);
  };

  const setAllToOne = () => {
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = 1;
    });
    setProductCounts(updated);
  };

  const updateProductCount = (id: string, count: number) => {
    setProductCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, count),
    }));
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

  const barcodePattern = generateBarcodeLines(previewProduct?.barcode || previewProduct?.sku || '000000');

  // Build full list of print items for hidden print area
  const allPrintItems = targetProducts.flatMap((p) => {
    const count = productCounts[p.id] ?? 0;
    const pattern = generateBarcodeLines(p.barcode || p.sku || '000000');
    return Array.from({ length: count }, (_, i) => ({
      product: p,
      barcodePattern: pattern,
      key: `${p.id}-${i}`,
    }));
  });

  // Dimension helpers
  const getLabelConfig = () => {
    switch (labelSize) {
      case 'thermal_1.5x1':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '1.5in 1.0in',
          width: '1.5in',
          height: '1.0in',
          labelName: 'رول حراري 1.5 × 1 بوصة (38mm × 25mm)',
        };
      case 'thermal_2x1':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '2.0in 1.0in',
          width: '2.0in',
          height: '1.0in',
          labelName: 'رول حراري 2 × 1 بوصة (50mm × 25mm)',
        };
      case 'thermal_50x30':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '50mm 30mm',
          width: '50mm',
          height: '30mm',
          labelName: 'رول حراري 50mm × 30mm',
        };
      case 'thermal_1x1.5':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '1.0in 1.5in',
          width: '1.0in',
          height: '1.5in',
          labelName: 'رول حراري 1 × 1.5 بوصة (طولي)',
        };
      case 'sheet_a4_3col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '32mm',
          labelName: 'ورق A4 مقسم (3 أعمدة - شبكة)',
        };
      case 'sheet_a4_2col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '42mm',
          labelName: 'ورق A4 مقسم (عمودين - كبير)',
        };
      default:
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '1.5in 1.0in',
          width: '1.5in',
          height: '1.0in',
          labelName: 'رول حراري قياسي',
        };
    }
  };

  const config = getLabelConfig();
  const isThermal = config.mode === 'thermal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Dynamic CSS for Page setup in Printing */}
      <style>{`
        @media print {
          @page {
            size: ${config.pageCssSize} !important;
            margin: 0 !important;
          }
          html, body {
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
                {isBulk ? 'طباعة ملصقات الأصناف المحددة للرصيد' : 'طباعة ملصق السعر والباركود'}
              </h3>
              <p className="text-xs text-stone-400">
                {isBulk
                  ? `تم تحديد ${targetProducts.length} صنف للطباعة (إجمالي ${totalPrintCount} ملصق)`
                  : `إعداد طباعة الملصق للصنف: ${previewProduct.name}`}
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
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Print Mode Selector Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-950 p-3 rounded-2xl border border-stone-800">
            <button
              type="button"
              onClick={() => {
                setPrintMode('thermal');
                if (!labelSize.startsWith('thermal')) setLabelSize('thermal_1.5x1');
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
                printMode === 'thermal'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850'
              }`}
            >
              <div>
                <span className="block text-sm font-extrabold">طابعة رول حراري (Thermal Printer)</span>
                <span className="text-[10px] text-stone-400">طابعة بكرات ملصقات (Xprinter / Zebra / Dymo)</span>
              </div>
              <Printer className="w-5 h-5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setPrintMode('sheet');
                if (!labelSize.startsWith('sheet')) setLabelSize('sheet_a4_3col');
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
                printMode === 'sheet'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850'
              }`}
            >
              <div>
                <span className="block text-sm font-extrabold">ورق A4 / طابعة عادية (Sticker Sheet)</span>
                <span className="text-[10px] text-stone-400">طباعة شبكة ملصقات متجاورة على ورق A4</span>
              </div>
              <Tag className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Bulk Products Count Configurator (when printing multiple products) */}
          {isBulk && (
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                <div>
                  <span className="font-extrabold text-stone-200 block text-xs flex items-center space-x-1.5 space-x-reverse">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>الأصناف المحددة ({targetProducts.length} صنف):</span>
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold">
                    تم ضبط عدد الملصقات تلقائياً ليكون مساوياً لرصيد المخزون المتاح لكل صنف
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                  <button
                    type="button"
                    onClick={resetAllToStock}
                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse"
                    title="إعادة ضبط عدد الملصقات لكل صنف مساوياً لرصيده الحالي في المخزن"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>مساواة للرصيد</span>
                  </button>
                  <button
                    type="button"
                    onClick={setAllToOne}
                    className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-lg text-[11px] font-bold transition-all"
                  >
                    1 لكل صنف
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {targetProducts.map((p) => {
                  const isSelectedForPreview = p.id === previewProduct.id;
                  const count = productCounts[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPreviewId(p.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelectedForPreview
                          ? 'bg-amber-950/40 border-amber-500/60 text-stone-100 shadow-sm'
                          : 'bg-stone-900 border-stone-800/80 text-stone-300 hover:bg-stone-850'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 space-x-reverse min-w-0 flex-1">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-8 h-8 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs truncate text-stone-100">{p.name}</h4>
                          <p className="text-[10px] text-stone-400 font-mono flex items-center space-x-2 space-x-reverse">
                            <span>كود: {p.sku}</span>
                            <span className="text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-900 px-1.5 py-0.2 rounded text-[9px]">
                              الرصيد: {p.stock} قطعة
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 space-x-reverse shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-stone-400 font-bold">الملصقات:</span>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={count}
                          onChange={(e) => updateProductCount(p.id, parseInt(e.target.value) || 0)}
                          className="w-16 bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-center font-mono font-black text-xs text-amber-400 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-950 border border-stone-800 p-4 rounded-2xl text-xs">
            
            {/* Print Count for single mode */}
            {!isBulk ? (
              <div>
                <label className="block text-stone-300 font-bold mb-1.5">
                  عدد الملصقات المطلوبة *
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={productCounts[targetProducts[0]?.id] ?? 1}
                  onChange={(e) => updateProductCount(targetProducts[0]?.id, parseInt(e.target.value) || 1)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono font-black text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-stone-300 font-bold mb-1.5">إجمالي الملصقات</label>
                <div className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-black text-sm text-center">
                  {totalPrintCount} ملصق
                </div>
              </div>
            )}

            {/* Label Size Dropdown */}
            <div>
              <label className="block text-stone-300 font-bold mb-1.5">حجم الملصق ورقم المقاس</label>
              <select
                value={labelSize}
                onChange={(e) => {
                  const val = e.target.value as LabelSize;
                  setLabelSize(val);
                  setPrintMode(val.startsWith('thermal') ? 'thermal' : 'sheet');
                }}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {printMode === 'thermal' ? (
                  <>
                    <option value="thermal_1.5x1">رول حراري 1.5 × 1 بوصة (38mm × 25mm)</option>
                    <option value="thermal_2x1">رول حراري 2 × 1 بوصة (50mm × 25mm)</option>
                    <option value="thermal_50x30">رول حراري 50mm × 30mm</option>
                    <option value="thermal_1x1.5">رول حراري 1 × 1.5 بوصة (طولي)</option>
                  </>
                ) : (
                  <>
                    <option value="sheet_a4_3col">ورق A4 شيت (3 أعمدة - 38mm × 25mm)</option>
                    <option value="sheet_a4_2col">ورق A4 شيت (عمودين - 50mm × 30mm)</option>
                  </>
                )}
              </select>
            </div>

            {/* Header Text */}
            <div>
              <label className="block text-stone-300 font-bold mb-1.5">اسم المحل بالملصق</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

          </div>

          {/* Quick Helper Notice */}
          <div className="bg-amber-950/30 border border-amber-800/50 p-3 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-xs text-amber-200">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">نصيحة لضمان طباعة دقيقة {totalPrintCount} ملصق بالضبط:</p>
              <p className="text-[11px] text-amber-300/80">
                في نافذة إعدادات طباعة المتصفح (Chrome/Edge): اضبط الهوامش (Margins) على <span className="font-extrabold underline">بدون / None</span>،
                {printMode === 'thermal' && ' واختر حجم الورق ليكون مطابقاً لحجم ملصقك (مثلاً 38mm × 25mm)'}.
              </p>
            </div>
          </div>

          {/* Label Preview Section Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300 flex items-center space-x-1.5 space-x-reverse">
              <Tag className="w-4 h-4 text-amber-400" />
              <span>معاينة ملصق: <strong className="text-amber-300">{previewProduct.name}</strong></span>
            </span>
            <span className="text-[11px] text-stone-400">
              سيتم إنتاج <span className="text-amber-400 font-black">{totalPrintCount}</span> ملصق {isThermal ? 'على رول الطباعة' : 'في شبكة الورق'}
            </span>
          </div>

          {/* Sticker Preview Container */}
          <div className="bg-stone-950 p-6 rounded-3xl border border-stone-800 flex justify-center">
            <div 
              className="bg-white text-black rounded-xl p-2.5 shadow-2xl border-2 border-stone-300 flex flex-col justify-between text-center select-none space-y-1 transition-all duration-300 overflow-hidden box-border"
              style={{
                width: 
                  labelSize === 'thermal_1.5x1' || labelSize === 'sheet_a4_3col' ? '240px' : 
                  labelSize === 'thermal_2x1' || labelSize === 'sheet_a4_2col' ? '280px' : 
                  labelSize === 'thermal_50x30' ? '260px' : '180px',
                height: 
                  labelSize === 'thermal_1.5x1' || labelSize === 'sheet_a4_3col' ? '150px' : 
                  labelSize === 'thermal_2x1' ? '150px' : 
                  labelSize === 'thermal_50x30' || labelSize === 'sheet_a4_2col' ? '170px' : '230px',
              }}
            >
              {/* Store Header */}
              {showStoreName && (
                <div className="border-b border-black/20 pb-0.5">
                  <h5 className="font-black tracking-wide text-black uppercase text-[9px] leading-none">
                    {storeName}
                  </h5>
                </div>
              )}

              {/* Product Name */}
              <div>
                <h4 className="font-black text-black leading-tight line-clamp-1 px-1 text-xs">
                  {previewProduct.name}
                </h4>
              </div>

              {/* Barcode Pattern */}
              <div className="my-0.5 py-0.5 bg-stone-50 rounded flex flex-col items-center justify-center">
                <div className="flex items-center justify-center space-x-[1.5px] px-1 overflow-hidden h-6 w-11/12">
                  {barcodePattern.map((b) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.width}px` }}
                      className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                    />
                  ))}
                </div>
                <span className="font-mono font-extrabold tracking-wider text-black mt-0.5 text-[9px]">
                  {previewProduct.barcode || previewProduct.sku}
                </span>
              </div>

              {/* Prices Section */}
              <div className="border-t border-black/30 pt-1 grid grid-cols-2 gap-1 font-black text-[10px] dir-rtl">
                <div className="bg-stone-100 p-0.5 rounded border border-black/10">
                  <span className="text-stone-600 block leading-none mb-0.5 text-[7px]">سعر الكاش</span>
                  <span className="font-mono font-black text-black text-xs">
                    {(previewProduct.priceCash || 0).toLocaleString()} ج.م
                  </span>
                </div>

                <div className="bg-stone-100 p-0.5 rounded border border-black/10">
                  <span className="text-stone-600 block leading-none mb-0.5 text-[7px]">سعر التقسيط</span>
                  <span className="font-mono font-black text-black flex items-center justify-center space-x-1 space-x-reverse text-xs">
                    <span>{(previewProduct.priceInstallment || 0).toLocaleString()} ج.م</span>
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
            disabled={totalPrintCount <= 0}
            className={`px-6 py-2.5 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center space-x-2 space-x-reverse transition-all active:scale-95 ${
              totalPrintCount > 0
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50 shadow-none'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>
              {isBulk
                ? `طباعة جميع الملصقات (${totalPrintCount} ملصق لـ ${targetProducts.length} صنف)`
                : `طباعة ${totalPrintCount} ملصق الآن`}
            </span>
          </button>
        </div>
      </div>

      {/* SECRET PRINTABLE OUTPUT ELEMENT (Visible strictly during Print) */}
      <div id="printable-price-labels" className="hidden print:block p-0 m-0 w-full">
        {isThermal ? (
          /* Thermal Roll Printing Mode: 1 sticker per page, strictly pageBreakAfter on items except last */
          <div className="flex flex-col items-center p-0 m-0 w-full">
            {allPrintItems.map((item, idx) => (
              <div
                key={item.key}
                className="bg-white text-black flex flex-col justify-between text-center overflow-hidden box-border"
                style={{
                  width: config.width,
                  height: config.height,
                  maxHeight: config.height,
                  padding: '2px 4px',
                  boxSizing: 'border-box',
                  pageBreakAfter: idx < allPrintItems.length - 1 ? 'always' : 'avoid',
                  breakAfter: idx < allPrintItems.length - 1 ? 'page' : 'avoid',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {showStoreName && (
                  <div className="font-extrabold border-b border-black/30 pb-0.5 uppercase leading-none text-[7px]">
                    {storeName}
                  </div>
                )}

                <div className="font-black line-clamp-1 leading-tight text-[8px]">
                  {item.product.name}
                </div>

                {/* Barcode */}
                <div className="flex flex-col items-center justify-center my-0.5">
                  <div className="flex items-center justify-center space-x-[1px] px-1 overflow-hidden w-full h-4">
                    {item.barcodePattern.map((b) => (
                      <div
                        key={b.key}
                        style={{ width: `${b.width}px` }}
                        className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                      />
                    ))}
                  </div>
                  <div className="font-mono font-bold leading-none mt-0.5 text-[6.5px]">
                    {item.product.barcode || item.product.sku}
                  </div>
                </div>

                {/* Prices: Cash & Installment with # */}
                <div className="border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 font-extrabold leading-none text-[7px]">
                  <div className="text-right">
                    <span className="text-[5.5px] block mb-0.5">كاش:</span>
                    <span className="font-mono">{item.product.priceCash} ج.م</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[5.5px] block mb-0.5">تقسيط:</span>
                    <span className="font-mono">{item.product.priceInstallment} ج.م #</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Sheet A4 Grid Mode: Multiple stickers per page in grid */
          <div
            className={`grid ${
              labelSize === 'sheet_a4_2col' ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-2'
            } p-2 w-full`}
          >
            {allPrintItems.map((item) => (
              <div
                key={item.key}
                className="bg-white text-black border border-black p-2 rounded flex flex-col justify-between text-center overflow-hidden box-border"
                style={{
                  height: config.height,
                  maxHeight: config.height,
                  boxSizing: 'border-box',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {showStoreName && (
                  <div className="font-extrabold border-b border-black/30 pb-0.5 uppercase leading-none text-[8px]">
                    {storeName}
                  </div>
                )}

                <div className="font-black line-clamp-1 leading-tight text-[10px]">
                  {item.product.name}
                </div>

                {/* Barcode */}
                <div className="flex flex-col items-center justify-center my-0.5">
                  <div className="flex items-center justify-center space-x-[1px] px-1 overflow-hidden w-full h-6">
                    {item.barcodePattern.map((b) => (
                      <div
                        key={b.key}
                        style={{ width: `${b.width}px` }}
                        className={`h-full ${b.isSpace ? 'bg-transparent' : 'bg-black'}`}
                      />
                    ))}
                  </div>
                  <div className="font-mono font-bold leading-none mt-0.5 text-[8px]">
                    {item.product.barcode || item.product.sku}
                  </div>
                </div>

                {/* Prices */}
                <div className="border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 font-extrabold leading-none text-[9px]">
                  <div className="text-right">
                    <span className="text-[7px] block mb-0.5">كاش:</span>
                    <span className="font-mono">{item.product.priceCash} ج.م</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[7px] block mb-0.5">تقسيط:</span>
                    <span className="font-mono">{item.product.priceInstallment} ج.م #</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
