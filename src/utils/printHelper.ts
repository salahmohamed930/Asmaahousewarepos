import { PrintSettings } from '../types';

export type PrintDocumentType = 'invoice' | 'barcode' | 'report';

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
 * Sends content directly to the silent printing pipeline (Chrome/Edge Kiosk mode).
 * Uses isolated iframe for 100% clean formatting and automatic silent paper output.
 */
export async function smartPrintHtml(
  htmlContent: string,
  options?: PrintOptions
): Promise<{ usedDirect: boolean; success: boolean; message?: string }> {
  const shouldSuppress =
    options?.suppressBrowserDialog === true ||
    options?.printSettings?.suppressWindowsPrintDialog === true;

  try {
    printHtmlDirect(htmlContent, options);
    return {
      usedDirect: true,
      success: true,
      message: 'تم إرسال المستند للطباعة الصامتة المباشرة (Kiosk Printing).',
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
