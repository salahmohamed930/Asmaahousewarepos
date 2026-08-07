import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
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
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, products } = usePOS();
  const [newCategory, setNewCategory] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
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
                <label className="block text-stone-400 text-xs mb-1 font-bold">تذييل أسفل الفاتورة (Footer):</label>
                <textarea
                  rows={3}
                  value={settings.printSettings.footerText}
                  onChange={(e) => handlePrintSettingChange('footerText', e.target.value)}
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

        </div>

        {/* LEFT COLUMN: Profit Ratios & Categories */}
        <div className="lg:col-span-2 space-y-6">
          
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
