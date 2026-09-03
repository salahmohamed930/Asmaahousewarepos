import qz from 'qz-tray';

export interface PrinterServiceStatus {
  isConnected: boolean;
  isConnecting: boolean;
  statusText: string;
  lastError?: string;
  lastSuccessMessage?: string;
}

export type PrintDocumentType = 'invoice' | 'barcode';

export interface DirectPrintOptions {
  printerName?: string;
  copies?: number;
  paperSize?: string;
  docType: PrintDocumentType;
  pageTitle?: string;
}

class QzPrinterService {
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private lastError: string = '';
  private statusListeners: Array<(status: PrinterServiceStatus) => void> = [];

  constructor() {
    this.configureSecurity();
  }

  /**
   * Configure QZ Tray security promises for local unsigned execution
   */
  private configureSecurity() {
    try {
      if (qz && qz.security) {
        qz.security.setCertificatePromise((resolve: any) => {
          resolve();
        });
        qz.security.setSignatureAlgorithm('SHA512');
        qz.security.setSignaturePromise(() => {
          return (resolve: any) => {
            resolve();
          };
        });
      }
    } catch (err) {
      // Ignored - QZ Security default
    }
  }

  /**
   * Subscribe to connection status changes
   */
  public subscribeStatus(listener: (status: PrinterServiceStatus) => void): () => void {
    this.statusListeners.push(listener);
    // Notify immediately
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(msg?: { success?: string; error?: string }) {
    const status = this.getStatus(msg);
    this.statusListeners.forEach((l) => l(status));
  }

  public getStatus(msg?: { success?: string; error?: string }): PrinterServiceStatus {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      statusText: this.isConnected
        ? 'خدمة الطباعة المباشرة متصلة جاهزة (QZ Tray Active)'
        : this.isConnecting
        ? 'جاري الاتصال بخدمة الطباعة المباشرة...'
        : 'خدمة الطباعة المباشرة غير متصلة (QZ Tray Offline)',
      lastError: msg?.error || this.lastError,
      lastSuccessMessage: msg?.success,
    };
  }

  /**
   * Check if QZ Tray active
   */
  public isQzActive(): boolean {
    try {
      return qz && qz.websocket && qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  /**
   * Connect to QZ Tray WebSocket
   */
  public async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.isQzActive()) {
      this.isConnected = true;
      this.isConnecting = false;
      this.notifyListeners();
      return { success: true };
    }

    this.isConnecting = true;
    this.notifyListeners();

    try {
      // Connect to local QZ Tray websocket on ports 8182/8181
      await qz.websocket.connect({
        retries: 2,
        delay: 1,
        host: 'localhost',
        port: { secure: [8181, 8182, 443], insecure: [8182, 8183, 80] },
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.lastError = '';
      this.notifyListeners({ success: 'تم الاتصال بخدمة الطباعة المباشرة QZ Tray بنجاح!' });
      return { success: true };
    } catch (err: any) {
      this.isConnected = false;
      this.isConnecting = false;
      const cleanErr = err?.message || String(err);
      
      let userFriendlyError = 'تعذر الاتصال ببرنامج QZ Tray على الجهاز.';
      if (cleanErr.includes('WebSocket') || cleanErr.includes('Connection refused') || cleanErr.includes('close')) {
        userFriendlyError = 'برنامج QZ Tray غير مشغل أو غير مثبت على الويندوز. يرجى تشغيل QZ Tray والتحقق من فتح المنفذ 8182.';
      } else {
        userFriendlyError = `فشل الاتصال بـ QZ Tray: ${cleanErr}`;
      }

      this.lastError = userFriendlyError;
      this.notifyListeners({ error: userFriendlyError });
      return { success: false, error: userFriendlyError };
    }
  }

  /**
   * Disconnect from QZ Tray
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.isQzActive()) {
        await qz.websocket.disconnect();
      }
    } catch {
      // Ignore disconnect errors
    } finally {
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyListeners();
    }
  }

  /**
   * Discover installed printers on Windows
   */
  public async findPrinters(): Promise<{ success: boolean; printers: string[]; error?: string }> {
    const conn = await this.connect();
    if (!conn.success) {
      return { success: false, printers: [], error: conn.error };
    }

    try {
      const printersList: string[] = await qz.printers.find();
      return { success: true, printers: printersList || [] };
    } catch (err: any) {
      const errStr = err?.message || 'فشل البحث عن الطابعات في الويندوز.';
      this.notifyListeners({ error: errStr });
      return { success: false, printers: [], error: errStr };
    }
  }

  /**
   * Check if a specific printer exists by name
   */
  public async findPrinter(printerName: string): Promise<boolean> {
    if (!printerName) return false;
    const conn = await this.connect();
    if (!conn.success) return false;

    try {
      const matched = await qz.printers.find(printerName);
      return !!matched;
    } catch {
      return false;
    }
  }

  /**
   * Direct Print HTML Content to Specified Printer
   */
  public async printHtmlDirect(
    htmlContent: string,
    opts: DirectPrintOptions
  ): Promise<{ success: boolean; error?: string }> {
    const printerName = opts.printerName?.trim();

    if (!printerName) {
      const err = `لم يتم تحديد طابعة ${
        opts.docType === 'invoice' ? 'الفواتير' : 'الباركود'
      } في إعدادات النظام. يرجى اختيار الطابعة المحفوظة أولاً.`;
      this.notifyListeners({ error: err });
      return { success: false, error: err };
    }

    const conn = await this.connect();
    if (!conn.success) {
      return { success: false, error: conn.error };
    }

    try {
      // Verify target printer exists on Windows
      const printerExists = await this.findPrinter(printerName);
      if (!printerExists) {
        const notFoundErr = `الطابعة "${printerName}" غير موجودة أو غير متصلة بالويندوز (Printer Not Found). يرجى التأكد من اسم الطابعة وتوصيل الكابل.`;
        this.notifyListeners({ error: notFoundErr });
        return { success: false, error: notFoundErr };
      }

      // Paper size configuration mapping
      let sizeOpt: any = undefined;
      const copies = opts.copies && opts.copies > 0 ? opts.copies : 1;

      if (opts.paperSize) {
        if (opts.paperSize.includes('80mm')) {
          sizeOpt = { width: 80, mm: true };
        } else if (opts.paperSize.includes('58mm')) {
          sizeOpt = { width: 58, mm: true };
        } else if (opts.paperSize.includes('38x25')) {
          sizeOpt = { width: 38, height: 25, mm: true };
        } else if (opts.paperSize.includes('40x25')) {
          sizeOpt = { width: 40, height: 25, mm: true };
        } else if (opts.paperSize.includes('50x25')) {
          sizeOpt = { width: 50, height: 25, mm: true };
        } else if (opts.paperSize.includes('50x30')) {
          sizeOpt = { width: 50, height: 30, mm: true };
        }
      }

      // Create QZ config
      const configOpts: any = {
        copies,
        colorType: 'color',
      };
      if (sizeOpt) {
        configOpts.size = sizeOpt;
      }

      const qzConfig = qz.configs.create(printerName, configOpts);

      // Package HTML print job for QZ Pixel engine
      const printData = [
        {
          type: 'pixel',
          format: 'html',
          flavor: 'plain',
          data: `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
              <head>
                <meta charset="utf-8" />
                <title>${opts.pageTitle || 'طباعة مباشرة'}</title>
                <style>
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
                    font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
                  }
                </style>
              </head>
              <body>
                ${htmlContent}
              </body>
            </html>
          `,
        },
      ];

      await qz.print(qzConfig, printData);

      const successMsg = `تم إرسال أمر الطباعة بنجاح إلى طابعة ${
        opts.docType === 'invoice' ? 'الفواتير' : 'الباركود'
      } (${printerName}).`;
      this.notifyListeners({ success: successMsg });
      return { success: true };
    } catch (err: any) {
      const cleanErr = err?.message || String(err);
      const printFailErr = `فشلت عملية الطباعة على الطابعة "${printerName}": ${cleanErr}`;
      this.notifyListeners({ error: printFailErr });
      return { success: false, error: printFailErr };
    }
  }

  /**
   * Test Invoice Printer
   */
  public async testInvoicePrinter(
    printerName: string,
    paperSize: string = '80mm'
  ): Promise<{ success: boolean; error?: string }> {
    const testHtml = `
      <div style="padding: 10px; font-family: sans-serif; text-align: center; border: 2px dashed #000;">
        <h2 style="margin: 0 0 5px 0; font-size: 16px;">أسماء للأدوات المنزليه</h2>
        <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #000;">اختبار طابعة الفواتير (Direct Print Test)</h3>
        <p style="font-size: 11px; margin: 5px 0;">الطابعة: <b>${printerName}</b></p>
        <p style="font-size: 11px; margin: 5px 0;">مقاس الورق: <b>${paperSize}</b></p>
        <p style="font-size: 10px; margin: 5px 0;">التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
        <hr style="border-top: 1px solid #000; margin: 10px 0;" />
        <p style="font-size: 12px; font-weight: bold; margin: 0;">✓ خدمة الطباعة المباشرة تعمل بنجاح بدون نوافذ!</p>
      </div>
    `;

    return this.printHtmlDirect(testHtml, {
      printerName,
      paperSize,
      docType: 'invoice',
      pageTitle: 'اختبار-طابعة-الفواتير',
    });
  }

  /**
   * Test Barcode Printer
   */
  public async testBarcodePrinter(
    printerName: string,
    paperSize: string = '38x25mm'
  ): Promise<{ success: boolean; error?: string }> {
    const testHtml = `
      <div style="width: 38mm; height: 25mm; padding: 2px; box-sizing: border-box; font-family: sans-serif; text-align: center; border: 1px solid #000;">
        <div style="font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden;">أسماء للأدوات المنزليه</div>
        <div style="font-size: 9px; font-weight: bold; margin: 1px 0;">صنف تجريبي</div>
        <div style="font-family: monospace; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin: 1px 0; border: 1px solid #000; padding: 1px;">||||||||||||||||||</div>
        <div style="font-size: 8px; font-weight: bold; font-family: monospace;">2026001122</div>
        <div style="font-size: 9px; font-weight: bold; margin-top: 1px;">السعر: 150.0 ج</div>
      </div>
    `;

    return this.printHtmlDirect(testHtml, {
      printerName,
      paperSize,
      docType: 'barcode',
      pageTitle: 'اختبار-طابعة-الباركود',
    });
  }
}

export const qzPrinterService = new QzPrinterService();
