import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { getSupabaseKeys } from '../../lib/supabase';
import {
  FUNCTION_KEYS_LIST,
  DEFAULT_SHORTCUT_KEYS,
  SHORTCUT_ACTION_LABELS,
} from '../../data/initialData';
import { ShortcutActionId } from '../../types';
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
  Command,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    products, 
    dbStatus, 
    testDbConnection,
    transactions,
    closedShifts,
    syncUnsyncedItems,
    refreshDataFromSupabase,
    clearAllProducts,
  } = usePOS();
  const [newCategory, setNewCategory] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [diagnosticResult, setDiagnosticResult] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

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

  // 5. Add new category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = newCategory.trim();
    if (!cleanCat) return;

    if (settings.categories.includes(cleanCat)) {
      alert('هذا القسم موجود بالفعل!');
      return;
    }

    updateSettings((prev) => ({
      ...prev,
      categories: [...prev.categories, cleanCat],
    }));
    setNewCategory('');
    triggerSuccess(`تم إضافة قسم جديد: "${cleanCat}"`);
  };

  // 6. Delete category
  const handleDeleteCategory = (cat: string) => {
    // Check if any product is currently using this category
    const count = products.filter((p) => p.category === cat).length;
    if (count > 0) {
      alert(`لا يمكن حذف هذا القسم لأنه يحتوي على عدد (${count}) من المنتجات المضافة. قم بتغيير قسم المنتجات أولاً.`);
      return;
    }

    if (confirm(`هل أنت متأكد من حذف قسم "${cat}"؟`)) {
      updateSettings((prev) => {
        const nextCats = prev.categories.filter((c) => c !== cat);
        const nextMargins = { ...prev.profitMargins.categories };
        delete nextMargins[cat];
        return {
          ...prev,
          categories: nextCats,
          profitMargins: {
            ...prev.profitMargins,
            categories: nextMargins,
          },
        };
      });
      triggerSuccess(`تم حذف قسم "${cat}" بنجاح`);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 text-stone-100" dir="rtl">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center space-x-2 space-x-reverse">
            <Sliders className="w-5 h-5 text-amber-500" />
            <span>إعدادات النظام العامة</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">تخصيص المظهر، نسب الأرباح التلقائية، الأقسام، وشكل وطباعة الفواتير.</p>
        </div>

        {successMessage && (
          <div className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-4 py-2 rounded-xl text-xs font-bold animate-pulse flex items-center space-x-2 space-x-reverse">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RIGHT COLUMN: Appearance & Print Customs */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* SECTION 1: Theme Select */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-3 flex items-center space-x-2 space-x-reverse">
              <Sun className="w-4 h-4" />
              <span>مظهر النظام (Theme Mode)</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4">اختر مظهر واجهة المستخدم المفضل للعمل اليومي.</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-amber-600/10 border-amber-500 text-amber-400 font-bold'
                    : 'bg-stone-950 border-stone-850 hover:border-stone-700 text-stone-400'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs">المظهر الداكن (Dark)</span>
              </button>

              <button
                onClick={() => handleThemeChange('light')}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  settings.theme === 'light'
                    ? 'bg-amber-600/10 border-amber-500 text-amber-400 font-bold shadow-sm'
                    : 'bg-stone-950 border-stone-850 hover:border-stone-700 text-stone-400'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs">المظهر النهاري (Light)</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: Printing & Invoice Designs */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-3 flex items-center space-x-2 space-x-reverse">
              <Printer className="w-4 h-4" />
              <span>تخصيص شكل طباعة الفاتورة</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4">قم بتعديل وتخصيص محتويات وتصميم الفاتورة عند الطباعة.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">نوع طباعة الفاتورة الافتراضي:</label>
                <select
                  value={settings.printSettings.receiptType}
                  onChange={(e) => handlePrintSettingChange('receiptType', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="thermal">فاتورة كاشير حرارية (Thermal 80mm)</option>
                  <option value="a4">فاتورة مقاس A4 قياسي</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">عنوان ترويسة الفاتورة (Header):</label>
                <input
                  type="text"
                  value={settings.printSettings.headerText}
                  onChange={(e) => handlePrintSettingChange('headerText', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">عنوان المتجر / الفرع:</label>
                <input
                  type="text"
                  placeholder="اخر شارع المدارس امام دار المناسبات حى الصفا"
                  value={settings.printSettings.address || ''}
                  onChange={(e) => handlePrintSettingChange('address', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">أرقام الهواتف والتواصل:</label>
                <input
                  type="text"
                  placeholder="01229028133 - 01222334884"
                  value={settings.printSettings.phoneNumbers || ''}
                  onChange={(e) => handlePrintSettingChange('phoneNumbers', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">رابط صفحة فيسبوك للباركود (Facebook URL):</label>
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
                <label className="block text-stone-400 text-xs mb-1 font-bold">رسالة التذييل (Footer):</label>
                <input
                  type="text"
                  value={settings.printSettings.footerText}
                  onChange={(e) => handlePrintSettingChange('footerText', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">السطر الإضافي أسفل التذييل (بالإنجليزية):</label>
                <input
                  type="text"
                  placeholder="visit us again"
                  value={settings.printSettings.footerSubText || ''}
                  onChange={(e) => handlePrintSettingChange('footerSubText', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-stone-800/60">
                <label className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-stone-950/20">
                  <span className="text-xs text-stone-300">إظهار كود / اسم البائع على الفاتورة</span>
                  <input
                    type="checkbox"
                    checked={settings.printSettings.showSellerCode}
                    onChange={(e) => handlePrintSettingChange('showSellerCode', e.target.checked)}
                    className="rounded bg-stone-950 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-stone-950/20">
                  <span className="text-xs text-stone-300">تضمين رمز الاستجابة السريعة (QR Code)</span>
                  <input
                    type="checkbox"
                    checked={settings.printSettings.showQRCode}
                    onChange={(e) => handlePrintSettingChange('showQRCode', e.target.checked)}
                    className="rounded bg-stone-950 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-stone-950/20">
                  <span className="text-xs text-stone-300">عرض شعار المحل أعلى الفاتورة</span>
                  <input
                    type="checkbox"
                    checked={settings.printSettings.showLogo}
                    onChange={(e) => handlePrintSettingChange('showLogo', e.target.checked)}
                    className="rounded bg-stone-950 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 5: Loyalty Points Settings */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-3 flex items-center space-x-2 space-x-reverse">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>إعدادات نظام نقاط الولاء</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4">اضبط قيمة النقاط وعدد الجنيهات المطلوبة للحصول على كل نقطة للعميل.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">معدل اكتساب النقاط (جنيه لكل نقطة):</label>
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
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                  <span className="absolute left-3 top-2 text-[10px] text-stone-500 font-bold">ج.م = 1 نقطة</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">يحصل العميل على نقطة واحدة مقابل كل X جنيه ينفقها.</p>
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 font-bold">سعر/قيمة النقطة الواحدة بالجنيه:</label>
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
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                  <span className="absolute left-3 top-2 text-[10px] text-stone-500 font-bold">ج.م لكل نقطة</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">القيمة النقدية التي يتم خصمها من الفاتورة مقابل كل نقطة يتم استبدالها.</p>
              </div>
            </div>
          </div>

          {/* SECTION 6: Supabase Database Status & Diagnostics (Locked Configuration) */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-3 flex items-center space-x-2 space-x-reverse">
              <Database className="w-4 h-4 text-amber-500" />
              <span>قاعدة البيانات السحابية (Supabase)</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-3">
              التطبيق مقترن مباشرة مع قاعدة البيانات السحابية المركزية المعتمدة للمؤسسة. يتم عرض واستدعاء البيانات الفعلية المخزنة فقط.
            </p>

            {/* Current Status Banner */}
            <div className={`p-3 rounded-xl border mb-3 text-xs ${
              dbStatus.isChecking
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                : dbStatus.isConnected
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold flex items-center space-x-1.5 space-x-reverse">
                  <Database className="w-3.5 h-3.5" />
                  <span>حالة الاتصال السحابي:</span>
                </span>
                <span className="font-mono px-2 py-0.5 rounded text-[10px] bg-stone-950 font-bold">
                  {dbStatus.isChecking ? 'جاري الفحص...' : dbStatus.isConnected ? 'متصل بنجاح' : 'غير متصل / خطأ'}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed">
                {dbStatus.isChecking
                  ? 'جاري فحص الاتصال ومطابقة البيانات مع السيرفر السحابي...'
                  : dbStatus.isConnected
                    ? 'الربط السحابي نشط ومعتمد. لا يسمح بتغيير قاعدة البيانات لضمان دقة وسلامة القيود.'
                    : `تنبيه: لا توجد استجابة من قاعدة البيانات. تفاصيل الخطأ: ${dbStatus.errorMessage || 'فشل الاتصال. يرجى التحقق من اتصال الإنترنت.'}`}
              </p>
            </div>

            {/* Test Connection Button */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={handleDiagnoseConnection}
                disabled={isDiagnosing || dbStatus.isChecking}
                className="w-full px-4 py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700/60 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                <span>{isDiagnosing ? 'جاري الفحص...' : 'اختبار الاتصال بقاعدة البيانات'}</span>
              </button>
            </div>

            {/* Diagnostic Result */}
            {diagnosticResult && (
              <div className={`mb-3 p-2.5 rounded-lg border text-[11px] font-bold flex items-start space-x-1.5 space-x-reverse ${
                diagnosticResult.success
                  ? 'bg-emerald-950/50 border-emerald-900/60 text-emerald-400'
                  : 'bg-rose-950/50 border-rose-900/60 text-rose-400'
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{diagnosticResult.msg}</span>
              </div>
            )}

            {/* Sync Queue Monitor */}
            <div className="mt-3 pt-3 border-t border-stone-850">
              <h3 className="text-xs font-bold text-stone-300 mb-2 flex items-center space-x-1.5 space-x-reverse">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>مراقبة حالة مزامنة البيانات</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                  <div className="text-[10px] text-stone-400 font-bold">الفواتير والمبيعات</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-black text-stone-100">{transactions.length}</span>
                    <span className="text-[9px] font-bold text-stone-500">
                      معلق: <span className={transactions.filter(t => !t.isSynced).length > 0 ? "text-rose-400 font-black" : "text-emerald-400"}>
                        {transactions.filter(t => !t.isSynced).length}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                  <div className="text-[10px] text-stone-400 font-bold">الورديات المقفلة</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-black text-stone-100">{closedShifts.length}</span>
                    <span className="text-[9px] font-bold text-stone-500">
                      معلق: <span className={closedShifts.filter(s => !s.isSynced).length > 0 ? "text-rose-400 font-black" : "text-emerald-400"}>
                        {closedShifts.filter(s => !s.isSynced).length}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Action */}
              {(() => {
                const pTxs = transactions.filter(t => !t.isSynced).length;
                const pShifts = closedShifts.filter(s => !s.isSynced).length;
                const totalP = pTxs + pShifts;

                if (totalP > 0) {
                  return (
                    <div className="space-y-2">
                      <div className="bg-rose-950/20 border border-rose-900/40 p-2 rounded-xl text-[10px] text-rose-300 leading-relaxed font-bold">
                        تنبيه: هناك ({totalP}) عمليات معلقة في الذاكرة لم ترفع إلى السحابة بعد.
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await syncUnsyncedItems();
                            triggerSuccess('تم بدء عملية مزامنة البيانات المعلقة...');
                          } catch (err) {
                            alert('حدث خطأ أثناء المزامنة.');
                          }
                        }}
                        disabled={dbStatus.isChecking}
                        className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse shadow-md disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${dbStatus.isChecking ? 'animate-spin' : ''}`} />
                        <span>{dbStatus.isChecking ? 'جاري الرفع والمزامنة...' : `مزامنة البيانات المعلقة الآن (${totalP})`}</span>
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-xl text-[10px] text-emerald-400 leading-relaxed font-bold flex items-center space-x-2 space-x-reverse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>جميع البيانات مطابقة ومتزامنة مع قاعدة البيانات السحابية. ✨</span>
                    </div>
                  );
                }
              })()}

              <div className="mt-3 pt-3 border-t border-stone-850 space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    await refreshDataFromSupabase();
                    triggerSuccess(`تمت المزامنة بنجاح! تم تحميل البيانات الفعلية من قاعدة البيانات.`);
                  }}
                  className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>تحديث وجلب البيانات مباشرة من Supabase</span>
                </button>

                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('هل أنت متأكد من مسح كافة الأصناف بالكامل من قاعدة البيانات؟')) {
                        await clearAllProducts();
                        triggerSuccess('تم تفريغ ومسح جميع الأصناف من قاعدة البيانات بنجاح.');
                      }
                    }}
                    className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح وتفريغ قائمة الأصناف من قاعدة البيانات ({products.length} صنف)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* LEFT COLUMN: Profit Ratios & Categories */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SECTION: Custom Keyboard Shortcuts F1 - F12 */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-800">
              <div>
                <h2 className="text-sm font-black text-amber-500 flex items-center space-x-2 space-x-reverse">
                  <Keyboard className="w-4 h-4 text-amber-500" />
                  <span>تخصيص اختصارات لوحة المفاتيح (F1 - F12)</span>
                </h2>
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                  يمكنك تحديد وظيفة كل زر من أزرار (F1 إلى F12) لسرعة إنجاز الفواتير، الدفع السريع، تسديد القسط، تسجيل المصروف، أو التنقل المباشر.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetShortcuts}
                className="px-3 py-1.5 bg-stone-950 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>إعادة الافتراضي</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FUNCTION_KEYS_LIST.map((keyName) => {
                const currentAction = activeShortcutMap[keyName] || 'none';
                const actionInfo = SHORTCUT_ACTION_LABELS[currentAction];

                return (
                  <div
                    key={keyName}
                    className="bg-stone-950/80 border border-stone-800 hover:border-amber-500/40 p-3 rounded-xl transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 space-x-reverse">
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
                        <p className="text-[10px] text-stone-500 mt-1.5 leading-tight mr-0.5">
                          {actionInfo.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* SECTION 3: Add/Manage Categories */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-3 flex items-center space-x-2 space-x-reverse">
              <FolderPlus className="w-4 h-4" />
              <span>إضافة وإدارة أقسام المنتجات</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4">أضف أقساماً جديدة لتنظيم الأصناف، أو احذف الأقسام غير المستخدمة حالياً.</p>

            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                required
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="مثال: أدوات المطبخ الذكية، مستلزمات الحمام..."
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-colors flex items-center space-x-1.5 space-x-reverse shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة قسم جديد</span>
              </button>
            </form>

            <div className="flex flex-wrap gap-2.5">
              {settings.categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span className="font-bold text-stone-200">{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-stone-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                    title="حذف هذا القسم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: Profit Margins Customs */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-md">
            <h2 className="text-sm font-black text-amber-500 mb-2 flex items-center space-x-2 space-x-reverse">
              <Percent className="w-4 h-4" />
              <span>تحديد نسب الربح التلقائية</span>
            </h2>
            <p className="text-[11px] text-stone-400 mb-4 leading-relaxed">
              عند إدخال <strong>سعر التكلفة</strong> لصنف جديد أو تعديله، يقوم النظام تلقائياً باحتساب أسعار البيع المقترحة بناءً على هذه النسب المئوية. يمكنك وضع نسب عامة لكل المنتجات، ونسب مخصصة لكل قسم على حدة.
            </p>

            {/* Default Margins Card */}
            <div className="border border-stone-800 bg-stone-950/40 p-4 rounded-2xl space-y-3 mb-5">
              <h3 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>نسب الأرباح الافتراضية (لكل المنتجات)</span>
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-stone-400 text-[10px] mb-1 font-bold">نسبة ربح الكاش (%):</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.profitMargins.default.cash}
                      onChange={(e) => handleDefaultMarginChange('cash', parseFloat(e.target.value) || 0)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 text-xs focus:outline-none text-center font-bold"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-[10px] font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-400 text-[10px] mb-1 font-bold">نسبة ربح الجملة (%):</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.profitMargins.default.wholesale}
                      onChange={(e) => handleDefaultMarginChange('wholesale', parseFloat(e.target.value) || 0)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 text-xs focus:outline-none text-center font-bold"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-[10px] font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-400 text-[10px] mb-1 font-bold">نسبة ربح التقسيط (%):</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.profitMargins.default.installment}
                      onChange={(e) => handleDefaultMarginChange('installment', parseFloat(e.target.value) || 0)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-100 text-xs focus:outline-none text-center font-bold"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-[10px] font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category-specific margins */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-200 flex items-center space-x-1.5 space-x-reverse">
                <Layout className="w-4 h-4 text-stone-400" />
                <span>تحديد نسب ربح خاصة لكل قسم</span>
              </h3>
              
              <div className="overflow-x-auto border border-stone-800/80 rounded-2xl">
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
                        <tr key={cat} className="hover:bg-stone-950/20">
                          <td className="py-2 px-3 font-bold text-stone-300">
                            <div className="flex items-center space-x-1.5 space-x-reverse">
                              <span>{cat}</span>
                              {hasCustom ? (
                                <span className="bg-amber-950 text-amber-400 text-[9px] px-1.5 py-0.2 rounded border border-amber-900/60 font-bold">نسب مخصصة</span>
                              ) : (
                                <span className="text-stone-500 text-[9px] font-medium">(يستخدم الافتراضي)</span>
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
                                className="text-stone-500 hover:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-800 hover:border-amber-800 bg-stone-950/40"
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

        </div>

      </div>
    </div>
  );
};
