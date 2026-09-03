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
          // Provide self-signed or empty resolver for local QZ Tray unsigned connections
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
      console.warn('QZ Security setup notice:', err);
    }
  }

  /**
   * Subscribe to connection status changes
   */
  public subscribeStatus(listener: (status: PrinterServiceStatus) => void): () => void {
    this.statusListeners.push(listener);
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
        ? 'خدمة الطباعة المباشرة متصلة وجاهزة (QZ Tray Active)'
        : this.isConnecting
        ? 'جاري الاتصال بخدمة الطباعة المباشرة QZ Tray...'
        : 'خدمة الطباعة المباشرة غير متصلة (QZ Tray Offline)',
      lastError: msg?.error || this.lastError,
      lastSuccessMessage: msg?.success,
    };
  }

  /**
   * Check if QZ Tray WebSocket connection is currently active
   */
  public isQzActive(): boolean {
    try {
      return qz && qz.websocket && qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  /**
   * Connect to local QZ Tray WebSocket bridge on Windows
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
      // Connect to QZ Tray daemon on localhost (ports 8182/8181)
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
      const parsedErr = this.categorizeError(err, 'connect');
      this.lastError = parsedErr;
      this.notifyListeners({ error: parsedErr });
      return { success: false, error: parsedErr };
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
   * Discover installed Windows printers via QZ Tray
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
      const parsedErr = this.categorizeError(err, 'findPrinters');
      this.notifyListeners({ error: parsedErr });
      return { success: false, printers: [], error: parsedErr };
    }
  }

  /**
   * Check if a specific printer exists by name on Windows
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
   * Direct Print HTML Payload to Specified Printer
   */
  public async printHtmlDirect(
    htmlContent: string,
    opts: DirectPrintOptions
  ): Promise<{ success: boolean; error?: string }> {
    const printerName = opts.printerName?.trim();

    if (!printerName) {
      const err = `لم يتم اختيار طابعة ${
        opts.docType === 'invoice' ? 'الفواتير' : 'الباركود'
      } في إعدادات النظام. يرجى تحديد اسم الطابعة من شاشة الإعدادات.`;
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
        const notFoundErr = `الطابعة "${printerName}" غير موجودة في نظام Windows. تحقق من اسم الطابعة وتوصيل كابل USB/الشبكة.`;
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

      // Create QZ Config
      const configOpts: any = {
        copies,
        colorType: 'color',
      };
      if (sizeOpt) {
        configOpts.size = sizeOpt;
      }

      const qzConfig = qz.configs.create(printerName, configOpts);

      // Package HTML print job
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
      const parsedErr = this.categorizeError(err, 'print', printerName);
      this.notifyListeners({ error: parsedErr });
      return { success: false, error: parsedErr };
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

  /**
   * Precise Arabic Error Diagnostic Resolver
   */
  private categorizeError(err: any, context: 'connect' | 'findPrinters' | 'print', printerName?: string): string {
    const rawMsg = (err?.message || String(err)).toLowerCase();

    // Case 1: QZ Tray Not Installed / Not Running / Port Closed
    if (
      rawMsg.includes('websocket') ||
      rawMsg.includes('connection refused') ||
      rawMsg.includes('econnrefused') ||
      rawMsg.includes('unable to establish connection') ||
      rawMsg.includes('closed') ||
      rawMsg.includes('networkerror')
    ) {
      return 'برنامج QZ Tray غير مشغل أو غير مثبت على الويندوز. يرجى فتح برنامج QZ Tray على الجهاز والتأكد من ظهور أيقونته بجوار الساعة.';
    }

    // Case 2: Certificate or Security signing rejection
    if (
      rawMsg.includes('certificate') ||
      rawMsg.includes('signature') ||
      rawMsg.includes('untrusted') ||
      rawMsg.includes('security') ||
      rawMsg.includes('blocked')
    ) {
      return 'تم رفض الشهادة الأمنية من برنامج QZ Tray. يرجى الموافقة على طلب الاتصال Allow/Trust في النافذة المنبثقة لـ QZ Tray.';
    }

    // Case 3: Printer Not Found
    if (
      rawMsg.includes('cannot find printer') ||
      rawMsg.includes('printer not found') ||
      rawMsg.includes('invalid printer') ||
      rawMsg.includes('no printer matched')
    ) {
      return `الطابعة "${printerName || ''}" غير مضافة أو غير موجودة في الويندوز. اضغط زر "اكتشاف الطابعات" للتأكد من اسمها الصحيح.`;
    }

    // Case 4: Printer Offline or Spooler Error
    if (
      rawMsg.includes('offline') ||
      rawMsg.includes('spooler') ||
      rawMsg.includes('paper out') ||
      rawMsg.includes('not ready') ||
      rawMsg.includes('port')
    ) {
      return `الطابعة "${printerName || ''}" غير متصلة بالكهرباء أو 오فلين (Offline). يرجى التأكد من تشغيل الطابعة وتوصيل الكابل ورول الورق.`;
    }

    // Case 5: Generic Print Command Failure
    if (context === 'print') {
      return `فشل إرسال أمر الطباعة إلى الطابعة "${printerName || ''}": ${err?.message || String(err)}`;
    }

    return `خطأ في خدمة الطباعة: ${err?.message || String(err)}`;
  }
}

export const qzPrinterService = new QzPrinterService();
