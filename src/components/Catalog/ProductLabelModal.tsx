import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { Printer, X, Tag, Info, Layers, RefreshCw, AlertTriangle, Check, Sliders, Eye } from 'lucide-react';
import { BarcodeItem } from '../Common/BarcodeItem';
import { printElementById } from '../../utils/printHelper';
import { usePOS } from '../../context/POSContext';

interface ProductLabelModalProps {
  product?: Product | null;
  products?: Product[] | null;
  isOpen: boolean;
  onClose: () => void;
}

type PrintMode = 'thermal' | 'sheet';
type LabelPreset =
  | '1.5x1_horizontal' // 38mm x 25mm (1.5" x 1")
  | '1x1.5_vertical'   // 25mm x 38mm (1" x 1.5")
  | '40x25'            // 40mm x 25mm
  | '40x30'            // 40mm x 30mm
  | '2x1'              // 50mm x 25mm (2" x 1")
  | '50x30'            // 50mm x 30mm
  | 'sheet_a4_3col'    // A4 3 columns
  | 'sheet_a4_2col'    // A4 2 columns
  | 'custom';          // User defined mm

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({
  product,
  products,
  isOpen,
  onClose,
}) => {
  const { settings } = usePOS();
  const defaultHeader = settings?.printSettings?.headerText || 'أسماء للأدوات المنزليه';

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
  const [showInstallmentPrice, setShowInstallmentPrice] = useState<boolean>(true);
  const [showItemCode, setShowItemCode] = useState<boolean>(true);
  const [storeName, setStoreName] = useState<string>(defaultHeader);
  const [printMode, setPrintMode] = useState<PrintMode>('thermal');
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('1.5x1_horizontal');

  // Format price helper matching thermal barcode sticker standard (e.g., "520.0")
  const formatStickerPrice = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === '') return '0.0';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return String(val);
    return Number.isInteger(num) ? `${num}.0` : num.toFixed(1);
  };

  // Custom fine-tuning dimensions (in mm)
  const [customWidthMm, setCustomWidthMm] = useState<number>(38);
  const [customHeightMm, setCustomHeightMm] = useState<number>(25);
  const [barcodeHeightScale, setBarcodeHeightScale] = useState<number>(18);

  // Keep store name synced if settings load later
  useEffect(() => {
    if (settings?.printSettings?.headerText) {
      setStoreName(settings.printSettings.headerText);
    }
  }, [settings?.printSettings?.headerText]);

  // Initialize counts safely to 1 per product (preventing sudden massive warehouse stock prints)
  useEffect(() => {
    if (isOpen && targetProducts.length > 0) {
      const initialCounts: Record<string, number> = {};
      targetProducts.forEach((p) => {
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
    switch (labelPreset) {
      case '1.5x1_horizontal': // 38mm x 25mm (1.5" x 1")
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '38mm 25mm',
          width: '38mm',
          height: '25mm',
          widthMm: 38,
          heightMm: 25,
          barcodeHeight: 17,
          barcodeWidth: 1.4,
          fontSizeHeader: '8.5px',
          fontSizeTitle: '10px',
          fontSizePrice: '11px',
          fontSizeBarcode: 8.5,
          labelName: '1.5 × 1 بوصة (38mm × 25mm) - أفقي شائع',
        };
      case '1x1.5_vertical': // 25mm x 38mm (1" x 1.5")
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '25mm 38mm',
          width: '25mm',
          height: '38mm',
          widthMm: 25,
          heightMm: 38,
          barcodeHeight: 24,
          barcodeWidth: 1.25,
          fontSizeHeader: '8.5px',
          fontSizeTitle: '9.5px',
          fontSizePrice: '11px',
          fontSizeBarcode: 8.5,
          labelName: '1 × 1.5 بوصة (25mm × 38mm) - رأسي / طولي',
        };
      case '40x25':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '40mm 25mm',
          width: '40mm',
          height: '25mm',
          widthMm: 40,
          heightMm: 25,
          barcodeHeight: 18,
          barcodeWidth: 1.45,
          fontSizeHeader: '9px',
          fontSizeTitle: '10.5px',
          fontSizePrice: '11.5px',
          fontSizeBarcode: 9,
          labelName: 'رول حراري 40mm × 25mm',
        };
      case '40x30':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '40mm 30mm',
          width: '40mm',
          height: '30mm',
          widthMm: 40,
          heightMm: 30,
          barcodeHeight: 22,
          barcodeWidth: 1.5,
          fontSizeHeader: '9.5px',
          fontSizeTitle: '11px',
          fontSizePrice: '12px',
          fontSizeBarcode: 9.5,
          labelName: 'رول حراري 40mm × 30mm',
        };
      case '2x1': // 50mm x 25mm
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '50mm 25mm',
          width: '50mm',
          height: '25mm',
          widthMm: 50,
          heightMm: 25,
          barcodeHeight: 19,
          barcodeWidth: 1.65,
          fontSizeHeader: '9.5px',
          fontSizeTitle: '11px',
          fontSizePrice: '12.5px',
          fontSizeBarcode: 9.5,
          labelName: '2 × 1 بوصة (50mm × 25mm)',
        };
      case '50x30':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '50mm 30mm',
          width: '50mm',
          height: '30mm',
          widthMm: 50,
          heightMm: 30,
          barcodeHeight: 24,
          barcodeWidth: 1.7,
          fontSizeHeader: '10px',
          fontSizeTitle: '12px',
          fontSizePrice: '13px',
          fontSizeBarcode: 10,
          labelName: 'رول حراري 50mm × 30mm',
        };
      case 'custom':
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: `${customWidthMm}mm ${customHeightMm}mm`,
          width: `${customWidthMm}mm`,
          height: `${customHeightMm}mm`,
          widthMm: customWidthMm,
          heightMm: customHeightMm,
          barcodeHeight: Math.max(16, barcodeHeightScale),
          barcodeWidth: Math.max(1.2, (customWidthMm / 38) * 1.4),
          fontSizeHeader: customHeightMm < 26 ? '8.5px' : '9.5px',
          fontSizeTitle: customHeightMm < 26 ? '10px' : '11.5px',
          fontSizePrice: customHeightMm < 26 ? '11.5px' : '13px',
          fontSizeBarcode: customHeightMm < 26 ? 8.5 : 9.5,
          labelName: `مقاس مخصص (${customWidthMm}mm × ${customHeightMm}mm)`,
        };
      case 'sheet_a4_3col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '30mm',
          widthMm: 65,
          heightMm: 30,
          barcodeHeight: 22,
          barcodeWidth: 1.5,
          fontSizeHeader: '9.5px',
          fontSizeTitle: '12px',
          fontSizePrice: '13px',
          fontSizeBarcode: 9.5,
          labelName: 'ورق A4 مقسم (3 أعمدة - 65mm × 30mm)',
        };
      case 'sheet_a4_2col':
        return {
          mode: 'sheet' as PrintMode,
          pageCssSize: 'A4 portrait',
          width: '100%',
          height: '40mm',
          widthMm: 95,
          heightMm: 40,
          barcodeHeight: 28,
          barcodeWidth: 1.8,
          fontSizeHeader: '11px',
          fontSizeTitle: '13px',
          fontSizePrice: '14px',
          fontSizeBarcode: 10.5,
          labelName: 'ورق A4 مقسم (عمودين - 95mm × 40mm)',
        };
      default:
        return {
          mode: 'thermal' as PrintMode,
          pageCssSize: '38mm 25mm',
          width: '38mm',
          height: '25mm',
          widthMm: 38,
          heightMm: 25,
          barcodeHeight: 17,
          barcodeWidth: 1.4,
          fontSizeHeader: '8.5px',
          fontSizeTitle: '10px',
          fontSizePrice: '11px',
          fontSizeBarcode: 7.5,
          labelName: '1.5 × 1 بوصة (38mm × 25mm)',
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
        *, *::before, *::after {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          width: 100% !important;
        }
        .label-sticker-thermal {
          width: ${config.width} !important;
          max-width: ${config.width} !important;
          height: ${config.height} !important;
          max-height: ${config.height} !important;
          min-height: ${config.height} !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          padding: 0.6mm 1mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          align-items: center !important;
          text-align: center !important;
          background: #ffffff !important;
          color: #000000 !important;
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
                {isBulk ? 'طباعة ملصقات الباركود والأسعار (مجموعة)' : 'إعداد وطباعة ملصق السعر والباركود'}
              </h3>
              <p className="text-xs text-stone-400">
                {isBulk
                  ? `الأصناف المحددة: ${targetProducts.length} صنف — إجمالي الملصقات: ${totalPrintCount} ملصق`
                  : `الصنف: ${previewProduct.name} | مقاس: ${config.labelName}`}
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
                if (labelPreset.startsWith('sheet')) setLabelPreset('1.5x1_horizontal');
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
                printMode === 'thermal'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850'
              }`}
            >
              <div>
                <span className="block text-sm font-extrabold">طابعة رول حراري (Thermal Roll)</span>
                <span className="text-[10px] text-stone-400">بكرات الملصقات (1.5×1 بوصة / 38×25mm / Zebra / Xprinter)</span>
              </div>
              <Printer className="w-5 h-5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setPrintMode('sheet');
                if (!labelPreset.startsWith('sheet')) setLabelPreset('sheet_a4_3col');
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
                printMode === 'sheet'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850'
              }`}
            >
              <div>
                <span className="block text-sm font-extrabold">ورق A4 / طابعة عادية (A4 Sheet)</span>
                <span className="text-[10px] text-stone-400">شبكة ملصقات مقسمة على ورق ليزر أو حبر A4</span>
              </div>
              <Tag className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Quick Count Control Panel */}
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
                  {targetProducts.map((p, idx) => {
                    const isSelectedForPreview = p.id === previewProduct.id;
                    const count = productCounts[p.id] ?? 0;
                    return (
                      <div
                        key={p.id ? `lbl_p_${p.id}_${idx}` : `lbl_p_${idx}`}
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
                  تنبيه: سيتم إرسال <strong className="text-amber-300 font-black font-mono">{totalPrintCount} ملصق</strong> إلى الطابعة.
                </span>
              </div>
            )}
          </div>

          {/* Controls Bar: Size & Presets */}
          <div className="bg-stone-950 border border-stone-800 p-4 rounded-2xl space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Label Preset Selection */}
              <div>
                <label className="block text-stone-300 font-bold mb-1.5 flex items-center justify-between">
                  <span>مقاس الملصق والورق</span>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {config.widthMm}mm × {config.heightMm}mm
                  </span>
                </label>
                <select
                  value={labelPreset}
                  onChange={(e) => {
                    const val = e.target.value as LabelPreset;
                    setLabelPreset(val);
                    if (val.startsWith('sheet')) {
                      setPrintMode('sheet');
                    } else {
                      setPrintMode('thermal');
                    }
                  }}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {printMode === 'thermal' ? (
                    <>
                      <option value="1.5x1_horizontal">
                        🎯 1.5 × 1 بوصة (38mm × 25mm) - المقاس الأكثر شيوعاً
                      </option>
                      <option value="1x1.5_vertical">
                        📐 1 × 1.5 بوصة (25mm × 38mm) - مقاس طولي رأسي
                      </option>
                      <option value="40x25">40mm × 25mm (رول ملصقات 4 سم)</option>
                      <option value="40x30">40mm × 30mm</option>
                      <option value="2x1">2 × 1 بوصة (50mm × 25mm)</option>
                      <option value="50x30">50mm × 30mm</option>
                      <option value="custom">⚙️ تحديد مقاس مخصص يدويًا (بالمليمتر)...</option>
                    </>
                  ) : (
                    <>
                      <option value="sheet_a4_3col">ورق A4 مقسم (3 أعمدة - 65mm × 30mm)</option>
                      <option value="sheet_a4_2col">ورق A4 مقسم (عمودين - 95mm × 40mm)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Store Name Input */}
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

            {/* Custom Millimeter Adjuster (When 'custom' is selected or for fine-tuning) */}
            {labelPreset === 'custom' && (
              <div className="bg-stone-900/80 p-3 rounded-xl border border-amber-500/40 grid grid-cols-3 gap-2 animate-fade-in">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">العرض (Width mm):</label>
                  <input
                    type="number"
                    min={20}
                    max={120}
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(Math.max(15, parseInt(e.target.value) || 38))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">الارتفاع (Height mm):</label>
                  <input
                    type="number"
                    min={15}
                    max={150}
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(Math.max(15, parseInt(e.target.value) || 25))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">طول الباركود (px):</label>
                  <input
                    type="number"
                    min={8}
                    max={40}
                    value={barcodeHeightScale}
                    onChange={(e) => setBarcodeHeightScale(Math.max(8, parseInt(e.target.value) || 14))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-300"
                  />
                </div>
              </div>
            )}

            {/* Quick Display Toggles */}
            <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-stone-900">
              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer text-stone-300 select-none">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="rounded border-stone-700 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[11px]">إظهار اسم المتجر أعلى الملصق</span>
              </label>

              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer text-stone-300 select-none">
                <input
                  type="checkbox"
                  checked={showItemCode}
                  onChange={(e) => setShowItemCode(e.target.checked)}
                  className="rounded border-stone-700 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[11px]">إظهار كود الصنف تحت الباركود</span>
              </label>

              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer text-stone-300 select-none">
                <input
                  type="checkbox"
                  checked={showInstallmentPrice}
                  onChange={(e) => setShowInstallmentPrice(e.target.checked)}
                  className="rounded border-stone-700 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[11px]">إظهار سعر التقسيط بجانب الكاش</span>
              </label>
            </div>
          </div>

          {/* Quick Helper Notice */}
          <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-xs text-amber-200">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px]">
              <p className="font-bold text-amber-300">ملاحظة لضبط طباعة ملصقات 1*1.5 بوصة بدون ترحيل:</p>
              <p className="text-stone-300">
                في نافذة الطباعة: اضبط الهوامش على <strong className="text-amber-300 underline">None / بلا هوامش</strong>، واختر مقاس الورق في الطابعة المطابق لـ <strong className="text-amber-300 font-mono">38mm × 25mm</strong> (أو 1.5×1 in) لتخرج كل قطعة بدقة متناهية.
              </p>
            </div>
          </div>

          {/* Label Live Vector Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300 flex items-center space-x-1.5 space-x-reverse">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>
                  معاينة حية للملصق: <strong className="text-amber-300">{previewProduct.name}</strong>
                </span>
              </span>
              <span className="text-[11px] text-stone-400">
                الأبعاد الفيزيائية: <strong className="text-amber-400 font-mono">{config.widthMm}mm × {config.heightMm}mm</strong>
              </span>
            </div>

            {/* Sticker Preview Box */}
            <div className="bg-stone-950 p-6 rounded-3xl border border-stone-800 flex justify-center items-center">
              <div
                className="bg-white text-black rounded-lg p-2.5 shadow-2xl border border-stone-300 flex flex-col justify-between items-center text-center select-none space-y-0.5 transition-all overflow-hidden box-border"
                style={{
                  width: `${Math.max(160, Math.min(320, config.widthMm * 4.4))}px`,
                  height: `${Math.max(110, Math.min(240, config.heightMm * 4.4))}px`,
                }}
              >
                {/* Store Header (Optional) */}
                {showStoreName && (
                  <div className="w-full border-b border-black/30 pb-0.5">
                    <h5 className="font-black tracking-wide text-black text-[9.5px] leading-tight truncate">
                      {storeName}
                    </h5>
                  </div>
                )}

                {/* Product Name */}
                <div className="w-full px-0.5 pt-0.5">
                  <h4 className="font-black text-black leading-tight text-[11px] line-clamp-1">
                    {previewProduct.name}
                  </h4>
                </div>

                {/* Real Vector SVG Barcode & Code Underneath (tight spacing) */}
                <div className="w-full my-0 py-0 flex flex-col items-center justify-center space-y-0">
                  <BarcodeItem
                    value={previewProduct.barcode || previewProduct.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={config.fontSizeBarcode}
                    displayValue={false}
                  />
                  {showItemCode && (
                    <span
                      className="font-mono font-black tracking-wider text-black text-center select-none block leading-none -mt-1"
                      style={{ fontSize: `${config.fontSizeBarcode}px`, lineHeight: 1 }}
                    >
                      {previewProduct.sku || previewProduct.barcode || '000000'}
                    </span>
                  )}
                </div>

                {/* Prices: Exact match to user photo */}
                <div className="w-full flex flex-col items-center justify-center font-black text-black leading-tight space-y-0.5 pb-0.5">
                  <div className="text-[12px] font-black text-black">
                    <span>السعر : </span>
                    <span className="font-mono mx-1">{formatStickerPrice(previewProduct.priceCash)}</span>
                    <span>ج</span>
                  </div>

                  {showInstallmentPrice && (previewProduct.priceInstallment !== undefined && previewProduct.priceInstallment !== null) && (
                    <div className="text-[11px] font-mono font-black text-black">
                      #{formatStickerPrice(previewProduct.priceInstallment)}
                    </div>
                  )}
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
                key={`thermal_${item.key}_${idx}`}
                className="label-sticker-thermal bg-white text-black flex flex-col justify-between items-center text-center overflow-hidden box-border"
                style={{
                  width: config.width,
                  maxWidth: config.width,
                  height: config.height,
                  maxHeight: config.height,
                  minHeight: config.height,
                  padding: '0.8mm 1.2mm',
                  boxSizing: 'border-box',
                  pageBreakAfter: idx < allPrintItems.length - 1 ? 'always' : 'avoid',
                  breakAfter: idx < allPrintItems.length - 1 ? 'page' : 'avoid',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {showStoreName && (
                  <div
                    className="font-black border-b border-black/30 pb-0.5 uppercase leading-none w-full truncate"
                    style={{ fontSize: config.fontSizeHeader }}
                  >
                    {storeName}
                  </div>
                )}

                <div
                  className="font-black line-clamp-1 leading-tight w-full px-0.5"
                  style={{ fontSize: config.fontSizeTitle }}
                >
                  {item.product.name}
                </div>

                {/* Real SVG Barcode & Code Underneath in Print (tight spacing) */}
                <div className="w-full my-0 flex flex-col items-center justify-center space-y-0">
                  <BarcodeItem
                    value={item.product.barcode || item.product.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={config.fontSizeBarcode}
                    displayValue={false}
                  />
                  {showItemCode && (
                    <span
                      className="font-mono font-black tracking-wider text-black text-center select-none block leading-none -mt-1"
                      style={{ fontSize: `${config.fontSizeBarcode}px`, lineHeight: 1 }}
                    >
                      {item.product.sku || item.product.barcode || '000000'}
                    </span>
                  )}
                </div>

                {/* Prices: Exact match to user photo */}
                <div className="w-full flex flex-col items-center justify-center font-black text-black leading-tight space-y-0.5 pb-0.5">
                  <div style={{ fontSize: config.fontSizePrice }}>
                    <span>السعر : </span>
                    <span className="font-mono mx-1">{formatStickerPrice(item.product.priceCash)}</span>
                    <span>ج</span>
                  </div>

                  {showInstallmentPrice && (item.product.priceInstallment !== undefined && item.product.priceInstallment !== null) && (
                    <div
                      className="font-mono font-black text-black"
                      style={{ fontSize: `calc(${config.fontSizePrice} - 1px)` }}
                    >
                      #{formatStickerPrice(item.product.priceInstallment)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Sheet A4 Grid Mode: Multiple stickers per page in grid */
          <div
            className={`grid ${
              labelPreset === 'sheet_a4_2col' ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-2'
            } p-3 w-full bg-white text-black`}
          >
            {allPrintItems.map((item, idx) => (
              <div
                key={`sheet_${item.key}_${idx}`}
                className="bg-white text-black border border-stone-400 p-2 rounded flex flex-col justify-between items-center text-center overflow-hidden box-border"
                style={{
                  height: config.height,
                  maxHeight: config.height,
                  boxSizing: 'border-box',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {showStoreName && (
                  <div
                    className="font-black border-b border-black/30 pb-0.5 uppercase leading-none w-full truncate"
                    style={{ fontSize: config.fontSizeHeader }}
                  >
                    {storeName}
                  </div>
                )}

                <div
                  className="font-black line-clamp-1 leading-tight w-full px-0.5"
                  style={{ fontSize: config.fontSizeTitle }}
                >
                  {item.product.name}
                </div>

                {/* Barcode & Code Underneath (tight spacing) */}
                <div className="w-full my-0 flex flex-col items-center justify-center space-y-0">
                  <BarcodeItem
                    value={item.product.barcode || item.product.sku || '000000'}
                    height={config.barcodeHeight}
                    width={config.barcodeWidth}
                    fontSize={config.fontSizeBarcode}
                    displayValue={false}
                  />
                  {showItemCode && (
                    <span
                      className="font-mono font-black tracking-wider text-black text-center select-none block leading-none -mt-1"
                      style={{ fontSize: `${config.fontSizeBarcode}px`, lineHeight: 1 }}
                    >
                      {item.product.sku || item.product.barcode || '000000'}
                    </span>
                  )}
                </div>

                {/* Prices */}
                <div className="w-full flex flex-col items-center justify-center font-black text-black leading-tight space-y-0.5 pb-0.5">
                  <div style={{ fontSize: config.fontSizePrice }}>
                    <span>السعر : </span>
                    <span className="font-mono mx-1">{formatStickerPrice(item.product.priceCash)}</span>
                    <span>ج</span>
                  </div>

                  {showInstallmentPrice && (item.product.priceInstallment !== undefined && item.product.priceInstallment !== null) && (
                    <div
                      className="font-mono font-black text-black"
                      style={{ fontSize: `calc(${config.fontSizePrice} - 2px)` }}
                    >
                      #{formatStickerPrice(item.product.priceInstallment)}
                    </div>
                  )}
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
