import qz from 'qz-tray';

export interface QzPrintResult {
  success: boolean;
  message: string;
  error?: any;
  printerUsed?: string;
}

export interface QzPrintOptions {
  printerName: string;
  htmlContent: string;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
  jobName?: string;
}

let isConnecting = false;

/**
 * Checks if the QZ Tray WebSocket connection is currently open and active.
 */
export function isQzActive(): boolean {
  try {
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/**
 * Connects to QZ Tray on localhost (ports 8182/8181).
 * Uses a safe timeout so the UI never freezes if QZ Tray is not running.
 */
export async function connectQz(timeoutMs: number = 3000): Promise<boolean> {
  if (isQzActive()) {
    return true;
  }

  if (isConnecting) {
    // Wait for in-flight connection attempt
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (isQzActive()) return true;
    }
  }

  isConnecting = true;
  try {
    const connectPromise = qz.websocket.connect({
      host: 'localhost',
      retries: 0,
      delay: 0,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الاتصال ببرنامج QZ Tray')), timeoutMs)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    return isQzActive();
  } catch (err) {
    console.warn('QZ Tray connection check failed (is QZ Tray running?):', err);
    return false;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnects from QZ Tray gracefully.
 */
export async function disconnectQz(): Promise<void> {
  try {
    if (isQzActive()) {
      await qz.websocket.disconnect();
    }
  } catch (err) {
    console.warn('Error disconnecting QZ Tray:', err);
  }
}

/**
 * Retrieves the full list of installed printers from the Windows operating system.
 * Returns an array of printer names (e.g. ['XP-80C (copy 3)', 'Xprinter XP-370B', ...]).
 */
export async function getSystemPrinters(): Promise<string[]> {
  try {
    const connected = await connectQz(2500);
    if (!connected) {
      return [];
    }
    const printers = await qz.printers.find();
    if (Array.isArray(printers)) {
      return printers;
    } else if (typeof printers === 'string') {
      return [printers];
    }
    return [];
  } catch (err) {
    console.warn('Failed to retrieve system printers via QZ Tray:', err);
    return [];
  }
}

/**
 * Finds a printer by name or fuzzy match among installed Windows printers.
 */
export async function findMatchingPrinter(targetName: string): Promise<string | null> {
  if (!targetName || targetName.trim() === '') return null;
  const printers = await getSystemPrinters();
  if (!printers || printers.length === 0) return null;

  const cleanTarget = targetName.trim().toLowerCase();

  // 1. Exact match
  const exact = printers.find((p) => p.toLowerCase() === cleanTarget);
  if (exact) return exact;

  // 2. Contains match
  const contains = printers.find((p) => p.toLowerCase().includes(cleanTarget));
  if (contains) return contains;

  // 3. Reverse contains match
  const rev = printers.find((p) => cleanTarget.includes(p.toLowerCase()));
  if (rev) return rev;

  return null;
}

/**
 * Prints HTML directly to a specific named printer in Windows using QZ Tray.
 * Completely independent of the Windows default printer!
 */
export async function printHtmlToNamedPrinter(
  options: QzPrintOptions
): Promise<QzPrintResult> {
  const { printerName, htmlContent, widthMm, heightMm, copies = 1, jobName = 'مستند كاشير' } = options;

  if (!printerName || printerName.trim() === '') {
    return {
      success: false,
      message: 'لم يتم تحديد اسم الطابعة لإرسال أمر الطباعة.',
    };
  }

  const connected = await connectQz(3500);
  if (!connected) {
    return {
      success: false,
      message: 'برنامج QZ Tray غير متصل. يرجى تشغيل برنامج QZ Tray على جهاز الكمبيوتر.',
    };
  }

  try {
    // Find the exact printer name from system
    const matchedPrinter = (await findMatchingPrinter(printerName)) || printerName;

    // Build QZ config for the specific printer
    const configOptions: any = {
      jobName,
      copies: Math.max(1, copies),
      rasterize: true,
      units: 'mm',
    };

    if (widthMm && heightMm) {
      configOptions.size = { width: widthMm, height: heightMm };
    } else if (widthMm) {
      configOptions.size = { width: widthMm };
    }

    const config = qz.configs.create(matchedPrinter, configOptions);

    // Prepare pixel/HTML data
    const printData: qz.PrintData[] = [
      {
        type: 'pixel',
        format: 'html',
        flavor: 'plain',
        data: htmlContent,
      },
    ];

    await qz.print(config, printData);

    return {
      success: true,
      message: `تم إرسال أمر الطباعة بنجاح إلى الطابعة: [${matchedPrinter}]`,
      printerUsed: matchedPrinter,
    };
  } catch (err: any) {
    console.error('QZ Tray direct print error:', err);
    return {
      success: false,
      message: err?.message || `فشل إرسال الطباعة إلى الطابعة: [${printerName}]`,
      error: err,
    };
  }
}
