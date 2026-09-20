import React, { useState, useEffect, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { getSupabaseKeys } from '../../lib/supabase';
import { 
  qzPrinterService, 
  PrinterServiceStatus,
  BackendSecurityCheckResult 
} from '../../services/qzPrinterService';
import { smartPrintHtml } from '../../utils/printHelper';
import {
  FUNCTION_KEYS_LIST,
  DEFAULT_SHORTCUT_KEYS,
  SHORTCUT_ACTION_LABELS,
} from '../../data/initialData';
import { ShortcutActionId, LabelCustomizationSettings } from '../../types';
import { BarcodeItem } from '../Common/BarcodeItem';
import {
  Sun,
  Moon,
  Percent,
  Printer,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Info,
  FolderPlus,
  Layout,
  Sliders,
  Sparkles,
  Database,
  Keyboard,
  Zap,
  Search,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Tag,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileCheck,
  FileText,
  ChevronLeft,
  Store,
  RefreshCw,
  Eye,
  Pencil,
  X,
  Layers,
  ArrowRightLeft,
  ScanSearch,
  Download,
} from 'lucide-react';

export type SettingsTabId =
  | 'printing'
  | 'receipt'
  | 'label_design'
  | 'margins'
  | 'categories'
  | 'shortcuts'
  | 'loyalty'
  | 'database'
  | 'appearance';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    products, 
    addCategory,
    renameCategory,
    deleteCategory,
    syncCategoriesFromProducts,
    dbStatus, 
    testDbConnection,
    transactions,
    closedShifts,
    syncUnsyncedItems,
    refreshDataFromSupabase,
    resetAndRefetchLocalData,
    clearAllProducts,
    syncStatus,
    pendingSyncCount,
    failedSyncCount,
    lastPushTime,
    lastPullTime,
    setIsSyncDetailsOpen,
    syncNow,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('printing');
  const [newCategory, setNewCategory] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editedNewName, setEditedNewName] = useState<string>('');
  const [isRenamingCat, setIsRenamingCat] = useState(false);
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [catFilterMode, setCatFilterMode] = useState<'all' | 'used' | 'empty'>('all');
  const [isSyncingCats, setIsSyncingCats] = useState(false);

  // Deletion with reassign modal state
  const [catToDelete, setCatToDelete] = useState<{ name: string; count: number } | null>(null);
  const [reassignTargetCat, setReassignTargetCat] = useState<string>('');
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [diagnosticResult, setDiagnosticResult] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isResettingLocalDb, setIsResettingLocalDb] = useState(false);

  const handleResetLocalDatabase = async () => {
    if (!window.confirm('هل أنت متأكد من تصفير قاعدة البيانات المحلية وإعادة جلب كل البيانات بالكامل من السحابة؟\n\nسيتم مسح الذاكرة المحلية وجلب أحدث البيانات والأصناف والعملاء والموردين والمبيعات طازجة ومباشرة من Supabase.')) {
      return;
    }

    setIsResettingLocalDb(true);
    try {
      const res = await resetAndRefetchLocalData();
      if (res.success) {
        setDiagnosticResult({
          success: true,
          msg: `تم تصفير البيانات المحلية وإعادة جلب البيانات بنجاح (${res.downloadedCount || 0} سجل جديد)!`,
        });
        if (typeof window !== 'undefined' && 'Notification' in window) {
          // notification feedback if available
        }
      } else {
        alert(`حدث خطأ أثناء إعادة الجلب: ${res.error?.message || 'تعذر استكمال المزامنة'}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err?.message || 'تعذر تصفير الذاكرة وإعادة جلب البيانات'}`);
    } finally {
      setIsResettingLocalDb(false);
    }
  };

  // Direct Printing Service States (QZ Tray)
  const [printerStatus, setPrinterStatus] = useState<PrinterServiceStatus>(qzPrinterService.getStatus());
  const [backendSecurity, setBackendSecurity] = useState<BackendSecurityCheckResult | null>(null);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState<boolean>(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<string[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState<boolean>(false);
  const [isTestingInvoice, setIsTestingInvoice] = useState<boolean>(false);
  const [isTestingBarcode, setIsTestingBarcode] = useState<boolean>(false);
  const [printTestResult, setPrintTestResult] = useState<{ success?: boolean; msg: string } | null>(null);
  const [showQzGuideModal, setShowQzGuideModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = qzPrinterService.subscribeStatus((st) => {
      setPrinterStatus(st);
    });
    // Auto connect attempt & backend security check
    qzPrinterService.connect().catch(() => {});
    qzPrinterService.checkBackendSecurityStatus().then(setBackendSecurity).catch(() => {});
    return () => unsubscribe();
  }, []);

  const handleRefreshSecurityDiagnostics = async () => {
    setIsCheckingSecurity(true);
    setPrintTestResult(null);
    try {
      const sec = await qzPrinterService.checkBackendSecurityStatus();
      setBackendSecurity(sec);
      const conn = await qzPrinterService.connect();
      if (conn.success) {
        setPrintTestResult({
          success: true,
          msg: 'تم الاتصال ببرنامج QZ Tray والتحقق من الشهادة والتوقيع الأمني بنجاح.',
        });
      } else {
        setPrintTestResult({
          success: false,
          msg: conn.error || 'تعذر الاتصال ببرنامج QZ Tray.',
        });
      }
    } finally {
      setIsCheckingSecurity(false);
    }
  };

  const handleDiscoverPrinters = async () => {
    setIsSearchingPrinters(true);
    setPrintTestResult(null);
    try {
      const res = await qzPrinterService.findPrinters();
      if (res.success) {
        setDiscoveredPrinters(res.printers);
        if (res.printers.length === 0) {
          setPrintTestResult({ success: false, msg: 'لم يتم العثور على أي طابعات معرفة في نظام Windows.' });
        } else {
          setPrintTestResult({ success: true, msg: `تم اكتشاف عدد (${res.printers.length}) طابعة معرفة في الويندوز بنجاح.` });
        }
      } else {
        setPrintTestResult({ success: false, msg: res.error || 'فشل اكتشاف الطابعات.' });
      }
    } finally {
      setIsSearchingPrinters(false);
    }
  };

  const handleDownloadKioskLauncher = () => {
    const cleanUrl = window.location.origin + (window.location.pathname === '/' ? '' : window.location.pathname);
    const batContent = `@echo off
chcp 65001 > nul
cls
color 0A
title نظام كاشير أسماء للأدوات المنزلية - الطباعة الصامتة المباشرة
echo ===============================================================================
echo        نظام كاشير أسماء للأدوات المنزلية - إعداد وتشغيل الطباعة الصامتة
echo ===============================================================================
echo.

:: 1. فحص نوافذ جوجل كروم السابقة لتفادي كتم وضع الطباعة الصامتة
tasklist /fi "imagename eq chrome.exe" 2>NUL | find /i /n "chrome.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [تنبيه هام]: تم اكتشاف نوافذ مفتوحة لمتصفح جوجل كروم.
    echo وضع الطباعة الصامتة (Kiosk Printing) يتطلب تشغيل كروم بأمر الطباعة الصامتة.
    echo.
    echo اضغط (1) لإغلاق كروم المفتوح وتشغيل الكاشير فوراً بوضع الطباعة الصامتة (موصى به جداً)
    echo اضغط (2) للمتابعة مع فتح ملف تعريف معزول خاص بالكاشير (دون إغلاق صفحاتك الحالية)
    set /p CHROME_CHOICE="أدخل اختيارك [1 أو 2]: "
    if "%CHROME_CHOICE%"=="1" (
        taskkill /F /IM chrome.exe /T >nul 2>&1
        echo تم إغلاق كروم السابق بنجاح.
    )
)

echo.
echo [1/3] فحص الطابعات وتحديد طابعة الفواتير الافتراضية...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$pr = Get-CimInstance Win32_Printer | Sort-Object Name;" ^
"if ($pr) {" ^
"    Write-Host '-------------------------------------------------------------------------------' -ForegroundColor DarkGray;" ^
"    Write-Host 'الطابعات المعرفة على هذا الجهاز:' -ForegroundColor Yellow;" ^
"    Write-Host '-------------------------------------------------------------------------------' -ForegroundColor DarkGray;" ^
"    for ($i=0; $i -lt $pr.Count; $i++) {" ^
"        $flag = if ($pr[$i].Default) { ' [الطابعة الافتراضية الحالية - تخرج منها الفواتير تلقائياً]' } else { '' };" ^
"        $col = if ($pr[$i].Default) { 'Green' } else { 'White' };" ^
"        Write-Host ('[{0}] {1}{2}' -f ($i+1), $pr[$i].Name, $flag) -ForegroundColor $col;" ^
"    }" ^
"    Write-Host '-------------------------------------------------------------------------------' -ForegroundColor DarkGray;" ^
"    $ch = Read-Host 'إذا كانت طابعة الفواتير ليست الافتراضية، اكتب رقمها لتعيينها (أو اضغط Enter للإبقاء)';" ^
"    if ($ch -match '^\d+$') {" ^
"        $idx = [int]$ch - 1;" ^
"        if ($idx -ge 0 -and $idx -lt $pr.Count) {" ^
"            $tName = $pr[$idx].Name;" ^
"            (New-Object -ComObject WScript.Network).SetDefaultPrinter($tName);" ^
"            Write-Host ('تم تعيين [ ' + $tName + ' ] كطابعة افتراضية للويندوز بنجاح!') -ForegroundColor Green;" ^
"        }" ^
"    }" ^
"}"

echo.
echo [2/3] إنشاء اختصار دائم للكاشير على سطح المكتب...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$desktop = [Environment]::GetFolderPath('Desktop');" ^
"$shortcutPath = Join-Path $desktop 'كاشير أسماء - طباعة صامتة.lnk';" ^
"$ws = New-Object -ComObject WScript.Shell;" ^
"$s = $ws.CreateShortcut($shortcutPath);" ^
"$cPath = '';" ^
"if (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') { $cPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }" ^
"elseif (Test-Path 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe') { $cPath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }" ^
"elseif (Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') { $cPath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }" ^
"else { $cPath = 'chrome.exe' };" ^
"$s.TargetPath = $cPath;" ^
"$dDir = Join-Path [Environment]::GetFolderPath('LocalApplicationData') 'POS_Kiosk_Chrome';" ^
"$s.Arguments = '--kiosk-printing --disable-print-preview --user-data-dir=\"' + $dDir + '\" --app=\"${cleanUrl}\"';" ^
"$s.Description = 'تشغيل كاشير أسماء بوضع الطباعة الصامتة المباشرة';" ^
"$s.Save();" ^
"Write-Host 'تم إنشاء اختصار [كاشير أسماء - طباعة صامتة] على سطح المكتب بنجاح!' -ForegroundColor Green;"

echo.
echo [3/3] جاري تشغيل شاشة الكاشير الآن بوضع الطباعة الصامتة...
echo.
set "APP_URL=${cleanUrl}"
set "DATA_DIR=%LOCALAPPDATA%\POS_Kiosk_Chrome"

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-print-preview --user-data-dir="%DATA_DIR%" --app="%APP_URL%"
    exit
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-print-preview --user-data-dir="%DATA_DIR%" --app="%APP_URL%"
    exit
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-print-preview --user-data-dir="%DATA_DIR%" --app="%APP_URL%"
    exit
)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --disable-print-preview --user-data-dir="%DATA_DIR%" --app="%APP_URL%"
    exit
)

start "" "chrome.exe" --kiosk-printing --disable-print-preview --user-data-dir="%DATA_DIR%" --app="%APP_URL%"
exit
`;

    const blob = new Blob([batContent], { type: 'application/bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'تشغيل_الكاشير_طباعة_صامتة.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTestInvoicePrinter = async () => {
    setIsTestingInvoice(true);
    setPrintTestResult(null);
    try {
      const isKiosk = (settings.printSettings.directPrintMethod || 'kiosk') === 'kiosk';
      if (isKiosk) {
        const testHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 10px; direction: rtl; font-size: 11px;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; font-weight: 900;">${settings.printSettings.headerText || 'أسماء للأدوات المنزلية'}</h3>
            <p style="margin: 2px 0; font-weight: 800;">*** تجربة الطباعة الصامتة المباشرة ***</p>
            <p style="margin: 2px 0; color: #555;">التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
            <hr style="border: 0; border-top: 1px dashed #000; margin: 8px 0;" />
            <div style="display: flex; justify-content: space-between; font-weight: 800;">
              <span>صنف تجريبي</span>
              <span>100.00 ج.م</span>
            </div>
            <hr style="border: 0; border-top: 1px dashed #000; margin: 8px 0;" />
            <div style="font-size: 13px; font-weight: 900; margin-top: 5px;">
              الإجمالي: 100.00 ج.م
            </div>
            <p style="margin-top: 10px; font-size: 10px; font-weight: bold; color: #2e7d32;">
              إذا خرج هذا الإيصال صامتاً بدون نوافذ، فالنظام جاهز تماماً للعمل!
            </p>
          </div>
        `;
        const res = await smartPrintHtml(testHtml, {
          docType: 'invoice',
          printSettings: settings.printSettings,
          pageTitle: 'تجربة-طباعة-صامتة',
          isThermalReceipt: true,
          pageCssSize: (settings.printSettings.invoicePaperSize || '80mm') + ' auto',
        });
        if (res.success) {
          setPrintTestResult({
            success: true,
            msg: 'تم إرسال الفاتورة التجريبية للطباعة الصامتة بنجاح! إذا كانت الطابعة الافتراضية متصلة فستخرج فوراً.',
          });
        } else {
          setPrintTestResult({ success: false, msg: res.message || 'تعذر إرسال الطباعة' });
        }
        return;
      }

      const targetPrinter = settings.printSettings.invoicePrinterName;
      if (!targetPrinter) {
        alert('يرجى اختيار وتحديد اسم طابعة الفواتير أولاً من القائمة.');
        return;
      }
      const res = await qzPrinterService.testInvoicePrinter(
        targetPrinter,
        settings.printSettings.invoicePaperSize || '80mm'
      );
      if (res.success) {
        setPrintTestResult({ success: true, msg: `تم إرسال طباعة تجريبية بنجاح إلى طابعة الفواتير (${targetPrinter})!` });
      } else {
        setPrintTestResult({ success: false, msg: `فشل اختبار طابعة الفواتير: ${res.error}` });
      }
    } finally {
      setIsTestingInvoice(false);
    }
  };

  const handleTestBarcodePrinter = async () => {
    setIsTestingBarcode(true);
    setPrintTestResult(null);
    try {
      const isKiosk = (settings.printSettings.directPrintMethod || 'kiosk') === 'kiosk';
      if (isKiosk) {
        const testHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 5px; direction: rtl; font-size: 11px;">
            <p style="margin: 0; font-size: 12px; font-weight: 900;">ملصق باركود تجريبي</p>
            <p style="margin: 2px 0; font-weight: 800;">1234567</p>
            <p style="margin: 0; font-size: 13px; font-weight: 900;">50.00 ج.م</p>
          </div>
        `;
        const res = await smartPrintHtml(testHtml, {
          docType: 'barcode',
          printSettings: settings.printSettings,
          pageTitle: 'تجربة-باركود',
          isThermalReceipt: true,
          pageCssSize: (settings.printSettings.barcodePaperSize || '38x25mm') + ' auto',
        });
        if (res.success) {
          setPrintTestResult({ success: true, msg: 'تم إرسال باركود تجريبي للطباعة بنجاح!' });
        } else {
          setPrintTestResult({ success: false, msg: res.message || 'تعذر إرسال الطباعة' });
        }
        return;
      }

      const targetPrinter = settings.printSettings.barcodePrinterName;
      if (!targetPrinter) {
        alert('يرجى اختيار وتحديد اسم طابعة الباركود والملصقات أولاً من القائمة.');
        return;
      }
      const res = await qzPrinterService.testBarcodePrinter(
        targetPrinter,
        settings.printSettings.barcodePaperSize || '38x25mm'
      );
      if (res.success) {
        setPrintTestResult({ success: true, msg: `تم إرسال ملصق باركود تجريبي بنجاح إلى طابعة الباركود (${targetPrinter})!` });
      } else {
        setPrintTestResult({ success: false, msg: `فشل اختبار طابعة الباركود: ${res.error}` });
      }
    } finally {
      setIsTestingBarcode(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDiagnoseConnection = async () => {
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const res = await testDbConnection();
      if (res.success) {
        setDiagnosticResult({
          success: true,
          msg: 'الاتصال بقاعدة البيانات يعمل بنجاح! تم التحقق من الجداول ومزامنة السيرفر.',
        });
      } else {
        setDiagnosticResult({
          success: false,
          msg: `فشل الاتصال: ${res.errorMessage || 'تعذر الوصول إلى قاعدة بيانات Supabase. يرجى التحقق من الشبكة.'}`,
        });
      }
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        msg: `خطأ غير متوقع: ${err?.message || String(err)}`,
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  // 1. Theme handler
  const handleThemeChange = (theme: 'dark' | 'light') => {
    updateSettings({ theme });
    triggerSuccess(`تم تفعيل المظهر ${theme === 'light' ? 'النهاري (Light Mode)' : 'الداكن (Dark Mode)'} بنجاح`);
  };

  // 2. Default margins change handler
  const handleDefaultMarginChange = (key: 'cash' | 'wholesale' | 'installment', value: number) => {
    updateSettings((prev) => ({
      ...prev,
      profitMargins: {
        ...prev.profitMargins,
        default: {
          ...prev.profitMargins.default,
          [key]: value,
        },
      },
    }));
  };

  // 3. Category margins change handler
  const handleCategoryMarginChange = (
    category: string,
    key: 'cash' | 'wholesale' | 'installment',
    value: number
  ) => {
    updateSettings((prev) => {
      const categoryMargins = { ...prev.profitMargins.categories };
      if (!categoryMargins[category]) {
        categoryMargins[category] = { ...prev.profitMargins.default };
      }
      categoryMargins[category] = {
        ...categoryMargins[category],
        [key]: value,
      };
      return {
        ...prev,
        profitMargins: {
          ...prev.profitMargins,
          categories: categoryMargins,
        },
      };
    });
  };

  // 4. Remove category custom margin
  const handleRemoveCategoryMargin = (category: string) => {
    updateSettings((prev) => {
      const categoryMargins = { ...prev.profitMargins.categories };
      delete categoryMargins[category];
      return {
        ...prev,
        profitMargins: {
          ...prev.profitMargins,
          categories: categoryMargins,
        },
      };
    });
    triggerSuccess(`تمت إعادة تعيين نسب ربح قسم "${category}" إلى النسب الافتراضية`);
  };

  // 5. Category Management Memos & Handlers
  const productCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products || []) {
      const cat = p.category?.trim();
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  // Discover categories that exist in products but are NOT in settings.categories
  const unmanagedProductCategories = useMemo(() => {
    const productCats = Object.keys(productCountsByCategory);
    return productCats.filter((cat) => !settings.categories.includes(cat));
  }, [productCountsByCategory, settings.categories]);

  // Displayed categories based on search & filter
  const displayedCategories = useMemo(() => {
    return settings.categories.filter((cat) => {
      const matchesSearch = !catSearchTerm.trim() || cat.toLowerCase().includes(catSearchTerm.trim().toLowerCase());
      if (!matchesSearch) return false;

      const count = productCountsByCategory[cat] || 0;
      if (catFilterMode === 'used') return count > 0;
      if (catFilterMode === 'empty') return count === 0;
      return true;
    });
  }, [settings.categories, catSearchTerm, catFilterMode, productCountsByCategory]);

  // Add new category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = newCategory.trim();
    if (!cleanCat) return;

    if (settings.categories.includes(cleanCat)) {
      alert('هذا القسم موجود بالفعل في قائمة الأقسام المعتمدة!');
      return;
    }

    await addCategory(cleanCat);
    setNewCategory('');
    triggerSuccess(`تم إضافة واعتماد قسم جديد: "${cleanCat}"`);
  };

  // Sync/Read categories from products
  const handleSyncCategories = async () => {
    setIsSyncingCats(true);
    try {
      const res = await syncCategoriesFromProducts();
      if (res.addedCategories.length > 0) {
        triggerSuccess(
          `تم اكتشاف واعتماد (${res.addedCategories.length}) أقسام جديدة مسجلة في الأصناف: ${res.addedCategories.join('، ')}`
        );
      } else {
        triggerSuccess(`تم فحص الأصناف بنجاح. جميع الأقسام الموجودة بالأصناف مسجلة ومعتمدة (${res.totalCategories} قسم).`);
      }
    } catch (err: any) {
      alert(`حدث خطأ أثناء فحص أقسام الأصناف: ${err?.message || 'خطأ'}`);
    } finally {
      setIsSyncingCats(false);
    }
  };

  // Start / Cancel Edit Category
  const handleStartEditCategory = (cat: string) => {
    setEditingCatName(cat);
    setEditedNewName(cat);
  };

  const handleCancelEditCategory = () => {
    setEditingCatName(null);
    setEditedNewName('');
  };

  // Save edited category and cascade to all matching products
  const handleSaveEditedCategory = async (oldCat: string) => {
    const cleanNew = editedNewName.trim();
    if (!cleanNew) {
      alert('يرجى كتابة اسم صحيح للقسم');
      return;
    }
    if (cleanNew === oldCat) {
      setEditingCatName(null);
      return;
    }

    if (settings.categories.includes(cleanNew)) {
      const proceed = window.confirm(
        `القسم "${cleanNew}" موجود بالفعل.\n\nهل ترغب في دمج قسم "${oldCat}" مع قسم "${cleanNew}"؟\nسيتم تحديث جميع الأصناف المسجلة في "${oldCat}" لتصبح تابعة للقسم "${cleanNew}".`
      );
      if (!proceed) return;
    }

    setIsRenamingCat(true);
    try {
      const res = await renameCategory(oldCat, cleanNew);
      if (res.success) {
        triggerSuccess(
          `تم تعديل اسم القسم إلى "${cleanNew}" بنجاح، وتحديث (${res.updatedProductsCount}) صنف مرتبط به تلقائياً!`
        );
        setEditingCatName(null);
        setEditedNewName('');
      }
    } catch (err: any) {
      alert(`فشل تعديل اسم القسم: ${err?.message || 'خطأ غير متوقع'}`);
    } finally {
      setIsRenamingCat(false);
    }
  };

  // Delete category or prompt reassign
  const handleRequestDeleteCategory = (cat: string) => {
    const count = productCountsByCategory[cat] || 0;
    if (count === 0) {
      if (confirm(`هل أنت متأكد من حذف قسم "${cat}"؟`)) {
        deleteCategory(cat).then(() => {
          triggerSuccess(`تم حذف قسم "${cat}" بنجاح`);
        });
      }
    } else {
      const otherCats = settings.categories.filter((c) => c !== cat);
      setReassignTargetCat(otherCats[0] || 'عام / بدون قسم');
      setCatToDelete({ name: cat, count });
    }
  };

  const handleConfirmDeleteWithReassign = async () => {
    if (!catToDelete) return;
    if (!reassignTargetCat) {
      alert('يرجى اختيار القسم البديل لنقل الأصناف إليه');
      return;
    }

    setIsDeletingCat(true);
    try {
      const res = await deleteCategory(catToDelete.name, reassignTargetCat);
      if (res.success) {
        triggerSuccess(
          `تم نقل عدد (${res.reassignedProductsCount}) صنف إلى قسم "${reassignTargetCat}" وحذف قسم "${catToDelete.name}" بنجاح!`
        );
        setCatToDelete(null);
      }
    } catch (err: any) {
      alert(`تعذر حذف القسم: ${err?.message || 'خطأ'}`);
    } finally {
      setIsDeletingCat(false);
    }
  };

  // 7. Print settings handler
  const handlePrintSettingChange = (key: keyof typeof settings.printSettings, value: any) => {
    updateSettings((prev) => ({
      ...prev,
      printSettings: {
        ...prev.printSettings,
        [key]: value,
      },
    }));
  };

  const handleLabelCustomizationChange = (
    key: keyof LabelCustomizationSettings,
    value: any
  ) => {
    updateSettings((prev) => ({
      ...prev,
      printSettings: {
        ...prev.printSettings,
        labelCustomization: {
          ...(prev.printSettings.labelCustomization || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleResetLabelCustomization = () => {
    updateSettings((prev) => ({
      ...prev,
      printSettings: {
        ...prev.printSettings,
        labelCustomization: {
          storeNameFontSize: 10,
          storeNameFontWeight: '900',
          productNameFontSize: 13,
          productNameFontWeight: '900',
          priceFontSize: 15,
          priceFontWeight: '900',
          barcodeCodeFontSize: 9,
          barcodeCodeFontWeight: '900',
          barcodeHeight: 16,
        },
      },
    }));
    triggerSuccess('تم إعادة ضبط خطوط ملصق الأسعار إلى القيم الافتراضية');
  };

  const labelCustomization: LabelCustomizationSettings = {
    storeNameFontSize: settings.printSettings.labelCustomization?.storeNameFontSize ?? 10,
    storeNameFontWeight: settings.printSettings.labelCustomization?.storeNameFontWeight ?? '900',

    productNameFontSize: settings.printSettings.labelCustomization?.productNameFontSize ?? 13,
    productNameFontWeight: settings.printSettings.labelCustomization?.productNameFontWeight ?? '900',

    priceFontSize: settings.printSettings.labelCustomization?.priceFontSize ?? 15,
    priceFontWeight: settings.printSettings.labelCustomization?.priceFontWeight ?? '900',

    barcodeCodeFontSize: settings.printSettings.labelCustomization?.barcodeCodeFontSize ?? 9,
    barcodeCodeFontWeight: settings.printSettings.labelCustomization?.barcodeCodeFontWeight ?? '900',

    barcodeHeight: settings.printSettings.labelCustomization?.barcodeHeight ?? 16,
  };

  // 8. Keyboard Shortcuts (F1 - F12) Handlers
  const activeShortcutMap = {
    ...DEFAULT_SHORTCUT_KEYS,
    ...(settings.shortcutKeys || {}),
  };

  const handleShortcutKeyChange = (key: string, actionId: ShortcutActionId) => {
    updateSettings((prev) => ({
      ...prev,
      shortcutKeys: {
        ...DEFAULT_SHORTCUT_KEYS,
        ...(prev.shortcutKeys || {}),
        [key]: actionId,
      },
    }));
    triggerSuccess(`تم حفظ اختصار الزر ${key}: "${SHORTCUT_ACTION_LABELS[actionId]?.label || actionId}"`);
  };

  const handleResetShortcuts = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين جميع مفاتيح الاختصارات F1-F12 للإعدادات الافتراضية؟')) {
      updateSettings((prev) => ({
        ...prev,
        shortcutKeys: DEFAULT_SHORTCUT_KEYS,
      }));
      triggerSuccess('تمت إعادة تعيين مفاتيح الاختصارات للافتراضية بنجاح.');
    }
  };

  // Unsynced count calculation
  const pendingTxs = transactions.filter((t) => !t.isSynced).length;
  const pendingShifts = closedShifts.filter((s) => !s.isSynced).length;
  const totalPendingSync = pendingTxs + pendingShifts;

  // Sidebar Menu Items
  const sidebarTabs: {
    id: SettingsTabId;
    label: string;
    icon: React.ElementType;
    description: string;
    badge?: string;
    badgeColor?: string;
  }[] = [
    {
      id: 'printing',
      label: 'الطباعة المباشرة و QZ Tray',
      icon: Zap,
      description: 'طابعات الكاشير والباركود والأمان والتوقيع المشفر',
      badge: printerStatus.isConnected ? 'متصل' : 'غير متصل',
      badgeColor: printerStatus.isConnected
        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
        : 'bg-stone-900 text-stone-400 border border-stone-800',
    },
    {
      id: 'receipt',
      label: 'تصميم وشكل الفاتورة',
      icon: FileText,
      description: 'ترويسة المتجر، العنوان، الهواتف، ورمز QR',
    },
    {
      id: 'label_design',
      label: 'تخصيص ملصق الأسعار (الاستيكر)',
      icon: Tag,
      description: 'حجم وثقل الخط لكل خانة بالملصق على حدة',
      badge: 'تخصيص الخطوط',
      badgeColor: 'bg-amber-950 text-amber-300 border border-amber-800',
    },
    {
      id: 'margins',
      label: 'نسب الأرباح والتسعير',
      icon: Percent,
      description: 'النسب التلقائية للكاش والجملة والتقسيط',
    },
    {
      id: 'categories',
      label: 'أقسام وتصنيفات الأصناف',
      icon: FolderPlus,
      description: 'إضافة وتنظيم وحذف أقسام المنتجات',
      badge: `${settings.categories.length}`,
      badgeColor: 'bg-stone-900 text-amber-400 border border-stone-800',
    },
    {
      id: 'shortcuts',
      label: 'اختصارات الكيبورد (F1-F12)',
      icon: Keyboard,
      description: 'تخصيص أزرار الوظائف للعمليات والمهام السريعة',
    },
    {
      id: 'loyalty',
      label: 'نظام نقاط الولاء للعملاء',
      icon: Sparkles,
      description: 'معدل كسب النقاط وقيمتها المالية بالجنيه',
    },
    {
      id: 'database',
      label: 'قاعدة البيانات والمزامنة',
      icon: Database,
      description: 'حالة الربط السحابي ومراقبة السجلات المعلقة',
      badge: totalPendingSync > 0 ? `${totalPendingSync} معلق` : 'متزامن',
      badgeColor: totalPendingSync > 0
        ? 'bg-rose-950 text-rose-300 border border-rose-800'
        : 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    },
    {
      id: 'appearance',
      label: 'المظهر والواجهة',
      icon: Sun,
      description: 'التبديل بين المظهر الداكن والنهاري للواجهة',
      badge: settings.theme === 'light' ? 'نهاري' : 'داكن',
      badgeColor: 'bg-stone-900 text-stone-300 border border-stone-800',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 text-stone-100" dir="rtl">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3 border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-500 font-bold mb-1">
            <Sliders className="w-4 h-4" />
            <span>لوحة التحكم في إعدادات النظام</span>
            <span className="text-stone-600">/</span>
            <span className="text-stone-300">
              {sidebarTabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-stone-100">
            {sidebarTabs.find((t) => t.id === activeTab)?.label}
          </h1>
        </div>

        {successMessage && (
          <div className="bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-pulse flex items-center gap-1.5 shadow-md">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Main Layout: Sidebar on right + Content Panel on left */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0">
          
          {/* Mobile Tab Scroller (Horizontal on small screens) */}
          <div className="lg:hidden flex overflow-x-auto gap-1.5 pb-2 mb-3 no-scrollbar">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border ${
                    isActive
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800 hover:bg-stone-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Sidebar (Vertical on large screens) */}
          <div className="hidden lg:block bg-stone-900 border border-stone-800 rounded-2xl p-2.5 shadow-md space-y-1.5 sticky top-20">
            <div className="px-3 py-2 text-[11px] font-black text-stone-400 uppercase tracking-wider border-b border-stone-800/80 mb-1 flex items-center justify-between">
              <span>أقسام الإعدادات</span>
              <span className="text-[10px] text-amber-500 font-mono">8 أقسام</span>
            </div>

            <nav className="space-y-1">
              {sidebarTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all group ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40 font-bold'
                        : 'bg-stone-950/40 hover:bg-stone-800/80 text-stone-300 border border-stone-850 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 transition-colors ${
                          isActive
                            ? 'bg-amber-700 text-white'
                            : 'bg-stone-900 text-amber-400 group-hover:text-amber-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">{tab.label}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isActive ? 'text-amber-100/80' : 'text-stone-500 group-hover:text-stone-400'
                          }`}
                        >
                          {tab.description}
                        </div>
                      </div>
                    </div>

                    {tab.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mr-1.5 ${
                          isActive
                            ? 'bg-amber-800 text-amber-100'
                            : tab.badgeColor || 'bg-stone-900 text-stone-400'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Subtle Store Info Box in Sidebar Footer */}
            <div className="mt-3 pt-3 border-t border-stone-800/80 px-2 text-[10px] text-stone-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-stone-400" />
                <span>أسماء للأدوات المنزلية</span>
              </span>
              <span className="font-mono text-stone-400">v2.5</span>
            </div>
          </div>
        </aside>

        {/* MAIN SETTINGS CONTENT PANEL */}
        <main className="flex-1 w-full min-w-0">
          
          {/* TAB 1: DIRECT PRINTING & QZ TRAY */}
          {activeTab === 'printing' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
                <div>
                  <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>نظام الطباعة المباشرة الصامتة (QZ Tray Silent Printing)</span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    إرسال أوامر الفواتير وملصقات الباركود إلى طابعات Windows مباشرة دون ظهور نافذة الطباعة.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshSecurityDiagnostics}
                    disabled={isCheckingSecurity}
                    className="text-stone-300 hover:text-amber-400 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 transition-colors flex items-center gap-1.5 text-xs font-bold border border-stone-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSecurity ? 'animate-spin text-amber-400' : ''}`} />
                    <span>فحص الأمان والاتصال</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQzGuideModal(true)}
                    className="text-stone-300 hover:text-amber-400 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 transition-colors flex items-center gap-1.5 text-xs font-bold border border-stone-700"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>دليل التشغيل</span>
                  </button>
                </div>
              </div>

              {/* 5-Item Security & Connection Diagnostic Card */}
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-stone-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>لوحة التشخيص الأمني المتقدم لـ QZ Tray (5 مؤشرات حيوية):</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">RSA-SHA512 Security Layer</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {/* Item 1: QZ Tray Connected */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    printerStatus.isConnected
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3.5 h-3.5 ${printerStatus.isConnected ? 'text-emerald-400' : 'text-stone-500'}`} />
                      <span className="font-bold">1. اتصال QZ Tray:</span>
                    </div>
                    <span className="font-mono font-black text-[11px]">
                      {printerStatus.isConnected ? 'متصل بنجاح ✓' : 'غير متصل ✕'}
                    </span>
                  </div>

                  {/* Item 2: Certificate Loaded */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    backendSecurity?.hasCertificate || printerStatus.isCertificateLoaded
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <FileCheck className={`w-3.5 h-3.5 ${backendSecurity?.hasCertificate ? 'text-emerald-400' : 'text-stone-500'}`} />
                      <span className="font-bold">2. شهادة الأمان (Cert):</span>
                    </div>
                    <span className="font-mono font-black text-[11px]">
                      {backendSecurity?.hasCertificate ? 'مُحمّلة (X.509) ✓' : 'غير متوفرة ✕'}
                    </span>
                  </div>

                  {/* Item 3: Signing Service Available */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    backendSecurity?.configured
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <KeyRound className={`w-3.5 h-3.5 ${backendSecurity?.configured ? 'text-emerald-400' : 'text-stone-500'}`} />
                      <span className="font-bold">3. خدمة التوقيع (SHA512):</span>
                    </div>
                    <span className="font-mono font-black text-[11px]">
                      {backendSecurity?.configured ? 'جاهزة ومشفرة ✓' : 'غير مهيأة ✕'}
                    </span>
                  </div>

                  {/* Item 4: Selected Invoice Printer */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    settings.printSettings.invoicePrinterName
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Printer className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold truncate">4. طابعة الفواتير:</span>
                    </div>
                    <span className="font-bold text-[11px] truncate mr-2">
                      {settings.printSettings.invoicePrinterName || 'لم تُحدد بعد'}
                    </span>
                  </div>

                  {/* Item 5: Selected Barcode Printer */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    settings.printSettings.barcodePrinterName
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold truncate">5. طابعة الباركود:</span>
                    </div>
                    <span className="font-bold text-[11px] truncate mr-2">
                      {settings.printSettings.barcodePrinterName || 'لم تُحدد بعد'}
                    </span>
                  </div>

                  {/* Diagnostic Summary */}
                  <div className="p-2.5 rounded-lg border bg-stone-900 border-stone-800 flex items-center justify-between text-stone-300">
                    <span className="font-bold">نظام التوجيه التلقائي:</span>
                    <span className="font-bold text-[11px] text-amber-400">
                      {printerStatus.isConnected ? 'QZ صامت مباشر' : 'نافذة النظام (Fallback)'}
                    </span>
                  </div>
                </div>

                {backendSecurity?.isDevFallback && (
                  <div className="text-[11px] bg-amber-950/30 border border-amber-900/40 p-2 rounded-lg text-amber-300 leading-relaxed font-bold">
                    💡 <b>ملاحظة بيئة التطوير:</b> يتم استخدام شهادة تنموية افتراضية مولدة ذاتياً مع مفتاح خاص محمي على السيرفر لتشغيل QZ Tray محلياً. عند النشر للإنتاج، يمكن إضافة المتغيرات <code>QZ_PRIVATE_KEY</code> و <code>QZ_CERTIFICATE</code>.
                  </div>
                )}
              </div>

              {/* Method Selection: Kiosk Printing (No software) vs QZ Tray */}
              <div className="p-4 bg-stone-950 rounded-xl border border-stone-850 space-y-3">
                <label className="block text-xs font-extrabold text-stone-200">
                  طريقة الطباعة الصامتة المباشرة (Direct Print Engine):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePrintSettingChange('directPrintMethod', 'kiosk')}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      (settings.printSettings.directPrintMethod || 'kiosk') === 'kiosk'
                        ? 'bg-amber-600/15 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-xs">وضع Kiosk Printing (جوجل كروم)</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                        موصى به (بدون برامج)
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-400">
                      طباعة فورية وصامتة 100% مباشرة إلى طابعة الفواتير الافتراضية بدون تثبيت QZ Tray أو أي برامج أخرى نهائياً.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSettingChange('directPrintMethod', 'qz-tray')}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      settings.printSettings.directPrintMethod === 'qz-tray'
                        ? 'bg-amber-600/15 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-xs">برنامج QZ Tray</span>
                      <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded font-bold">
                        برنامج وسيط
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-400">
                      يتطلب تشغيل برنامج QZ Tray بالخلفية بجوار الساعة لتوجيه الطباعة لطابعة معينة بالاسم.
                    </p>
                  </button>
                </div>
              </div>

              {/* Kiosk Mode Fast Launcher Banner */}
              {(settings.printSettings.directPrintMethod || 'kiosk') === 'kiosk' && (
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-amber-300">
                          مشغل وضع الطباعة الصامتة الذكي (بديل QZ Tray بدون أي برامج):
                        </h4>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                          تم التحديث لتفادي نافذة الويندوز 100%
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-300 leading-relaxed mt-1">
                        يقوم هذا المشغل بفتح الكاشير بوضع <code className="bg-stone-900 px-1.5 py-0.5 rounded text-amber-400 font-mono">--kiosk-printing</code> المباشر، مع عزل كامل لجلسة الكاشير وتعيين طابعة الفواتير الافتراضية تلقائياً لمنع أي نافذة طباعة نهائياً.
                      </p>
                    </div>
                  </div>

                  {/* Why window appeared note & steps */}
                  <div className="p-3 bg-stone-950/80 rounded-xl border border-stone-800 text-[11px] space-y-1.5 text-stone-300">
                    <div className="font-extrabold text-amber-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      <span>لماذا قد تظهر نافذة الويندوز وكيف يحلها المشغل الجديد؟</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-stone-400 pr-1">
                      <li>
                        <strong className="text-stone-200">إذا كان كروم مفتوحاً مسبقاً:</strong> يتجاهل كروم أمر الطباعة الصامتة. المشغل الجديد يمنحك خيار إغلاق كروم أو فتحه بملف معزول يضمن تطبيق الطباعة الصامتة 100%.
                      </li>
                      <li>
                        <strong className="text-stone-200">الطابعة الافتراضية:</strong> يجب أن تكون طابعة الفواتير الحرارية هي الافتراضية في الويندوز، والمشغل يعرضها لك ويتيح ضبطها بنقرة واحدة.
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadKioskLauncher}
                        className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg active:scale-98"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل مشغل الكاشير المحدث (.bat)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTestInvoicePrinter}
                        disabled={isTestingInvoice}
                        className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-stone-700 active:scale-98 disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isTestingInvoice ? 'جاري الإرسال...' : 'تجربة طباعة فورية'}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-stone-400">
                      ينشئ أيقونة «كاشير أسماء - طباعة صامتة» على سطح المكتب
                    </span>
                  </div>
                </div>
              )}

              {/* Suppress Windows Print Dialog Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-stone-950 rounded-xl border border-stone-850">
                <div>
                  <span className="text-xs font-extrabold text-stone-200 block">
                    كتم نافذة طباعة الويندوز نهائياً (عدم إظهار نافذة الطباعة إذا تعذر الاتصال)
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    عند التفعيل، لن تظهر نافذة طباعة الويندوز المزعجة أبداً، وسيتم إرسال الطباعة فقط عبر القناة الصامتة.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printSettings.suppressWindowsPrintDialog === true}
                  onChange={(e) =>
                    handlePrintSettingChange('suppressWindowsPrintDialog', e.target.checked)
                  }
                  className="w-5 h-5 rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-stone-950 rounded-xl border border-stone-850">
                <div>
                  <span className="text-xs font-extrabold text-stone-200 block">
                    تفعيل الطباعة الصامتة المباشرة (Direct Printing Enabled)
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    عند التفعيل، تُرسل الفاتورة أو الباركود تلقائياً للطابعة المحددة دون فتح نافذة Windows Print.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printSettings.directPrintEnabled !== false}
                  onChange={(e) =>
                    handlePrintSettingChange('directPrintEnabled', e.target.checked)
                  }
                  className="w-5 h-5 rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Silent Print & Bypass Receipt Modal */}
              <div className="flex items-center justify-between p-3.5 bg-stone-950 rounded-xl border border-amber-500/30 bg-amber-950/10">
                <div>
                  <span className="text-xs font-extrabold text-amber-300 block">
                    الطباعة الصامتة الفورية وتخطي شاشة معاينة الفاتورة بعد الدفع
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    إلغاء شاشة طباعة الفاتورة الثانية بعد الدفع، وإرسال الفاتورة تلقائياً للطباعة الصامتة بمجرد الضغط على إتمام عملية البيع.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printSettings.silentPrintInvoice !== false}
                  onChange={(e) =>
                    handlePrintSettingChange('silentPrintInvoice', e.target.checked)
                  }
                  className="w-5 h-5 rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Discover Windows Printers Button */}
              <div>
                <button
                  type="button"
                  onClick={handleDiscoverPrinters}
                  disabled={isSearchingPrinters}
                  className="w-full py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-100 border border-stone-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Search className={`w-4 h-4 text-amber-400 ${isSearchingPrinters ? 'animate-spin' : ''}`} />
                  <span>
                    {isSearchingPrinters
                      ? 'جاري فحص واكتشاف طابعات الويندوز عبر QZ Tray...'
                      : 'اكتشاف الطابعات المتاحة في جهاز الكاشير (Windows)'}
                  </span>
                </button>
              </div>

              {/* Printers Assignment Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Invoice Printer Assignment */}
                <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 space-y-3">
                  <label className="block text-stone-300 text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-amber-500" />
                      <span>طابعة الفواتير (INVOICE_PRINTER):</span>
                    </span>
                    <span className="text-[10px] text-stone-500">طابعة الكاشير الحرارية</span>
                  </label>

                  {discoveredPrinters.length > 0 ? (
                    <select
                      value={settings.printSettings.invoicePrinterName || ''}
                      onChange={(e) =>
                        handlePrintSettingChange('invoicePrinterName', e.target.value)
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="">-- اختر طابعة الفواتير --</option>
                      {discoveredPrinters.map((pName) => (
                        <option key={`inv_prn_${pName}`} value={pName}>
                          {pName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="اسم طابعة الفواتير (مثال: POS-80 أو XP-80)"
                      value={settings.printSettings.invoicePrinterName || ''}
                      onChange={(e) =>
                        handlePrintSettingChange('invoicePrinterName', e.target.value)
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-stone-400 font-bold mb-1">مقاس الورق:</label>
                      <select
                        value={settings.printSettings.invoicePaperSize || '80mm'}
                        onChange={(e) =>
                          handlePrintSettingChange('invoicePaperSize', e.target.value)
                        }
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-200 text-xs font-bold"
                      >
                        <option value="80mm">حراري 80mm</option>
                        <option value="58mm">حراري 58mm</option>
                        <option value="A4">A4 قياسي</option>
                        <option value="A5">A5 قياسي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 font-bold mb-1">عدد النسخ:</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={settings.printSettings.invoiceCopies || 1}
                        onChange={(e) =>
                          handlePrintSettingChange(
                            'invoiceCopies',
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-200 text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestInvoicePrinter}
                    disabled={isTestingInvoice}
                    className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {isTestingInvoice
                        ? 'جاري طباعة الاختبار...'
                        : 'اختبار طابعة الفواتير (Test Invoice Printer)'}
                    </span>
                  </button>
                </div>

                {/* Barcode Printer Assignment */}
                <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 space-y-3">
                  <label className="block text-stone-300 text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-amber-500" />
                      <span>طابعة الباركود (BARCODE_PRINTER):</span>
                    </span>
                    <span className="text-[10px] text-stone-500">طابعة ملصقات الاستيكر</span>
                  </label>

                  {discoveredPrinters.length > 0 ? (
                    <select
                      value={settings.printSettings.barcodePrinterName || ''}
                      onChange={(e) =>
                        handlePrintSettingChange('barcodePrinterName', e.target.value)
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="">-- اختر طابعة الباركود --</option>
                      {discoveredPrinters.map((pName) => (
                        <option key={`bar_prn_${pName}`} value={pName}>
                          {pName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="اسم طابعة الباركود (مثال: Xprinter XP-365B)"
                      value={settings.printSettings.barcodePrinterName || ''}
                      onChange={(e) =>
                        handlePrintSettingChange('barcodePrinterName', e.target.value)
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-stone-400 font-bold mb-1">مقاس الملصق:</label>
                      <select
                        value={settings.printSettings.barcodePaperSize || '38x25mm'}
                        onChange={(e) =>
                          handlePrintSettingChange('barcodePaperSize', e.target.value)
                        }
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-200 text-xs font-bold"
                      >
                        <option value="38x25mm">38mm x 25mm (قياسي)</option>
                        <option value="40x25mm">40mm x 25mm</option>
                        <option value="50x25mm">50mm x 25mm</option>
                        <option value="50x30mm">50mm x 30mm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 font-bold mb-1">عدد النسخ:</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.printSettings.barcodeCopies || 1}
                        onChange={(e) =>
                          handlePrintSettingChange(
                            'barcodeCopies',
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-200 text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestBarcodePrinter}
                    disabled={isTestingBarcode}
                    className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      {isTestingBarcode
                        ? 'جاري طباعة الباركود التجريبي...'
                        : 'اختبار طابعة الباركود (Test Barcode Printer)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('label_design')}
                    className="w-full py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>تعديل أحجام وخطوط ملصق الأسعار (Customize Price Label Typography)</span>
                  </button>
                </div>

              </div>

              {/* Test Print Feedback Banner */}
              {printTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                    printTestResult.success
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  {printTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="leading-relaxed">{printTestResult.msg}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECEIPT CUSTOMIZATION */}
          {activeTab === 'receipt' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-stone-800">
                <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  <span>تخصيص شكل وتصميم طباعة الفاتورة</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  تعديل النصوص والشعار وأرقام الهاتف التي تظهر للعميل في فاتورة البيع المطبوعة.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">نوع طباعة الفاتورة الافتراضي:</label>
                  <select
                    value={settings.printSettings.receiptType}
                    onChange={(e) => handlePrintSettingChange('receiptType', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="thermal">فاتورة كاشير حرارية (Thermal 80mm)</option>
                    <option value="a4">فاتورة مقاس A4 قياسي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">عنوان ترويسة الفاتورة (Header Text):</label>
                  <input
                    type="text"
                    value={settings.printSettings.headerText}
                    onChange={(e) => handlePrintSettingChange('headerText', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">عنوان المتجر / الفرع:</label>
                  <input
                    type="text"
                    placeholder="اخر شارع المدارس امام دار المناسبات حى الصفا"
                    value={settings.printSettings.address || ''}
                    onChange={(e) => handlePrintSettingChange('address', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">أرقام الهواتف والتواصل:</label>
                  <input
                    type="text"
                    placeholder="01229028133 - 01222334884"
                    value={settings.printSettings.phoneNumbers || ''}
                    onChange={(e) => handlePrintSettingChange('phoneNumbers', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-stone-300 text-xs mb-1 font-bold">رابط صفحة فيسبوك للباركود (Facebook URL):</label>
                  <input
                    type="text"
                    placeholder="https://facebook.com/your-page"
                    value={settings.printSettings.facebookUrl || ''}
                    onChange={(e) => handlePrintSettingChange('facebookUrl', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">رسالة التذييل (Footer):</label>
                  <input
                    type="text"
                    value={settings.printSettings.footerText}
                    onChange={(e) => handlePrintSettingChange('footerText', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 text-xs mb-1 font-bold">السطر الإضافي أسفل التذييل (بالإنجليزية):</label>
                  <input
                    type="text"
                    placeholder="visit us again"
                    value={settings.printSettings.footerSubText || ''}
                    onChange={(e) => handlePrintSettingChange('footerSubText', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-3 border-t border-stone-800">
                <h3 className="text-xs font-black text-stone-300">خيارات عرض العناصر الإضافية على الفاتورة:</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer hover:border-stone-700">
                    <span className="text-xs text-stone-300 font-bold">اسم / كود البائع</span>
                    <input
                      type="checkbox"
                      checked={settings.printSettings.showSellerCode}
                      onChange={(e) => handlePrintSettingChange('showSellerCode', e.target.checked)}
                      className="w-4 h-4 rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer hover:border-stone-700">
                    <span className="text-xs text-stone-300 font-bold">رمز QR السريع</span>
                    <input
                      type="checkbox"
                      checked={settings.printSettings.showQRCode}
                      onChange={(e) => handlePrintSettingChange('showQRCode', e.target.checked)}
                      className="w-4 h-4 rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer hover:border-stone-700">
                    <span className="text-xs text-stone-300 font-bold">شعار المحل أعلى الفاتورة</span>
                    <input
                      type="checkbox"
                      checked={settings.printSettings.showLogo}
                      onChange={(e) => handlePrintSettingChange('showLogo', e.target.checked)}
                      className="w-4 h-4 rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRICE LABEL CUSTOMIZATION */}
          {activeTab === 'label_design' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-6">
              <div className="pb-4 border-b border-stone-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span>تخصيص خطوط وأحجام ملصق الأسعار والباركود</span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    التحكم الكامل في حجم الخط (Font Size) وثقل الخط (Font Weight) لكل خانة بشكل مستقل للطباعة بدقة عالية.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetLabelCustomization}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-300 rounded-xl text-xs font-bold border border-stone-700 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>إعادة الخطوط للافتراضي</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Controls Panel */}
                <div className="lg:col-span-7 space-y-4">
                  {/* 1. Store Header Controls */}
                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>1. اسم المحل / المتجر (Store Header):</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {labelCustomization.storeNameFontSize}px
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">حجم الخط (px):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="6"
                            max="24"
                            step="0.5"
                            value={labelCustomization.storeNameFontSize}
                            onChange={(e) => handleLabelCustomizationChange('storeNameFontSize', parseFloat(e.target.value))}
                            className="w-full accent-amber-500 bg-stone-900 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="6"
                            max="24"
                            step="0.5"
                            value={labelCustomization.storeNameFontSize}
                            onChange={(e) => handleLabelCustomizationChange('storeNameFontSize', Math.max(6, parseFloat(e.target.value) || 6))}
                            className="w-16 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-bold text-center text-stone-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">ثقل الخط (Font Weight):</label>
                        <select
                          value={labelCustomization.storeNameFontWeight}
                          onChange={(e) => handleLabelCustomizationChange('storeNameFontWeight', e.target.value as any)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-100"
                        >
                          <option value="900">أسود عريض جداً (Black - 900)</option>
                          <option value="bold">عريض (Bold - 700)</option>
                          <option value="normal">عادي (Normal - 400)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 2. Product Name Controls */}
                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>2. اسم الصنف / المنتج (Product Title):</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {labelCustomization.productNameFontSize}px
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">حجم الخط (px):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="6"
                            max="26"
                            step="0.5"
                            value={labelCustomization.productNameFontSize}
                            onChange={(e) => handleLabelCustomizationChange('productNameFontSize', parseFloat(e.target.value))}
                            className="w-full accent-amber-500 bg-stone-900 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="6"
                            max="26"
                            step="0.5"
                            value={labelCustomization.productNameFontSize}
                            onChange={(e) => handleLabelCustomizationChange('productNameFontSize', Math.max(6, parseFloat(e.target.value) || 6))}
                            className="w-16 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-bold text-center text-stone-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">ثقل الخط (Font Weight):</label>
                        <select
                          value={labelCustomization.productNameFontWeight}
                          onChange={(e) => handleLabelCustomizationChange('productNameFontWeight', e.target.value as any)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-100"
                        >
                          <option value="900">أسود عريض جداً (Black - 900)</option>
                          <option value="bold">عريض (Bold - 700)</option>
                          <option value="normal">عادي (Normal - 400)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 3. Price Controls */}
                  <div className="bg-stone-950 border border-amber-900/40 p-4 rounded-xl space-y-2 ring-1 ring-amber-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>3. سعر الصنف (Price Field):</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {labelCustomization.priceFontSize}px
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">حجم خط السعر (px):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="8"
                            max="32"
                            step="0.5"
                            value={labelCustomization.priceFontSize}
                            onChange={(e) => handleLabelCustomizationChange('priceFontSize', parseFloat(e.target.value))}
                            className="w-full accent-amber-500 bg-stone-900 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="8"
                            max="32"
                            step="0.5"
                            value={labelCustomization.priceFontSize}
                            onChange={(e) => handleLabelCustomizationChange('priceFontSize', Math.max(8, parseFloat(e.target.value) || 8))}
                            className="w-16 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-bold text-center text-amber-300"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">ثقل خط السعر (Font Weight):</label>
                        <select
                          value={labelCustomization.priceFontWeight}
                          onChange={(e) => handleLabelCustomizationChange('priceFontWeight', e.target.value as any)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-100"
                        >
                          <option value="900">أسود عريض جداً (Black - 900)</option>
                          <option value="bold">عريض (Bold - 700)</option>
                          <option value="normal">عادي (Normal - 400)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 4. Barcode Code Controls */}
                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>4. رقم الباركود / الكود (Barcode Number):</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {labelCustomization.barcodeCodeFontSize}px
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">حجم خط الكود (px):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="5"
                            max="18"
                            step="0.5"
                            value={labelCustomization.barcodeCodeFontSize}
                            onChange={(e) => handleLabelCustomizationChange('barcodeCodeFontSize', parseFloat(e.target.value))}
                            className="w-full accent-amber-500 bg-stone-900 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="5"
                            max="18"
                            step="0.5"
                            value={labelCustomization.barcodeCodeFontSize}
                            onChange={(e) => handleLabelCustomizationChange('barcodeCodeFontSize', Math.max(5, parseFloat(e.target.value) || 5))}
                            className="w-16 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-bold text-center text-stone-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 mb-1 font-bold">ثقل خط الكود (Font Weight):</label>
                        <select
                          value={labelCustomization.barcodeCodeFontWeight}
                          onChange={(e) => handleLabelCustomizationChange('barcodeCodeFontWeight', e.target.value as any)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-100"
                        >
                          <option value="900">أسود عريض جداً (Black - 900)</option>
                          <option value="bold">عريض (Bold - 700)</option>
                          <option value="normal">عادي (Normal - 400)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 5. Barcode Height Control */}
                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>5. ارتفاع رسم خطوط الباركود (Barcode Height):</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {labelCustomization.barcodeHeight}px
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1 font-bold">ارتفاع الرسم (px):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="8"
                          max="40"
                          step="1"
                          value={labelCustomization.barcodeHeight}
                          onChange={(e) => handleLabelCustomizationChange('barcodeHeight', parseInt(e.target.value))}
                          className="w-full accent-amber-500 bg-stone-900 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="8"
                          max="40"
                          value={labelCustomization.barcodeHeight}
                          onChange={(e) => handleLabelCustomizationChange('barcodeHeight', Math.max(8, parseInt(e.target.value) || 8))}
                          className="w-16 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-bold text-center text-stone-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Interactive Sticker Preview Box */}
                <div className="lg:col-span-5 flex flex-col items-center justify-start space-y-3 bg-stone-950 p-5 rounded-2xl border border-stone-800">
                  <div className="w-full flex items-center justify-between pb-2 border-b border-stone-850">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Eye className="w-4 h-4" />
                      <span>معاينة الاستيكر الحية والمباشرة</span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">38mm × 25mm</span>
                  </div>

                  <p className="text-[11px] text-stone-400 text-center leading-tight">
                    تتغير الأبعاد والأحجام أمامك فوراً أثناء تعديل أي قيمة:
                  </p>

                  {/* Realistic Label Card */}
                  <div className="p-4 bg-stone-900 rounded-2xl border border-stone-800 shadow-xl flex items-center justify-center w-full my-2">
                    <div
                      className="bg-white text-black rounded p-2 shadow-2xl border border-stone-300 flex flex-col justify-between items-center text-center select-none overflow-hidden box-border"
                      style={{
                        width: '210px',
                        height: '140px',
                      }}
                    >
                      {/* Header */}
                      <div className="w-full border-b border-black/30 pb-0.5">
                        <h5
                          className="tracking-wide text-black leading-tight truncate text-center"
                          style={{
                            fontSize: `${labelCustomization.storeNameFontSize}px`,
                            fontWeight: labelCustomization.storeNameFontWeight === 'normal' ? 400 : labelCustomization.storeNameFontWeight === 'bold' ? 700 : 900,
                          }}
                        >
                          {settings.printSettings.headerText || 'أسماء للأدوات المنزليه'}
                        </h5>
                      </div>

                      {/* Title */}
                      <div className="w-full px-0.5 pt-0.5">
                        <h4
                          className="text-black leading-tight line-clamp-1 text-center"
                          style={{
                            fontSize: `${labelCustomization.productNameFontSize}px`,
                            fontWeight: labelCustomization.productNameFontWeight === 'normal' ? 400 : labelCustomization.productNameFontWeight === 'bold' ? 700 : 900,
                          }}
                        >
                          طقم حلة صاج 5 قطع تورنيدو
                        </h4>
                      </div>

                      {/* Barcode & Code */}
                      <div className="w-full my-0 py-0 flex flex-col items-center justify-center space-y-0">
                        <BarcodeItem
                          value="2026001122"
                          height={labelCustomization.barcodeHeight}
                          width={1.4}
                          fontSize={labelCustomization.barcodeCodeFontSize}
                          displayValue={false}
                        />
                        <span
                          className="font-mono tracking-wider text-black text-center select-none block leading-none -mt-2"
                          style={{
                            fontSize: `${labelCustomization.barcodeCodeFontSize}px`,
                            lineHeight: 1,
                            fontWeight: labelCustomization.barcodeCodeFontWeight === 'normal' ? 400 : labelCustomization.barcodeCodeFontWeight === 'bold' ? 700 : 900,
                          }}
                        >
                          2026001122
                        </span>
                      </div>

                      {/* Price */}
                      <div className="w-full flex flex-col items-center justify-center text-black leading-tight space-y-0.5 pb-0.5">
                        <div
                          style={{
                            fontSize: `${labelCustomization.priceFontSize}px`,
                            fontWeight: labelCustomization.priceFontWeight === 'normal' ? 400 : labelCustomization.priceFontWeight === 'bold' ? 700 : 900,
                          }}
                        >
                          <span>السعر : </span>
                          <span className="font-mono mx-1">1,250.0</span>
                          <span>ج</span>
                        </div>
                        <div
                          className="font-mono text-black"
                          style={{
                            fontSize: `calc(${labelCustomization.priceFontSize}px - 2px)`,
                            fontWeight: labelCustomization.priceFontWeight === 'normal' ? 400 : labelCustomization.priceFontWeight === 'bold' ? 700 : 900,
                          }}
                        >
                          #1,450.0
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-stone-900 p-3 rounded-xl border border-stone-800 text-[11px] text-stone-300 space-y-1">
                    <p className="font-bold text-amber-400">💡 معلومة هامة للطباعة الممتازة:</p>
                    <p>
                      تطبق هذه الخطوط والأحجام فوراً على جميع طابعات الباركود الحرارية وعلى نافذة المعاينة والطباعة المباشرة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROFIT MARGINS & PRICING */}
          {activeTab === 'margins' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-stone-800">
                <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  <span>تحديد نسب الربح التلقائية (Automated Pricing)</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  يقوم النظام باحتساب أسعار البيع (كاش، جملة، تقسيط) تلقائياً عند إدخال سعر التكلفة لأي صنف بناءً على هذه النسب المئوية.
                </p>
              </div>

              {/* Default Margins Card */}
              <div className="border border-stone-800 bg-stone-950/60 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>نسب الأرباح الافتراضية لجميع المنتجات:</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-400 text-xs mb-1 font-bold">نسبة ربح الكاش (%):</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.profitMargins.default.cash}
                        onChange={(e) => handleDefaultMarginChange('cash', parseFloat(e.target.value) || 0)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none text-center font-bold"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-400 text-xs mb-1 font-bold">نسبة ربح الجملة (%):</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.profitMargins.default.wholesale}
                        onChange={(e) => handleDefaultMarginChange('wholesale', parseFloat(e.target.value) || 0)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none text-center font-bold"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-400 text-xs mb-1 font-bold">نسبة ربح التقسيط (%):</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.profitMargins.default.installment}
                        onChange={(e) => handleDefaultMarginChange('installment', parseFloat(e.target.value) || 0)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none text-center font-bold"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category-specific margins table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-200 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-stone-400" />
                  <span>تخصيص نسب ربح مستقلة لكل قسم (اختياري):</span>
                </h3>
                
                <div className="overflow-x-auto border border-stone-800 rounded-xl">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-950 text-stone-400 font-extrabold border-b border-stone-800">
                        <th className="py-2.5 px-3">القسم / التصنيف</th>
                        <th className="py-2.5 px-3 text-center">نسبة الكاش (%)</th>
                        <th className="py-2.5 px-3 text-center">نسبة الجملة (%)</th>
                        <th className="py-2.5 px-3 text-center">نسبة التقسيط (%)</th>
                        <th className="py-2.5 px-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/50">
                      {settings.categories.map((cat) => {
                        const hasCustom = !!settings.profitMargins.categories[cat];
                        const margins = settings.profitMargins.categories[cat] || settings.profitMargins.default;

                        return (
                          <tr key={cat} className="hover:bg-stone-950/30">
                            <td className="py-2 px-3 font-bold text-stone-300">
                              <div className="flex items-center gap-1.5">
                                <span>{cat}</span>
                                {hasCustom ? (
                                  <span className="bg-amber-950 text-amber-400 text-[9px] px-1.5 py-0.2 rounded border border-amber-900/60 font-bold">مخصص</span>
                                ) : (
                                  <span className="text-stone-500 text-[9px] font-medium">(الافتراضي)</span>
                                )}
                              </div>
                            </td>
                            <td className="py-1 px-3 text-center">
                              <input
                                type="number"
                                value={margins.cash}
                                onChange={(e) => handleCategoryMarginChange(cat, 'cash', parseFloat(e.target.value) || 0)}
                                className={`w-16 bg-stone-950 border border-stone-800 rounded-lg py-1 px-1.5 text-center font-mono font-bold text-xs ${
                                  hasCustom ? 'text-amber-400 border-amber-900/40' : 'text-stone-400'
                                }`}
                              />
                            </td>
                            <td className="py-1 px-3 text-center">
                              <input
                                type="number"
                                value={margins.wholesale}
                                onChange={(e) => handleCategoryMarginChange(cat, 'wholesale', parseFloat(e.target.value) || 0)}
                                className={`w-16 bg-stone-950 border border-stone-800 rounded-lg py-1 px-1.5 text-center font-mono font-bold text-xs ${
                                  hasCustom ? 'text-amber-400 border-amber-900/40' : 'text-stone-400'
                                }`}
                              />
                            </td>
                            <td className="py-1 px-3 text-center">
                              <input
                                type="number"
                                value={margins.installment}
                                onChange={(e) => handleCategoryMarginChange(cat, 'installment', parseFloat(e.target.value) || 0)}
                                className={`w-16 bg-stone-950 border border-stone-800 rounded-lg py-1 px-1.5 text-center font-mono font-bold text-xs ${
                                  hasCustom ? 'text-amber-400 border-amber-900/40' : 'text-stone-400'
                                }`}
                              />
                            </td>
                            <td className="py-1 px-3 text-center">
                              {hasCustom ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCategoryMargin(cat)}
                                  className="text-stone-400 hover:text-rose-400 p-1 rounded-lg hover:bg-stone-950 transition-colors"
                                  title="إعادة تعيين للنسب الافتراضية"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCategoryMarginChange(cat, 'cash', settings.profitMargins.default.cash)}
                                  className="text-stone-400 hover:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-stone-800 hover:border-amber-800 bg-stone-950/40"
                                >
                                  تخصيص
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCT CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
                <div>
                  <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                    <FolderPlus className="w-4 h-4" />
                    <span>إضافة وإدارة أقسام المنتجات (Categories)</span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    إضافة أقسام جديدة، قراءة وفحص الأقسام المسجلة في الأصناف، تعديل وتسمية الأقسام مع التحديث التلقائي لكافة الأصناف المرتبطة.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncCategories}
                  disabled={isSyncingCats}
                  className="px-3.5 py-2 bg-stone-950 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 shadow-sm disabled:opacity-50"
                  title="فحص الأصناف وقراءة أي أقسام غير مسجلة واعتمادها"
                >
                  <ScanSearch className={`w-4 h-4 ${isSyncingCats ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCats ? 'جارٍ الفحص...' : 'قراءة وفحص أقسام الأصناف'}</span>
                </button>
              </div>

              {/* Smart Alert for Unmanaged Categories in Products */}
              {unmanagedProductCategories.length > 0 && (
                <div className="bg-gradient-to-r from-amber-950/40 to-stone-950 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>تم العثور على ({unmanagedProductCategories.length}) أقسام مسجلة في الأصناف غير معتمدة بالقائمة:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {unmanagedProductCategories.map((c) => (
                        <span key={`unmanaged_${c}`} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold">
                          {c} ({productCountsByCategory[c]} صنف)
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncCategories}
                    disabled={isSyncingCats}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-black transition-colors shrink-0 shadow flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>اعتماد واستيراد الأقسام الآن</span>
                  </button>
                </div>
              )}

              {/* Statistics Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-stone-500 font-bold block">الأقسام المعتمدة</span>
                  <span className="text-base font-black text-stone-100 font-mono mt-0.5 block">
                    {settings.categories.length}
                  </span>
                </div>
                <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-stone-500 font-bold block">أقسام مستخدمة فعلياً</span>
                  <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                    {Object.keys(productCountsByCategory).length}
                  </span>
                </div>
                <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-stone-500 font-bold block">أصناف مصنفة بالمخزن</span>
                  <span className="text-base font-black text-amber-400 font-mono mt-0.5 block">
                    {(products || []).filter((p) => p.category?.trim()).length}
                  </span>
                </div>
                <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-stone-500 font-bold block">أقسام خالية (0 صنف)</span>
                  <span className="text-base font-black text-stone-400 font-mono mt-0.5 block">
                    {settings.categories.filter((c) => !productCountsByCategory[c]).length}
                  </span>
                </div>
              </div>

              {/* Add category form */}
              <div className="bg-stone-950 border border-stone-800/80 p-3.5 rounded-xl space-y-2">
                <label className="text-xs font-bold text-stone-300 block">إضافة قسم جديد إلى النظام:</label>
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="اكتب اسم القسم الجديد (مثال: أدوات المطبخ الذكية، مستلزمات الشاي والقهوة...)"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة القسم</span>
                  </button>
                </form>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catSearchTerm}
                    onChange={(e) => setCatSearchTerm(e.target.value)}
                    placeholder="ابحث عن قسم..."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      catFilterMode === 'all'
                        ? 'bg-amber-500/20 text-amber-300 font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    الكل ({settings.categories.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatFilterMode('used')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      catFilterMode === 'used'
                        ? 'bg-emerald-500/20 text-emerald-300 font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    مستخدمة فقط ({Object.keys(productCountsByCategory).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatFilterMode('empty')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      catFilterMode === 'empty'
                        ? 'bg-stone-800 text-stone-200 font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    خالية ({settings.categories.filter((c) => !productCountsByCategory[c]).length})
                  </button>
                </div>
              </div>

              {/* Categories list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-400">
                  <span>الأقسام المعروضة ({displayedCategories.length} قسم):</span>
                  {catSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setCatSearchTerm('')}
                      className="text-amber-500 hover:underline text-[11px]"
                    >
                      مسح البحث
                    </button>
                  )}
                </div>
                
                {displayedCategories.length === 0 ? (
                  <div className="p-8 text-center bg-stone-950 border border-stone-800/60 rounded-xl text-stone-500 text-xs">
                    لا توجد أقسام تطابق معايير البحث الحالية.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {displayedCategories.map((cat) => {
                      const productCount = productCountsByCategory[cat] || 0;
                      const hasCustomMargin = !!settings.profitMargins.categories[cat];
                      const isEditing = editingCatName === cat;

                      if (isEditing) {
                        return (
                          <div
                            key={`editing_${cat}`}
                            className="bg-stone-950 border-2 border-amber-500 p-3 rounded-xl text-xs space-y-2.5 shadow-lg animate-in fade-in"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                                <Pencil className="w-3 h-3" />
                                <span>تعديل اسم القسم:</span>
                              </span>
                              <span className="text-[10px] text-stone-400 font-bold">
                                {productCount} صنف مرتبط
                              </span>
                            </div>

                            <input
                              type="text"
                              value={editedNewName}
                              onChange={(e) => setEditedNewName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditedCategory(cat);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditCategory();
                                }
                              }}
                              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-100 text-xs font-black focus:outline-none focus:border-amber-400"
                            />

                            <p className="text-[10px] text-amber-300/80 leading-relaxed">
                              💡 سيتم تلقائياً تحديث اسم القسم في جميع الأصناف المرتبطة ({productCount} صنف) في قاعدة البيانات والمزامنة.
                            </p>

                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEditCategory}
                                disabled={isRenamingCat}
                                className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>إلغاء</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditedCategory(cat)}
                                disabled={isRenamingCat}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isRenamingCat ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={cat}
                          className="flex items-center justify-between bg-stone-950 border border-stone-800 hover:border-stone-700 p-3 rounded-xl text-xs transition-colors group"
                        >
                          <div className="space-y-1 min-w-0 flex-1 pr-1">
                            <div className="font-black text-stone-200 truncate flex items-center gap-1.5">
                              <span>{cat}</span>
                              {hasCustomMargin && (
                                <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
                                  هامش مخصص
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  productCount > 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-stone-900 text-stone-500 border border-stone-800'
                                }`}
                              >
                                {productCount > 0 ? `${productCount} صنف مسجل` : 'خالي (0 صنف)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Edit category name button */}
                            <button
                              type="button"
                              onClick={() => handleStartEditCategory(cat)}
                              className="text-stone-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-stone-900 transition-colors"
                              title="تعديل اسم هذا القسم وتحديث الأصناف المرتبطة"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete category button */}
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteCategory(cat)}
                              className="text-stone-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-stone-900 transition-colors"
                              title={productCount > 0 ? 'نقل الأصناف وحذف القسم' : 'حذف هذا القسم'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reassign & Delete Modal */}
              {catToDelete && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-stone-100">
                          نقل أصناف وحذف قسم: "{catToDelete.name}"
                        </h3>
                        <p className="text-xs text-stone-400 mt-1">
                          هذا القسم يحتوي حالياً على <span className="text-amber-400 font-bold">({catToDelete.count})</span> صنف مسجل. لنقل هذه الأصناف إلى قسم آخر قبل حذف هذا القسم:
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-300 mb-1.5">
                        اختر القسم البديل لنقل الأصناف إليه:
                      </label>
                      <select
                        value={reassignTargetCat}
                        onChange={(e) => setReassignTargetCat(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none"
                      >
                        {settings.categories
                          .filter((c) => c !== catToDelete.name)
                          .map((c) => (
                            <option key={`reassign_${c}`} value={c}>
                              {c} ({productCountsByCategory[c] || 0} صنف حالي)
                            </option>
                          ))}
                        <option value="عام / بدون قسم">عام / بدون قسم</option>
                      </select>
                    </div>

                    <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-[11px] text-stone-400 space-y-1">
                      <p>• سيتم تعديل قسم جميع الـ {catToDelete.count} صنف إلى القسم المحدد أعلاه.</p>
                      <p>• سيتم حذف قسم "{catToDelete.name}" نهائياً من إعدادات الأقسام.</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                      <button
                        type="button"
                        onClick={() => setCatToDelete(null)}
                        disabled={isDeletingCat}
                        className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteWithReassign}
                        disabled={isDeletingCat}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeletingCat ? 'جارٍ النقل والحذف...' : 'تأكيد النقل وحذف القسم'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: KEYBOARD SHORTCUTS F1 - F12 */}
          {activeTab === 'shortcuts' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
                <div>
                  <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-amber-500" />
                    <span>تخصيص أزرار الاختصارات السريعة (F1 إلى F12)</span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    تعيين وظائف الأزرار لسرعة إنجاز الفواتير، الدفع السريع، تسديد الأقساط، والمصروفات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetShortcuts}
                  className="px-3 py-1.5 bg-stone-950 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>إعادة للافتراضي</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FUNCTION_KEYS_LIST.map((keyName) => {
                  const currentAction = activeShortcutMap[keyName] || 'none';
                  const actionInfo = SHORTCUT_ACTION_LABELS[currentAction];

                  return (
                    <div
                      key={keyName}
                      className="bg-stone-950/80 border border-stone-800 hover:border-amber-500/40 p-3 rounded-xl transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-black text-xs rounded-lg shadow-sm">
                            {keyName}
                          </span>
                          <span className="text-xs font-bold text-stone-200">
                            {actionInfo?.label || 'غير مفعّل'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <select
                          value={currentAction}
                          onChange={(e) => handleShortcutKeyChange(keyName, e.target.value as ShortcutActionId)}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                        >
                          {(Object.keys(SHORTCUT_ACTION_LABELS) as ShortcutActionId[]).map((actId) => (
                            <option key={`${keyName}_${actId}`} value={actId}>
                              {SHORTCUT_ACTION_LABELS[actId].label}
                            </option>
                          ))}
                        </select>
                        {actionInfo?.description && (
                          <p className="text-[10px] text-stone-500 mt-1 leading-tight">
                            {actionInfo.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: LOYALTY POINTS */}
          {activeTab === 'loyalty' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-stone-800">
                <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>إعدادات نظام نقاط الولاء للعملاء</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  اضبط قيمة النقاط وعدد الجنيهات المطلوبة للحصول على كل نقطة واستبدالها في الفاتورة.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <label className="block text-stone-300 text-xs font-bold">معدل اكتساب النقاط (جنيه لكل نقطة):</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={settings.loyaltyPointsRatio ?? 10}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        updateSettings({ loyaltyPointsRatio: val });
                        triggerSuccess(`تم تحديث معدل النقاط: نقطة واحدة لكل ${val} جنيه شراء.`);
                      }}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                    <span className="absolute left-3 top-2 text-[10px] text-stone-500 font-bold">ج.م = 1 نقطة</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">يحصل العميل على نقطة واحدة مقابل كل X جنيه ينفقها في المشتريات.</p>
                </div>

                <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <label className="block text-stone-300 text-xs font-bold">سعر/قيمة النقطة الواحدة بالجنيه:</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.loyaltyPointValue ?? 0.1}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        updateSettings({ loyaltyPointValue: val });
                        triggerSuccess(`تم تحديث قيمة النقطة: ${val} جنيه لكل نقطة مستردة.`);
                      }}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                    <span className="absolute left-3 top-2 text-[10px] text-stone-500 font-bold">ج.م لكل نقطة</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">القيمة النقدية المخصومة من الفاتورة عند استبدال النقاط.</p>
                </div>
              </div>

              {/* Example calculation box */}
              <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl text-xs text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>مثال عملي على الإعدادات الحالية:</span>
                </span>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  عند شراء العميل بمبلغ <b>1000 جنيه</b>، يحصل على <b>{Math.floor(1000 / (settings.loyaltyPointsRatio || 10))} نقطة</b>، وعند استبدالها في فاتورة تالية تخصم له بقيمة <b>{(Math.floor(1000 / (settings.loyaltyPointsRatio || 10)) * (settings.loyaltyPointValue || 0.1)).toFixed(2)} جنيه</b>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 7: CLOUD DATABASE & SYNC */}
          {activeTab === 'database' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-stone-800">
                <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  <span>قاعدة البيانات السحابية المركزية (Supabase)</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  مراقبة اتصال السحابة، رفع العمليات والورديات المعلقة، والتحقق من تطابق القيود المحاسبية.
                </p>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-xl border text-xs ${
                dbStatus.isChecking
                  ? 'bg-amber-950/30 border-amber-800 text-amber-300'
                  : dbStatus.isConnected
                    ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800 text-rose-300'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>حالة الاتصال السحابي:</span>
                  </span>
                  <span className="font-mono px-2 py-0.5 rounded text-[11px] bg-stone-950 font-bold">
                    {dbStatus.isChecking ? 'جاري الفحص...' : dbStatus.isConnected ? 'متصل بنجاح ✓' : 'غير متصل ✕'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {dbStatus.isChecking
                    ? 'جاري فحص الاتصال ومطابقة البيانات مع السيرفر السحابي...'
                    : dbStatus.isConnected
                      ? 'الربط السحابي نشط ومعتمد. جميع العمليات الجديدة تسجل بشكل فوري في قاعدة البيانات المركزية.'
                      : `تنبيه: لا توجد استجابة من قاعدة البيانات. تفاصيل: ${dbStatus.errorMessage || 'يرجى التحقق من اتصال الإنترنت.'}`}
                </p>
              </div>

              {/* Test Connection Button */}
              <div>
                <button
                  type="button"
                  onClick={handleDiagnoseConnection}
                  disabled={isDiagnosing || dbStatus.isChecking}
                  className="w-full px-4 py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{isDiagnosing ? 'جاري الفحص ومطابقة الجداول...' : 'اختبار الاتصال بقاعدة البيانات السحابية'}</span>
                </button>
              </div>

              {/* Diagnostic Result Banner */}
              {diagnosticResult && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                  diagnosticResult.success
                    ? 'bg-emerald-950/50 border-emerald-900 text-emerald-400'
                    : 'bg-rose-950/50 border-rose-900 text-rose-400'
                }`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{diagnosticResult.msg}</span>
                </div>
              )}

              {/* Queue Monitor */}
              <div className="border-t border-stone-800 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span>طابور المزامنة والعمليات المعلقة:</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850">
                    <div className="text-[11px] text-stone-400 font-bold">الفواتير والمبيعات</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-stone-100">{transactions.length}</span>
                      <span className="text-[10px] font-bold text-stone-500">
                        معلق: <span className={transactions.filter(t => !t.isSynced).length > 0 ? "text-rose-400 font-black" : "text-emerald-400"}>
                          {transactions.filter(t => !t.isSynced).length}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="bg-stone-950 p-3 rounded-xl border border-stone-850">
                    <div className="text-[11px] text-stone-400 font-bold">الورديات المقفلة</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-stone-100">{closedShifts.length}</span>
                      <span className="text-[10px] font-bold text-stone-500">
                        معلق: <span className={closedShifts.filter(s => !s.isSynced).length > 0 ? "text-rose-400 font-black" : "text-emerald-400"}>
                          {closedShifts.filter(s => !s.isSynced).length}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {totalPendingSync > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-xl text-xs text-rose-300 font-bold">
                      تنبيه: هناك ({totalPendingSync}) عمليات معلقة في الذاكرة لم ترفع إلى السحابة بعد.
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await syncUnsyncedItems();
                          triggerSuccess('تم بدء عملية مزامنة البيانات المعلقة...');
                        } catch {
                          alert('حدث خطأ أثناء المزامنة.');
                        }
                      }}
                      disabled={dbStatus.isChecking}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${dbStatus.isChecking ? 'animate-spin' : ''}`} />
                      <span>{dbStatus.isChecking ? 'جاري الرفع والمزامنة...' : `مزامنة البيانات المعلقة الآن (${totalPendingSync})`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>جميع العمليات والبيانات متطابقة ومتزامنة بالكامل مع السحابة. ✨</span>
                  </div>
                )}

                {/* Additional Sync Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSyncDetailsOpen(true)}
                    className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>فتح نافذة تفاصيل المزامنة وسجل الأخطاء</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await syncNow();
                      triggerSuccess(`تم بدء عملية المزامنة اليدوية الشاملة.`);
                    }}
                    className="py-2.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    <span>بدء مزامنة يدوية فورية (Push & Pull)</span>
                  </button>
                </div>

                {/* Reset Local DB & Refetch All Action */}
                <div className="pt-3 border-t border-stone-850 space-y-2">
                  <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-xl text-xs space-y-1 text-amber-200">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <RefreshCw className="w-4 h-4 text-amber-400" />
                      <span>تصفير قاعدة البيانات المحلية وإعادة جلب كل البيانات</span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      يقوم هذا الزر بتفريغ ذاكرة الكاش والجداول المحلية (Dexie IndexedDB) بالكامل، ثم إعادة جلب كافة الأصناف، العملاء، الموردين، والمبيعات طازجة ومباشرة من قاعدة بيانات Supabase المركزية.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetLocalDatabase}
                    disabled={isResettingLocalDb || dbStatus.isChecking}
                    className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 active:scale-98"
                  >
                    <RefreshCw className={`w-4 h-4 ${isResettingLocalDb ? 'animate-spin' : ''}`} />
                    <span>
                      {isResettingLocalDb
                        ? 'جاري تصفير البيانات المحلية وإعادة بناء قاعدة البيانات...'
                        : 'تصفير قاعدة البيانات المحلية وإعادة جلب كل البيانات'}
                    </span>
                  </button>
                </div>

                {/* Danger Zone: Clear products */}
                {products.length > 0 && (
                  <div className="pt-4 border-t border-stone-850">
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('هل أنت متأكد من مسح كافة الأصناف بالكامل من قاعدة البيانات؟')) {
                          await clearAllProducts();
                          triggerSuccess('تم تفريغ ومسح جميع الأصناف من قاعدة البيانات بنجاح.');
                        }
                      }}
                      className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح وتفريغ قائمة الأصناف من قاعدة البيانات ({products.length} صنف)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-stone-800">
                <h2 className="text-sm font-black text-amber-500 flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  <span>مظهر النظام (Theme Mode)</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  اختر مظهر واجهة المستخدم المفضل لجهاز الكاشير للعمل اليومي المريح.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    settings.theme === 'dark'
                      ? 'bg-amber-600/10 border-amber-500 text-amber-400 font-bold shadow-md ring-1 ring-amber-500/50'
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-400'
                  }`}
                >
                  <div className="p-3 rounded-full bg-stone-900 text-amber-400 mb-1">
                    <Moon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-black">المظهر الداكن (Dark Mode)</span>
                  <span className="text-[11px] text-stone-500 text-center">
                    مناسب للإضاءة الخافتة وتقليل إجهاد العين أثناء العمل الطويل
                  </span>
                  {settings.theme === 'dark' && (
                    <span className="mt-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      المظهر النشط حالياً ✓
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    settings.theme === 'light'
                      ? 'bg-amber-600/10 border-amber-500 text-amber-400 font-bold shadow-md ring-1 ring-amber-500/50'
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-400'
                  }`}
                >
                  <div className="p-3 rounded-full bg-stone-900 text-amber-400 mb-1">
                    <Sun className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-black">المظهر النهاري (Light Mode)</span>
                  <span className="text-[11px] text-stone-500 text-center">
                    ألوان فاتحة عالية التباين مناسبة للأماكن ذات الإضاءة الساطعة
                  </span>
                  {settings.theme === 'light' && (
                    <span className="mt-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      المظهر النشط حالياً ✓
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* QZ Tray Setup Guide Modal */}
      {showQzGuideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>دليل تشغيل خدمة الطباعة المباشرة QZ Tray</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQzGuideModal(false)}
                className="text-stone-400 hover:text-stone-100 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300 leading-relaxed">
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                <p className="font-bold text-amber-400">لماذا نستخدم QZ Tray؟</p>
                <p className="text-stone-400 text-[11px]">
                  برنامج QZ Tray هو جسر طباعة آمن وموثوق لنظام Windows يمنع ظهور نافذة "Windows Print Dialog" عند كل عملية بيع أو طباعة باركود، مما يتيح الطباعة المباشرة الصامتة على طابعات الكاشير والباركود.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-stone-100">خطوات التشغيل والأمان على جهاز الكاشير (Windows):</p>
                <ol className="list-decimal list-inside space-y-1.5 text-stone-300 text-[11px]">
                  <li>قم بتحميل وتثبيت برنامج QZ Tray من الموقع الرسمي: <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="text-amber-400 underline font-mono">qz.io/download</a></li>
                  <li>افتح برنامج QZ Tray من قائمة Start في الويندوز (سيظهر رمز الجسر الأخضر بجوار الساعة).</li>
                  <li>عند الاتصال لأول مرة، ستظهر نافذة أمان من QZ Tray تطلب الموافقة على الشهادة الرقمية الموقعة: اختر <b className="text-amber-400">"Remember this decision"</b> ثم اضغط <b className="text-emerald-400">"Allow" / "Trust"</b>.</li>
                  <li>اضغط على زر <b className="text-amber-400">"اكتشاف الطابعات المتاحة"</b> في الإعدادات.</li>
                  <li>اختر طابعة الفواتير (طابعة الكاشير) وطابعة الباركود (طابعة الاستيكر).</li>
                  <li>اضغط على أزرار الاختبار للتحقق من خروج الورق/الاستيكر فوراً مع التوقيع الرقمي الآمن (SHA-512).</li>
                </ol>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 space-y-1 text-[11px]">
                <p className="font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>الأمان وحماية المفاتيح الرقمية:</span>
                </p>
                <p className="text-stone-400 text-[10px] leading-relaxed">
                  يتم توقيع طلبات الطباعة رقمياً بخوارزمية RSA-SHA512 عبر الخادم الآمن حصرياً، والمفتاح الخاص QZ_PRIVATE_KEY محمي تماماً على السيرفر ولا يتم تسريبه أو إرساله للمتصفح إطلاقاً.
                </p>
              </div>

              <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl text-[11px] text-amber-300">
                <p className="font-bold mb-0.5">ملاحظة التوجيه التلقائي (Fallback):</p>
                <p>إذا تم إغلاق برنامج QZ Tray أو توقف الخدمة لأي سبب، سيتعرف النظام تلقائياً على ذلك ويوجه أوامر الطباعة فوراً إلى نافذة الطباعة القياسية بدون تعطيل حركة المبيعات.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQzGuideModal(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-black rounded-xl text-xs transition-colors"
              >
                تم، فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
