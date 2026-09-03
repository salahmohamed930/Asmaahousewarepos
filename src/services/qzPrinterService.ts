import qz from 'qz-tray';

export interface PrinterServiceStatus {
  isConnected: boolean;
  isConnecting: boolean;
  statusText: string;
  lastError?: string;
  lastSuccessMessage?: string;
  isCertificateLoaded?: boolean;
  isSigningAvailable?: boolean;
  isDevFallback?: boolean;
  algorithm?: string;
}

export type PrintDocumentType = 'invoice' | 'barcode';

export interface DirectPrintOptions {
  printerName?: string;
  copies?: number;
  paperSize?: string;
  docType: PrintDocumentType;
  pageTitle?: string;
}

export interface BackendSecurityCheckResult {
  configured: boolean;
  hasCertificate: boolean;
  hasPrivateKey: boolean;
  algorithm: string;
  isDevelopment: boolean;
  isDevFallback: boolean;
  allowedOrigins: string[];
  isOriginAllowed?: boolean;
}

class QzPrinterService {
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private isCertificateLoaded: boolean = false;
  private isSigningAvailable: boolean = false;
  private isDevFallback: boolean = false;
  private cachedCertificate: string | null = null;
  private lastError: string = '';
  private statusListeners: Array<(status: PrinterServiceStatus) => void> = [];

  constructor() {
    this.configureSecurity();
  }

  /**
   * Configure genuine QZ Tray security promises:
   * 1. Certificate Promise fetches the public X.509 certificate from /api/qz/certificate
   * 2. Signature Promise securely delegates signing to /api/qz/sign using RSA-SHA512
   * Note: Private key NEVER exists in frontend or browser!
   */
  private configureSecurity() {
    try {
      if (!qz || !qz.security) return;

      // 1. Digital Certificate Promise
      qz.security.setCertificatePromise((resolve: (cert: string) => void, reject: (err: any) => void) => {
        if (this.cachedCertificate) {
          this.isCertificateLoaded = true;
          resolve(this.cachedCertificate);
          return;
        }

        fetch('/api/qz/certificate', {
          headers: { Accept: 'text/plain, application/json' },
        })
          .then(async (res) => {
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(
                errBody.error ||
                  `فشل استرداد شهادة QZ Tray من الخادم (رمز الخطأ: ${res.status}).`
              );
            }

            const isDevHeader = res.headers.get('X-QZ-Dev-Fallback') === 'true';
            if (isDevHeader) {
              this.isDevFallback = true;
            }

            const certText = await res.text();
            const trimmedCert = certText.trim();

            if (!trimmedCert.includes('BEGIN CERTIFICATE')) {
              throw new Error('محتوى الشهادة المستردة من الخادم غير صالح (تنسيق PEM غير صحيح).');
            }

            this.cachedCertificate = trimmedCert;
            this.isCertificateLoaded = true;
            this.notifyListeners();
            resolve(trimmedCert);
          })
          .catch((err) => {
            this.isCertificateLoaded = false;
            const parsed = this.categorizeSecurityError(err, 'certificate');
            this.notifyListeners({ error: parsed });
            reject(new Error(parsed));
          });
      });

      // 2. Set signature algorithm to SHA-512
      qz.security.setSignatureAlgorithm('SHA512');

      // 3. Digital Signature Promise
      qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: (sig: string) => void, reject: (err: any) => void) => {
          fetch('/api/qz/sign', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ request: toSign }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (res.status === 403) {
                  throw new Error('ORIGIN_FORBIDDEN: النطاق الحالي غير مسموح له بطلب التوقيع (CORS / Allowed Origins).');
                }
                if (res.status === 503) {
                  throw new Error('SIGNING_UNAVAILABLE: خدمة التوقيع على الخادم غير مجهزة بمفتاح QZ_PRIVATE_KEY.');
                }
                throw new Error(errData.error || `فشل التوقيع الأمني على الخادم (رمز الخطأ ${res.status}).`);
              }

              const isDevHeader = res.headers.get('X-QZ-Dev-Fallback') === 'true';
              if (isDevHeader) {
                this.isDevFallback = true;
              }

              const data = await res.json();
              if (!data.signature) {
                throw new Error('لم يتم استلام التوقيع الرقمي من الخادم.');
              }

              this.isSigningAvailable = true;
              resolve(data.signature);
            })
            .catch((err) => {
              const parsed = this.categorizeSecurityError(err, 'signature');
              this.notifyListeners({ error: parsed });
              reject(new Error(parsed));
            });
        };
      });
    } catch (err) {
      console.error('QZ Security setup error:', err);
    }
  }

  /**
   * Diagnostic check to verify Backend Signing & Certificate status
   */
  public async checkBackendSecurityStatus(): Promise<BackendSecurityCheckResult> {
    try {
      const res = await fetch('/api/qz/status', {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`تعذر الوصول إلى نقطة فحص الأمان (رمز: ${res.status})`);
      }

      const data: BackendSecurityCheckResult = await res.json();
      this.isSigningAvailable = data.configured;
      this.isCertificateLoaded = data.hasCertificate;
      this.isDevFallback = data.isDevFallback;
      this.notifyListeners();
      return data;
    } catch (err: any) {
      this.isSigningAvailable = false;
      this.notifyListeners({ error: `فشل التحقق من خدمة التوقيع: ${err?.message || String(err)}` });
      return {
        configured: false,
        hasCertificate: false,
        hasPrivateKey: false,
        algorithm: 'SHA512',
        isDevelopment: false,
        isDevFallback: false,
        allowedOrigins: [],
        isOriginAllowed: false,
      };
    }
  }

  /**
   * Pre-fetches and validates certificate from backend
   */
  public async refreshSecurity(): Promise<{ success: boolean; error?: string }> {
    this.cachedCertificate = null;
    try {
      const status = await this.checkBackendSecurityStatus();
      if (!status.configured) {
        return {
          success: false,
          error: status.isDevelopment
            ? 'خدمة التوقيع في وضع التطوير المحلي بدون مفاتيح إنتاج.'
            : 'خدمة التوقيع والشهادة غير مجهزة في متغيرات بيئة الخادم.',
        };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Subscribe to connection & security status changes
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
        ? 'خدمة الطباعة المباشرة متصلة وموقعة بأمان (QZ Tray Secure Active)'
        : this.isConnecting
        ? 'جاري الاتصال ببرنامج QZ Tray والتحقق من الشهادة...'
        : 'خدمة الطباعة المباشرة غير متصلة (QZ Tray Offline)',
      lastError: msg?.error || this.lastError,
      lastSuccessMessage: msg?.success,
      isCertificateLoaded: this.isCertificateLoaded,
      isSigningAvailable: this.isSigningAvailable,
      isDevFallback: this.isDevFallback,
      algorithm: 'SHA512',
    };
  }

  /**
   * Check if QZ Tray WebSocket connection is currently active
   */
  public isQzActive(): boolean {
    try {
      return Boolean(qz && qz.websocket && qz.websocket.isActive());
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
      // Connect to QZ Tray daemon on localhost (ports 8182/8181/443)
      await qz.websocket.connect({
        retries: 2,
        delay: 1,
        host: 'localhost',
        port: { secure: [8181, 8182, 443], insecure: [8182, 8183, 80] },
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.lastError = '';
      this.notifyListeners({ success: 'تم الاتصال ببرنامج QZ Tray بنجاح!' });
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
      return Boolean(matched);
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
      const err = `لم يتم تحديد طابعة ${
        opts.docType === 'invoice' ? 'الفواتير' : 'الباركود'
      } في إعدادات النظام. يرجى اختيار الطابعة من شاشة الإعدادات.`;
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
        const notFoundErr = `الطابعة "${printerName}" غير موجودة في نظام Windows. تحقق من اسم الطابعة وتوصيل الكابل.`;
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
        <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #000;">اختبار طابعة الفواتير (Secure Direct Print)</h3>
        <p style="font-size: 11px; margin: 5px 0;">الطابعة: <b>${printerName}</b></p>
        <p style="font-size: 11px; margin: 5px 0;">مقاس الورق: <b>${paperSize}</b></p>
        <p style="font-size: 10px; margin: 5px 0;">التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
        <p style="font-size: 10px; margin: 5px 0; color: #047857;"><b>✓ التوقيع الرقمي: مشفر بـ RSA-SHA512</b></p>
        <hr style="border-top: 1px solid #000; margin: 10px 0;" />
        <p style="font-size: 12px; font-weight: bold; margin: 0;">✓ خدمة الطباعة المباشرة الآمنة تعمل بنجاح بدون نوافذ!</p>
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
        <div style="font-size: 9px; font-weight: bold; margin: 1px 0;">صنف تجريبي (Secure)</div>
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
   * Security-specific error categorizer
   */
  private categorizeSecurityError(err: any, type: 'certificate' | 'signature'): string {
    const raw = (err?.message || String(err)).toLowerCase();

    if (raw.includes('origin_forbidden') || raw.includes('403') || raw.includes('cors')) {
      return 'النطاق الحالي غير مصرح له بطلب التوقيع الأمني (Origin Not Allowed). يرجى إضافة نطاق التطبيق إلى QZ_ALLOWED_ORIGINS على الخادم.';
    }

    if (raw.includes('signing_unavailable') || raw.includes('503') || raw.includes('private_key')) {
      return 'خدمة التوقيع غير متاحة على الخادم (/api/qz/sign): مفتاح QZ_PRIVATE_KEY غير مضاف في متغيرات البيئة.';
    }

    if (type === 'certificate') {
      return `فشل تحميل الشهادة العامة لـ QZ Tray من الخادم: ${err?.message || String(err)}`;
    }

    return `فشل التوقيع الرقمي للطلب عبر الخادم: ${err?.message || String(err)}`;
  }

  /**
   * Precise Arabic Diagnostic Resolver for All Connection & Print Cases
   */
  private categorizeError(
    err: any,
    context: 'connect' | 'findPrinters' | 'print',
    printerName?: string
  ): string {
    const rawMsg = (err?.message || String(err)).toLowerCase();

    // 1. Origin Forbidden
    if (rawMsg.includes('origin_forbidden') || rawMsg.includes('unauthorized origin') || rawMsg.includes('403')) {
      return 'تم رفض الاتصال الأمني: النطاق الحالي غير مسموح له في QZ_ALLOWED_ORIGINS على الخادم.';
    }

    // 2. Signing Service Unavailable
    if (rawMsg.includes('signing_unavailable') || rawMsg.includes('qz_private_key') || rawMsg.includes('503')) {
      return 'خدمة التوقيع الرقمي غير متاحة على الخادم: تأكد من ضبط متغير البيئة QZ_PRIVATE_KEY.';
    }

    // 3. QZ Tray Not Installed / WebSocket refused
    if (
      rawMsg.includes('connection refused') ||
      rawMsg.includes('econnrefused') ||
      rawMsg.includes('unable to establish connection') ||
      rawMsg.includes('networkerror')
    ) {
      return 'برنامج QZ Tray غير مشغل أو غير مثبت على جهاز الويندوز. تأكد من فتح برنامج QZ Tray وظهور أيقونته بجوار الساعة.';
    }

    // 4. WebSocket closed unexpectedly
    if (rawMsg.includes('closed') || rawMsg.includes('abnormal closure')) {
      return 'برنامج QZ Tray مغلق حالياً أو تم إيقافه. يرجى إعادة تشغيل برنامج QZ Tray من قائمة Start بالويندوز.';
    }

    // 5. Certificate Rejected / Untrusted
    if (rawMsg.includes('untrusted certificate') || rawMsg.includes('certificate invalid') || rawMsg.includes('expired certificate')) {
      return 'تم رفض الشهادة الرقمية من برنامج QZ Tray لأنها غير موثوقة أو منتهية الصلاحية. تأكد من صحة QZ_CERTIFICATE.';
    }

    // 6. Signature Rejected / Key mismatch
    if (rawMsg.includes('signature rejected') || rawMsg.includes('invalid signature') || rawMsg.includes('signature does not match')) {
      return 'تم رفض التوقيع الرقمي من QZ Tray: المفتاح الخاص QZ_PRIVATE_KEY لا يتطابق مع الشهادة العامة QZ_CERTIFICATE المسجلة.';
    }

    // 7. General Security Prompt / Blocked by user
    if (rawMsg.includes('blocked') || rawMsg.includes('permission denied') || rawMsg.includes('rejected')) {
      return 'تم رفض إذن الطباعة في نافذة QZ Tray المنبثقة. يرجى اختيار Always Allow / Trust.';
    }

    // 8. Printer Not Found
    if (
      rawMsg.includes('cannot find printer') ||
      rawMsg.includes('printer not found') ||
      rawMsg.includes('invalid printer') ||
      rawMsg.includes('no printer matched')
    ) {
      return `الطابعة "${printerName || ''}" غير مضافة أو غير موجودة في نظام Windows. اضغط زر "اكتشاف الطابعات" للتأكد من اسمها الصحيح.`;
    }

    // 9. Printer Offline or Spooler Error
    if (
      rawMsg.includes('offline') ||
      rawMsg.includes('spooler') ||
      rawMsg.includes('paper out') ||
      rawMsg.includes('not ready') ||
      rawMsg.includes('out of paper')
    ) {
      return `الطابعة "${printerName || ''}" غير متصلة بالكهرباء أو غير جاهزة (Offline). تحقق من كابل USB ورول الورق.`;
    }

    // 10. Generic Print Command Failure
    if (context === 'print') {
      return `فشل إرسال أمر الطباعة إلى الطابعة "${printerName || ''}": ${err?.message || String(err)}`;
    }

    return `خطأ في خدمة الطباعة: ${err?.message || String(err)}`;
  }
}

export const qzPrinterService = new QzPrinterService();
