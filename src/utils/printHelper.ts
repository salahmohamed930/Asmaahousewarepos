import { qzPrinterService, PrintDocumentType } from '../services/qzPrinterService';
import { PrintSettings } from '../types';

/**
 * Utility for printing elements cleanly using a hidden iframe to isolate the content
 * from dark mode backgrounds, modal wrappers, and iframe sandboxes.
 */
export interface PrintOptions {
  pageTitle?: string;
  pageCssSize?: string; // e.g. '38mm 25mm' | '50mm 30mm' | '80mm auto' | 'A4 portrait'
  customStyles?: string;
  isThermalReceipt?: boolean;
  docType?: PrintDocumentType; // 'invoice' | 'barcode'
  printSettings?: PrintSettings;
  onFallbackUsed?: (reason: string) => void;
}

/**
 * Standard browser iframe printing fallback
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
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.warn('Could not access print iframe document, falling back to window.print()');
    window.print();
    return;
  }

  const pageTitle = options?.pageTitle || 'طباعة مستند';
  const pageCssSize = options?.pageCssSize || 'auto';
  const customStyles = options?.customStyles || '';

  doc.open();
  doc.write(`
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
  `);
  doc.close();

  // Wait a moment for fonts/SVGs to complete layout, then trigger print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print error, falling back to standard print:', err);
      window.print();
    }
  }, 250);
}

export function printElementById(elementId: string, options?: PrintOptions) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id #${elementId} not found for printing.`);
    window.print();
    return;
  }
  printHtmlDirect(el.outerHTML, options);
}

/**
 * Smart Print Function:
 * Tries direct silent printing via QZ Tray if enabled and printer is configured.
 * Automatically falls back to browser iframe printing if direct print is unconfigured or fails.
 */
export async function smartPrintHtml(
  htmlContent: string,
  options?: PrintOptions
): Promise<{ usedDirect: boolean; success: boolean; message?: string }> {
  const docType: PrintDocumentType = options?.docType || 'invoice';
  const printSettings = options?.printSettings;
  const isDirectEnabled = printSettings?.directPrintEnabled !== false;

  const targetPrinterName =
    docType === 'invoice'
      ? printSettings?.invoicePrinterName
      : printSettings?.barcodePrinterName;

  const copies =
    docType === 'invoice'
      ? printSettings?.invoiceCopies || 1
      : printSettings?.barcodeCopies || 1;

  const paperSize =
    docType === 'invoice'
      ? printSettings?.invoicePaperSize || '80mm'
      : printSettings?.barcodePaperSize || '38x25mm';

  // Attempt direct silent printing if enabled and target printer name exists
  if (isDirectEnabled && targetPrinterName && targetPrinterName.trim()) {
    let isActive = qzPrinterService.isQzActive();
    if (!isActive) {
      const conn = await qzPrinterService.connect();
      isActive = conn.success;
    }

    if (isActive) {
      const res = await qzPrinterService.printHtmlDirect(htmlContent, {
        printerName: targetPrinterName,
        copies,
        paperSize,
        docType,
        pageTitle: options?.pageTitle,
      });

      if (res.success) {
        return {
          usedDirect: true,
          success: true,
          message: `تمت الطباعة المباشرة بنجاح على طابعة ${
            docType === 'invoice' ? 'الفواتير' : 'الباركود'
          } (${targetPrinterName}).`,
        };
      } else {
        const fallbackReason = `تعذر الطباعة المباشرة على "${targetPrinterName}": ${res.error}. جاري التوجيه للطباعة عبر نافذة الويندوز.`;
        if (options?.onFallbackUsed) {
          options.onFallbackUsed(fallbackReason);
        }
      }
    } else {
      const fallbackReason =
        'خدمة الطباعة المباشرة QZ Tray غير مشغلة على الويندوز. تم فتح نافذة الطباعة القياسية.';
      if (options?.onFallbackUsed) {
        options.onFallbackUsed(fallbackReason);
      }
    }
  }

  // Fallback to standard browser print
  printHtmlDirect(htmlContent, options);
  return {
    usedDirect: false,
    success: true,
    message: 'تم فتح نافذة طباعة الويندوز القياسية.',
  };
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
    window.print();
    return {
      usedDirect: false,
      success: false,
      message: 'العنصر المراد طباعته غير موجود.',
    };
  }
  return smartPrintHtml(el.outerHTML, options);
}
