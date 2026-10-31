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

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${pageTitle}</title>
        <style>
          @page {
            size: ${pageCssSize};
            margin: ${options?.isThermalReceipt ? '2mm 3mm' : '0'};
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Kufi Arabic', sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            text-align: right;
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
 */
export function printHtmlDirect(htmlContent: string, options?: PrintOptions) {
  // Remove any previously created print iframe
  const existingFrame = document.getElementById('pos_direct_print_frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'pos_direct_print_frame';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '380px';
  iframe.style.height = '700px';
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

  // Wait a moment for fonts/SVGs to complete layout, then trigger print
  setTimeout(() => {
    try {
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
