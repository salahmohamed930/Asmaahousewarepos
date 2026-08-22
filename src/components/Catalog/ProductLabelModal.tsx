import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { Printer, X, Tag, Info, Layers, RefreshCw, AlertTriangle, Check, Sliders } from 'lucide-react';
import { BarcodeItem } from '../Common/BarcodeItem';
import { printElementById } from '../../utils/printHelper';

interface ProductLabelModalProps {
  product?: Product | null;
  products?: Product[] | null;
  isOpen: boolean;
  onClose: () => void;
}

type PrintMode = 'thermal' | 'sheet';
type LabelSize =
  | 'thermal_1.5x1'
  | 'thermal_2x1'
  | 'thermal_50x30'
  | 'thermal_1x1.5'
  | 'sheet_a4_3col'
  | 'sheet_a4_2col';

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
  const [bulkUniformCount, setBulkUniformCount] = useState<number>(1);

  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [storeName, setStoreName] = useState<string>('أسماء للأدوات المنزلية');
  const [printMode, setPrintMode] = useState<PrintMode>('thermal');
  const [labelSize, setLabelSize] = useState<LabelSize>('thermal_1.5x1');

  // Initialize counts safely to 1 per product (preventing sudden massive warehouse stock prints!)
  useEffect(() => {
    if (isOpen && targetProducts.length > 0) {
      const initialCounts: Record<string, number> = {};
      targetProducts.forEach((p) => {
        // Safe default: 1 sticker per item (user can easily change or click 'حسب رصيد المخزن')
        initialCounts[p.id] = 1;
      });
      setProductCounts(initialCounts);
      setSelectedPreviewId(targetProducts[0].id);
      setBulkUniformCount(1);
    }
  }, [isOpen, targetProducts]);

  if (!isOpen || targetProducts.length === 0) return null;

  const totalPrintCount = targetProducts.reduce((sum, p) => sum + (productCounts[p.id] ?? 0), 0);
  const totalStockSum = targetProducts.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0);
  const previewProduct = targetProducts.find((p) => p.id === selectedPreviewId) || targetProducts[0];

  // Dimension helpers
  const getLabelConfig = () => {
    switch (labelSize) {
      case 'thermal_1.5x1':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '38mm 25mm',
          width: '38mm',
          height: '25mm',
          barcodeHeight: 18,
          barcodeWidth: 1.2,
          labelName: 'رول حراري 1.5 × 1 بوصة (38mm × 25mm)',
        };
      case 'thermal_2x1':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '50mm 25mm',
          width: '50mm',
          height: '25mm',
          barcodeHeight: 22,
          barcodeWidth: 1.3,
          labelName: 'رول حراري 2 × 1 بوصة (50mm × 25mm)',
        };
      case 'thermal_50x30':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '50mm 30mm',
          width: '50mm',
          height: '30mm',
          barcodeHeight: 26,
          barcodeWidth: 1.4,
          labelName: 'رول حراري 50mm × 30mm',
        };
      case 'thermal_1x1.5':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '25mm 38mm',
          width: '25mm',
          height: '38mm',
          barcodeHeight: 20,
          barcodeWidth: 1.1,
          labelName: 'رول حراري 1 × 1.5 بوصة (طولي)',
        };
      case 'sheet_a4_3col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '32mm',
          barcodeHeight: 24,
          barcodeWidth: 1.3,
          labelName: 'ورق A4 مقسم (3 أعمدة - 38mm × 25mm)',
        };
      case 'sheet_a4_2col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '42mm',
          barcodeHeight: 30,
          barcodeWidth: 1.5,
          labelName: 'ورق A4 مقسم (عمودين - كبير)',
        };
      default:
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '38mm 25mm',
          width: '38mm',
          height: '25mm',
          barcodeHeight: 18,
          barcodeWidth: 1.2,
          labelName: 'رول حراري قياسي',
        };
    }
  };

  const config = getLabelConfig();
  const isThermal = config.mode === 'thermal';

  const handlePrint = () => {
    if (totalPrintCount <= 0) return;

    if (totalPrintCount > 100) {
      const confirmPrint = window.confirm(
        `تنبيه: أنت على وشك طباعة عدد كبير (${totalPrintCount} ملصق). هل أنت متأكد من الاستمرار؟`
      );
      if (!confirmPrint) return;
    }

    printElementById('printable-price-labels', {
      pageTitle: `ملصقات-باركود-${previewProduct.name}`,
      pageCssSize: config.pageCssSize,
      customStyles: `
        @page {
          size: ${config.pageCssSize} !important;
          margin: 0 !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .label-sticker-thermal {
          width: ${config.width} !important;
          height: ${config.height} !important;
          max-height: ${config.height} !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          padding: 1.5mm 2mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          text-align: center !important;
        }
        .label-sticker-thermal:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
      `,
    });
  };

  const resetAllToStock = () => {
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = Math.max(0, p.stock || 0);
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

  const setAllToTwo = () => {
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = 2;
    });
    setProductCounts(updated);
  };

  const setAllToZero = () => {
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = 0;
    });
    setProductCounts(updated);
  };

  const applyUniformCount = () => {
    const val = Math.max(0, bulkUniformCount);
    const updated: Record<string, number> = {};
    targetProducts.forEach((p) => {
      updated[p.id] = val;
    });
    setProductCounts(updated);
  };

  const updateProductCount = (id: string, count: number) => {
    setProductCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, count),
    }));
  };

  // Build full list of print items for hidden print area
  const allPrintItems = targetProducts.flatMap((p) => {
    const count = productCounts[p.id] ?? 0;
    return Array.from({ length: count }, (_, i) => ({
      product: p,
      key: `${p.id}-${i}`,
    }));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto dir-rtl">
      {/* Dynamic CSS for Page setup in Print dialog fallback */}
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
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
            visibility: hidden !important;
          }
        }
      `}</style>

      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 no-print text-stone-100">
        {/* Modal Header */}
        <div className="p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">
                {isBulk ? 'طباعة ملصقات الباركود والأسعار (مجموعة)' : 'طباعة ملصق السعر والباركود'}
              </h3>
              <p className="text-xs text-stone-400">
                {isBulk
                  ? `الأصناف المحددة: ${targetProducts.length} صنف — إجمالي الملصقات: ${totalPrintCount} ملصق`
                  : `إعداد طباعة ملصق الصنف: ${previewProduct.name}`}
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
                <span className="block text-sm font-extrabold">طابعة رول حراري (Thermal)</span>
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
                <span className="block text-sm font-extrabold">ورق A4 / طابعة عادية (Sheet)</span>
                <span className="text-[10px] text-stone-400">طباعة شبكة ملصقات متجاورة على ورق A4</span>
              </div>
              <Tag className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Quick Count Control Panel (Prevents Accidental Giant Prints) */}
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="font-extrabold text-stone-200 text-xs flex items-center space-x-1.5 space-x-reverse">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>تحديد كمية الطباعة المطلوبة:</span>
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg text-xs font-black font-mono">
                  {totalPrintCount} ملصق
                </span>
              </div>

              {/* Fast Quick Action Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={setAllToOne}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-[11px] font-bold transition-all"
                  title="طباعة ملصق 1 فقط لكل صنف (الافتراضي الآمن)"
                >
                  1 لكل صنف
                </button>
                <button
                  type="button"
                  onClick={setAllToTwo}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-[11px] font-bold transition-all"
                >
                  2 لكل صنف
                </button>
                <button
                  type="button"
                  onClick={resetAllToStock}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 space-x-reverse"
                  title="ضبط عدد الملصقات مساوياً لرصيد المخزن المتاح"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>بعدد الرصيد ({totalStockSum})</span>
                </button>
                <button
                  type="button"
                  onClick={setAllToZero}
                  className="px-2 py-1 bg-stone-900 hover:bg-stone-850 text-stone-400 border border-stone-800 rounded-lg text-[10px] font-bold transition-all"
                >
                  تصفير
                </button>
              </div>
            </div>

            {/* If Single Product: Clear Quantity Stepper */}
            {!isBulk ? (
              <div className="flex items-center justify-between bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                <div>
                  <span className="text-xs font-bold text-stone-200 block">عدد النسخ المطلوبة لهذا الصنف:</span>
                  <span className="text-[10px] text-stone-400">
                    رصيد المخزن الحالي: {previewProduct.stock} قطعة
                  </span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    type="button"
                    onClick={() =>
                      updateProductCount(
                        previewProduct.id,
                        Math.max(1, (productCounts[previewProduct.id] ?? 1) - 1)
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={productCounts[previewProduct.id] ?? 1}
                    onChange={(e) =>
                      updateProductCount(previewProduct.id, parseInt(e.target.value) || 1)
                    }
                    className="w-16 bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-center font-mono font-black text-sm text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateProductCount(
                        previewProduct.id,
                        (productCounts[previewProduct.id] ?? 1) + 1
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              /* Bulk Mode: List with Individual Adjusters */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-stone-400 px-1">
                  <span>قائمة الأصناف وعدد ملصقات كل صنف:</span>
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <span>تطبيق كمية موحدة:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={bulkUniformCount}
                      onChange={(e) => setBulkUniformCount(parseInt(e.target.value) || 1)}
                      className="w-12 bg-stone-900 border border-stone-700 rounded px-1.5 py-0.5 text-center text-amber-300 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={applyUniformCount}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {targetProducts.map((p) => {
                    const isSelectedForPreview = p.id === previewProduct.id;
                    const count = productCounts[p.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPreviewId(p.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelectedForPreview
                            ? 'bg-amber-950/40 border-amber-500/60 text-stone-100'
                            : 'bg-stone-900/80 border-stone-800/80 text-stone-300 hover:bg-stone-850'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 space-x-reverse min-w-0 flex-1">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-7 h-7 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs truncate text-stone-100">{p.name}</h4>
                            <p className="text-[10px] text-stone-400 font-mono flex items-center space-x-2 space-x-reverse">
                              <span>كود: {p.sku || p.barcode}</span>
                              <span className="text-stone-500">| رصيد: {p.stock}</span>
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center space-x-1.5 space-x-reverse shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-stone-400">العدد:</span>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={count}
                            onChange={(e) =>
                              updateProductCount(p.id, parseInt(e.target.value) || 0)
                            }
                            className="w-14 bg-stone-950 border border-stone-700 rounded-lg px-1.5 py-1 text-center font-mono font-black text-xs text-amber-400 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* High Quantity Warning Badge */}
            {totalPrintCount > 50 && (
              <div className="p-2.5 bg-amber-950/50 border border-amber-700/60 rounded-xl flex items-center space-x-2 space-x-reverse text-amber-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  تنبيه: سيتم إرسال <strong className="text-amber-300 font-black font-mono">{totalPrintCount} ملصق</strong> إلى الطابعة. يرجى التأكد من توفر بكرة ملصقات كافية.
                </span>
              </div>
            )}
          </div>

          {/* Controls Bar: Size & Store Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-950 border border-stone-800 p-4 rounded-2xl text-xs">
            {/* Label Size Dropdown */}
            <div>
              <label className="block text-stone-300 font-bold mb-1.5">مقاس الملصق والورق</label>
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
                    <option value="thermal_1.5x1">رول حراري 1.5 × 1 بوصة (38mm × 25mm) - الشائع</option>
                    <option value="thermal_2x1">رول حراري 2 × 1 بوصة (50mm × 25mm)</option>
                    <option value="thermal_50x30">رول حراري 50mm × 30mm</option>
                    <option value="thermal_1x1.5">رول حراري 1 × 1.5 بوصة (طولي 25×38mm)</option>
                  </>
                ) : (
                  <>
                    <option value="sheet_a4_3col">ورق A4 مقسم (3 أعمدة - 38mm × 25mm)</option>
                    <option value="sheet_a4_2col">ورق A4 مقسم (عمودين - 50mm × 30mm)</option>
                  </>
                )}
              </select>
            </div>

            {/* Header Text */}
            <div>
              <label className="block text-stone-300 font-bold mb-1.5">اسم المتجر بالملصق</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="أسماء للأدوات المنزلية"
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quick Helper Notice */}
          <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-xs text-amber-200">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px]">
              <p className="font-bold text-amber-300">إرشادات الطباعة الدقيقة:</p>
              <p className="text-stone-300">
                في نافذة إعدادات طباعة المتصفح (Chrome / Edge): تأكد من ضبط الهوامش (Margins) على{' '}
                <strong className="text-amber-400 underline">بدون / None</strong> لطباعة كل ملصق في ملصقه بدقة 100%.
              </p>
            </div>
          </div>

          {/* Label Live Vector Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300 flex items-center space-x-1.5 space-x-reverse">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>
                  معاينة حية للملصق: <strong className="text-amber-300">{previewProduct.name}</strong>
                </span>
              </span>
              <span className="text-[11px] text-stone-400">
                سيتم إنتاج <strong className="text-amber-400 font-mono">{totalPrintCount}</strong> ملصق
              </span>
            </div>

            {/* Sticker Preview Box */}
            <div className="bg-stone-950 p-6 rounded-3xl border border-stone-800 flex justify-center">
              <div
                className="bg-white text-black rounded-xl p-2 shadow-2xl border-2 border-stone-300 flex flex-col justify-between text-center select-none space-y-1 transition-all overflow-hidden box-border"
                style={{
                  width:
                    labelSize === 'thermal_1.5x1' || labelSize === 'sheet_a4_3col'
                      ? '220px'
                      : labelSize === 'thermal_2x1' || labelSize === 'sheet_a4_2col'
                      ? '260px'
                      : labelSize === 'thermal_50x30'
                      ? '240px'
                      : '180px',
                  height:
                    labelSize === 'thermal_1.5x1' || labelSize === 'sheet_a4_3col'
                      ? '140px'
                      : labelSize === 'thermal_2x1'
                      ? '140px'
                      : labelSize === 'thermal_50x30' || labelSize === 'sheet_a4_2col'
                      ? '160px'
                      : '220px',
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
                  <h4 className="font-black text-black leading-tight line-clamp-1 px-1 text-[11px]">
                    {previewProduct.name}
                  </h4>
                </div>

                {/* Real Vector SVG Barcode */}
                <div className="my-0.5 py-0.5 flex flex-col items-center justify-center">
                  <BarcodeItem
                    value={previewProduct.barcode || previewProduct.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={8}
                    displayValue={true}
                  />
                </div>

                {/* Prices: Cash & Installment */}
                <div className="border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 font-black text-[9px] dir-rtl">
                  <div className="bg-stone-100 p-0.5 rounded border border-black/10 text-right">
                    <span className="text-stone-600 block leading-none text-[6.5px]">كاش:</span>
                    <span className="font-mono font-black text-black text-[10px]">
                      {(previewProduct.priceCash || 0).toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="bg-stone-100 p-0.5 rounded border border-black/10 text-left">
                    <span className="text-stone-600 block leading-none text-[6.5px]">تقسيط:</span>
                    <span className="font-mono font-black text-black text-[10px]">
                      {(previewProduct.priceInstallment || 0).toLocaleString()} ج.م #
                    </span>
                  </div>
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
                ? `طباعة ${totalPrintCount} ملصق (${targetProducts.length} صنف)`
                : `طباعة ${totalPrintCount} ملصق الآن`}
            </span>
          </button>
        </div>
      </div>

      {/* PRINTABLE OUTPUT CONTAINER (Cloned by print helper or captured by @media print) */}
      <div id="printable-price-labels" className="hidden print:block p-0 m-0 w-full bg-white text-black">
        {isThermal ? (
          /* Thermal Roll Printing Mode: 1 discrete sticker per page */
          <div className="p-0 m-0 w-full flex flex-col items-center">
            {allPrintItems.map((item, idx) => (
              <div
                key={item.key}
                className="label-sticker-thermal bg-white text-black flex flex-col justify-between text-center overflow-hidden box-border"
                style={{
                  width: config.width,
                  height: config.height,
                  maxHeight: config.height,
                  padding: '1mm 1.5mm',
                  boxSizing: 'border-box',
                  pageBreakAfter: idx < allPrintItems.length - 1 ? 'always' : 'avoid',
                  breakAfter: idx < allPrintItems.length - 1 ? 'page' : 'avoid',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {showStoreName && (
                  <div className="font-extrabold border-b border-black/40 pb-0.5 uppercase leading-none text-[6.5px]">
                    {storeName}
                  </div>
                )}

                <div className="font-black line-clamp-1 leading-tight text-[7.5px] px-0.5">
                  {item.product.name}
                </div>

                {/* Real SVG Barcode in Print */}
                <div className="my-0.2 flex flex-col items-center justify-center">
                  <BarcodeItem
                    value={item.product.barcode || item.product.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={6.5}
                    displayValue={true}
                  />
                </div>

                {/* Prices */}
                <div className="border-t border-black/40 pt-0.5 grid grid-cols-2 gap-1 font-extrabold leading-none text-[6.5px]">
                  <div className="text-right">
                    <span className="text-[5px] block">كاش:</span>
                    <span className="font-mono font-black">{item.product.priceCash} ج.م</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[5px] block">تقسيط:</span>
                    <span className="font-mono font-black">{item.product.priceInstallment} ج.م #</span>
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
            } p-3 w-full bg-white text-black`}
          >
            {allPrintItems.map((item) => (
              <div
                key={item.key}
                className="bg-white text-black border border-black/80 p-2 rounded flex flex-col justify-between text-center overflow-hidden box-border"
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
                <div className="my-0.5 flex flex-col items-center justify-center">
                  <BarcodeItem
                    value={item.product.barcode || item.product.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={7.5}
                    displayValue={true}
                  />
                </div>

                {/* Prices */}
                <div className="border-t border-black/30 pt-0.5 grid grid-cols-2 gap-1 font-extrabold leading-none text-[9px]">
                  <div className="text-right">
                    <span className="text-[7px] block">كاش:</span>
                    <span className="font-mono font-black">{item.product.priceCash} ج.م</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[7px] block">تقسيط:</span>
                    <span className="font-mono font-black">{item.product.priceInstallment} ج.م #</span>
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

export default ProductLabelModal;
