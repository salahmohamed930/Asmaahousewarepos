import { PrintSettings } from '../types';
import { printHtmlToNamedPrinter, isQzActive } from '../services/qzTrayService';

export type PrintDocumentType = 'invoice' | 'barcode' | 'report';

/**
 * Options for printing documents.
 */
export interface PrintOptions {
  pageTitle?: string;
  pageCssSize?: string; // e.g. '38mm 25mm' | '50mm 30mm' | '80mm auto' | 'A4 portrait'
  customStyles?: string;
  isThermalReceipt?: boolean;
  docType?: PrintDocumentType; // 'invoice' | 'barcode' | 'report'
  printSettings?: PrintSettings;
  onFallbackUsed?: (reason: string) => void;
  suppressBrowserDialog?: boolean;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
  targetPrinterName?: string;
}

/**
 * Builds a standalone, complete HTML document suitable for both browser iframes and QZ Tray pixel printing.
 */
export function buildCompleteHtmlDocument(htmlContent: string, options?: PrintOptions): string {
  const pageTitle = options?.pageTitle || 'طباعة مستند';
  const pageCssSize = options?.pageCssSize || 'auto';
  const customStyles = options?.customStyles || '';
  const isThermal = options?.isThermalReceipt === true || (pageCssSize && pageCssSize.includes('80mm'));
  const isInvoice = options?.docType === 'invoice' || !options?.docType;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${pageTitle}</title>
        <style>
          @page {
            size: ${pageCssSize};
            margin: ${isThermal ? '0' : '4mm 6mm'};
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Kufi Arabic', sans-serif;
            -webkit-font-smoothing: antialiased;
            ${!isThermal && isInvoice ? 'height: 100% !important; max-height: 297mm !important; overflow: hidden !important;' : ''}
          }
          #printable-receipt {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            ${!isThermal && isInvoice ? 'max-height: 100% !important;' : ''}
          }
          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          img, svg {
            max-width: 100%;
            display: inline-block;
          }
          .no-print {
            display: none !important;
          }
          ${customStyles}
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `.trim();
}

/**
 * Standard browser iframe printing fallback.
 * Enforces fitting on a SINGLE page:
 * - For Thermal (80mm): measures exact content height and assigns dynamic @page size so Chromium never splits it.
 * - For A4: renders at 794px width and dynamically scales down if height exceeds the A4 sheet so it fits on 1 page.
 */
export function printHtmlDirect(htmlContent: string, options?: PrintOptions) {
  // Remove any previously created print iframe
  const existingFrame = document.getElementById('pos_direct_print_frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const isThermal =
    options?.isThermalReceipt === true ||
    (options?.pageCssSize && options.pageCssSize.includes('80mm'));

  const iframe = document.createElement('iframe');
  iframe.id = 'pos_direct_print_frame';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = isThermal ? '300px' : '794px';
  iframe.style.height = isThermal ? '1600px' : '1123px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const shouldSuppress =
    options?.suppressBrowserDialog === true ||
    options?.printSettings?.suppressWindowsPrintDialog === true;

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.warn('Could not access print iframe document');
    if (!shouldSuppress) {
      window.print();
    }
    return;
  }

  const fullHtml = buildCompleteHtmlDocument(htmlContent, options);

  doc.open();
  doc.write(fullHtml);
  doc.close();

  // Wait for fonts/SVGs/layout to settle, measure height, scale if needed, then print
  setTimeout(() => {
    try {
      const receiptEl = doc.getElementById('printable-receipt');
      if (receiptEl) {
        if (isThermal) {
          // Dynamic calculation of thermal roll height:
          // 1px = 25.4 / 96 = 0.264583 mm
          const contentHeightPx =
            receiptEl.scrollHeight || receiptEl.offsetHeight || receiptEl.getBoundingClientRect().height;
          const heightMm = Math.max(65, Math.ceil(contentHeightPx * 0.264583) + 6);

          const styleEl = doc.createElement('style');
          styleEl.innerHTML = `
            @page {
              size: 80mm ${heightMm}mm !important;
              margin: 0 !important;
            }
            html, body {
              width: 80mm !important;
              height: ${heightMm}mm !important;
              max-height: ${heightMm}mm !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #printable-receipt {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
            }
            table, tr, td, th {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          `;
          doc.head.appendChild(styleEl);
        } else if (options?.docType === 'invoice' || !options?.docType) {
          // A4 Invoice - Force single page fitting
          const maxA4HeightPx = 1060;
          const contentHeightPx =
            receiptEl.scrollHeight || receiptEl.offsetHeight || receiptEl.getBoundingClientRect().height;
          if (contentHeightPx > maxA4HeightPx) {
            const scale = Math.max(0.45, Math.min(1, (maxA4HeightPx / contentHeightPx) * 0.98));
            receiptEl.style.transform = `scale(${scale})`;
            receiptEl.style.transformOrigin = 'top center';
            receiptEl.style.width = `${(100 / scale).toFixed(2)}%`;
            receiptEl.style.margin = '0 auto';
          }
          const styleEl = doc.createElement('style');
          styleEl.innerHTML = `
            @page {
              size: A4 portrait !important;
              margin: 4mm 6mm !important;
            }
            html, body {
              height: 100% !important;
              max-height: 287mm !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #printable-receipt {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
            }
            table, tr, td, th {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          `;
          doc.head.appendChild(styleEl);
        }
      }

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print error:', err);
      if (!shouldSuppress) {
        window.print();
      }
    }
  }, 250);
}

/**
 * Smart Print Function:
 * 1. If QZ Tray is active & printer name is specified -> prints DIRECTLY to that exact printer by name!
 * 2. If QZ Tray is not running -> seamlessly falls back to browser printing engine without errors.
 */
export async function smartPrintHtml(
  htmlContent: string,
  options?: PrintOptions
): Promise<{ usedDirect: boolean; success: boolean; message?: string }> {
  const shouldSuppress =
    options?.suppressBrowserDialog === true ||
    options?.printSettings?.suppressWindowsPrintDialog === true;

  // Determine target printer name based on document type
  let targetPrinter = options?.targetPrinterName || '';
  if (!targetPrinter) {
    if (options?.docType === 'barcode') {
      targetPrinter = options?.printSettings?.barcodePrinterName || 'Xprinter XP-370B';
    } else if (options?.docType === 'invoice') {
      targetPrinter = options?.printSettings?.invoicePrinterName || 'XP-80C';
    }
  }

  const fullDocumentHtml = buildCompleteHtmlDocument(htmlContent, options);

  // Check if direct printing to named printer is enabled
  const isDirectEnabled = options?.printSettings?.directPrintEnabled !== false;

  if (isDirectEnabled && targetPrinter) {
    try {
      // Calculate width/height in mm if provided
      let widthMm = options?.widthMm;
      let heightMm = options?.heightMm;

      if (!widthMm && options?.docType === 'invoice' && options?.isThermalReceipt) {
        widthMm = 80;
      } else if (!widthMm && options?.docType === 'barcode') {
        widthMm = 38;
        heightMm = 25;
      }

      const qzResult = await printHtmlToNamedPrinter({
        printerName: targetPrinter,
        htmlContent: fullDocumentHtml,
        widthMm,
        heightMm,
        copies: options?.copies || (options?.docType === 'barcode' ? options?.printSettings?.barcodeCopies : options?.printSettings?.invoiceCopies) || 1,
        jobName: options?.pageTitle || (options?.docType === 'barcode' ? 'ملصق باركود' : 'فاتورة كاشير'),
      });

      if (qzResult.success) {
        return {
          usedDirect: true,
          success: true,
          message: qzResult.message,
        };
      } else {
        console.warn('Direct printer dispatch via QZ Tray was not available:', qzResult.message);
        if (options?.onFallbackUsed) {
          options.onFallbackUsed(qzResult.message);
        }
      }
    } catch (err: any) {
      console.warn('Error during named printer dispatch:', err);
    }
  }

  // Fallback to browser iframe print
  try {
    printHtmlDirect(htmlContent, options);
    return {
      usedDirect: false,
      success: true,
      message: 'تم إرسال المستند للطباعة عبر محرك المتصفح (لتوجيه كل طابعة باسمها المستقل يرجى تشغيل QZ Tray).',
    };
  } catch (err: any) {
    if (shouldSuppress) {
      return {
        usedDirect: false,
        success: false,
        message: 'تم كتم نافذة طباعة الويندوز تلقائياً.',
      };
    }
    return {
      usedDirect: false,
      success: false,
      message: err?.message || 'تعذر استكمال الطباعة.',
    };
  }
}

/**
 * Smart Print Element by ID:
 * Extracts element outerHTML and calls smartPrintHtml
 */
export async function smartPrintElementById(
  elementId: string,
  options?: PrintOptions
): Promise<{ usedDirect: boolean; success: boolean; message?: string }> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id #${elementId} not found for printing.`);
    return {
      usedDirect: false,
      success: false,
      message: 'العنصر المراد طباعته غير موجود.',
    };
  }
  return smartPrintHtml(el.outerHTML, options);
}
