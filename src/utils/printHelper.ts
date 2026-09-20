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
  suppressBrowserDialog?: boolean;
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
      console.warn('Iframe print error:', err);
      if (!shouldSuppress) {
        window.print();
      }
    }
  }, 250);
}

export function printElementById(elementId: string, options?: PrintOptions) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id #${elementId} not found for printing.`);
    const shouldSuppress =
      options?.suppressBrowserDialog === true ||
      options?.printSettings?.suppressWindowsPrintDialog === true;
    if (!shouldSuppress) {
      window.print();
    }
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

  const directMethod = printSettings?.directPrintMethod || 'kiosk'; // default to kiosk as primary zero-dependency method
  const shouldSuppressDialog = printSettings?.suppressWindowsPrintDialog === true || options?.suppressBrowserDialog === true;

  // 1. If method is explicitly 'kiosk' (Browser native silent printing via --kiosk-printing)
  if (directMethod === 'kiosk') {
    printHtmlDirect(htmlContent, options);
    return {
      usedDirect: true,
      success: true,
      message: 'تم إرسال الفاتورة عبر وضع الطباعة الصامتة (Kiosk Printing).',
    };
  }

  // 2. If method is 'qz-tray', attempt direct silent printing via QZ Tray service
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
        const fallbackReason = `تعذر الطباعة عبر QZ Tray على "${targetPrinterName}": ${res.error}.`;
        if (options?.onFallbackUsed) {
          options.onFallbackUsed(fallbackReason);
        }
      }
    } else {
      const fallbackReason =
        'برنامج QZ Tray غير متصل أو غير مشغل على جهاز الويندوز.';
      if (options?.onFallbackUsed) {
        options.onFallbackUsed(fallbackReason);
      }
    }
  }

  // 3. Fallback: If user chose to suppress the Windows dialog, do not open it!
  if (shouldSuppressDialog) {
    return {
      usedDirect: false,
      success: false,
      message: 'تم كتم نافذة طباعة الويندوز تلقائياً حسب إعداداتك.',
    };
  }

  // Fallback to standard browser print
  printHtmlDirect(htmlContent, options);
  return {
    usedDirect: false,
    success: true,
    message: 'تم إرسال أمر الطباعة للمتصفح.',
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
    return {
      usedDirect: false,
      success: false,
      message: 'العنصر المراد طباعته غير موجود.',
    };
  }
  return smartPrintHtml(el.outerHTML, options);
}
