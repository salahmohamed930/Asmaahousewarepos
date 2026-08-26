import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import {
  FileText,
  Users,
  Package,
  BarChart3,
  UserCheck,
  Truck,
  KeyRound,
  ChevronDown,
  LogOut,
  LogIn,
  Store,
  Database,
  Settings,
  Percent,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentAssociate,
    associates,
    activeTab,
    setActiveTab,
    setCurrentAssociate,
    clockInAssociate,
    clockOutAssociate,
    resetDemoData,
    dbStatus,
    refreshDataFromSupabase,
    hasPermission,
  } = usePOS();

  const [isAssociateDropdownOpen, setIsAssociateDropdownOpen] = useState(false);

  // Navigation tabs with permissions check:
  const allTabs = [
    { id: 'catalog', label: 'الأصناف', icon: Package },
    { id: 'register', label: 'الفواتير', icon: FileText },
    { id: 'discounts', label: 'الخصومات', icon: Percent },
    { id: 'analytics', label: 'التقارير', icon: BarChart3 },
    { id: 'customers', label: 'حسابات العملاء', icon: UserCheck },
    { id: 'suppliers', label: 'حسابات الموردين', icon: Truck },
    { id: 'associates', label: 'الموظفين', icon: Users },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ] as const;

  const tabs = allTabs.filter((tab) => {
    if (tab.id === 'analytics') return hasPermission('view_analytics');
    if (tab.id === 'customers') return hasPermission('manage_customers');
    if (tab.id === 'suppliers') return hasPermission('manage_suppliers');
    if (tab.id === 'associates') return hasPermission('manage_associates');
    if (tab.id === 'discounts') return hasPermission('apply_discount');
    return true;
  });

  return (
    <>
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Right Brand & Store Info */}
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-extrabold text-lg tracking-tight text-white">
                    أسماء للأدوات المنزلية
                  </span>
                </div>
                <p className="text-[11px] text-stone-400">نظام إدارة المبيعات والفواتير ونقاط البيع</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex space-x-1 space-x-reverse bg-stone-950/60 p-1.5 rounded-xl border border-stone-800">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 space-x-reverse px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Left Active Associate Switcher & Actions */}
            <div className="flex items-center space-x-3 space-x-reverse">

              {/* Database Connection Status Badge */}
              <button
                onClick={() => {
                  if (!dbStatus.isConnected) {
                    refreshDataFromSupabase();
                  }
                }}
                title={dbStatus.errorMessage ? `خطأ بقاعدة البيانات: ${dbStatus.errorMessage}` : dbStatus.isConnected ? 'متصل بقاعدة البيانات بنجاح' : 'جاري التحقق من الاتصال...'}
                className={`flex items-center space-x-1.5 space-x-reverse border px-2.5 py-1.5 rounded-xl transition-all text-[11px] font-bold ${
                  dbStatus.isChecking
                    ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                    : dbStatus.isConnected
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                      : 'bg-rose-950/40 border-rose-800 text-rose-400 cursor-pointer hover:bg-rose-900/40'
                }`}
              >
                <Database className={`w-3.5 h-3.5 ${dbStatus.isChecking ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">
                  {dbStatus.isChecking
                    ? 'جاري فحص الاتصال...'
                    : dbStatus.isConnected
                      ? 'قاعدة البيانات متصلة'
                      : 'خطأ بالاتصال (اضغط لإعادة المحاولة)'}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  dbStatus.isChecking
                    ? 'bg-amber-400 animate-ping'
                    : dbStatus.isConnected
                      ? 'bg-emerald-400'
                      : 'bg-rose-500 animate-pulse'
                }`} />
              </button>

              {/* Active Associate Selector Pill */}
              <div className="relative">
                <button
                  onClick={() => setIsAssociateDropdownOpen(!isAssociateDropdownOpen)}
                  className="flex items-center space-x-2.5 space-x-reverse bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 p-1.5 pl-3 rounded-xl transition-all"
                >
                  {currentAssociate ? (
                    <>
                      <img
                        src={currentAssociate.avatar}
                        alt={currentAssociate.name}
                        className="w-8 h-8 rounded-lg object-cover ring-2 ring-amber-500/40"
                      />
                      <div className="text-right hidden lg:block">
                        <div className="text-xs font-extrabold text-stone-100 flex items-center space-x-1.5 space-x-reverse">
                          <span>{currentAssociate.name}</span>
                          <span className="text-[10px] text-amber-400 bg-amber-950/80 border border-amber-800 px-1 rounded font-mono">
                            كود: {currentAssociate.pin}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400">{currentAssociate.role}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-stone-400 px-2 py-1">اختر الكاشير / البائع</div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {/* Dropdown Menu */}
                {isAssociateDropdownOpen && (
                  <div
                    className="absolute left-0 rtl:left-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right space-y-2.5"
                    onClick={() => setIsAssociateDropdownOpen(false)}
                  >
                    <div className="px-1 py-1 text-[11px] font-bold text-stone-400 uppercase border-b border-stone-800/60 pb-2">
                      الحساب النشط حالياً
                    </div>

                    {currentAssociate && (
                      <div className="bg-stone-950 border border-stone-800 p-2.5 rounded-xl space-y-2">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <img
                            src={currentAssociate.avatar}
                            alt={currentAssociate.name}
                            className="w-9 h-9 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-extrabold text-stone-200 text-xs">{currentAssociate.name}</div>
                            <div className="text-[10px] text-stone-400">
                              {currentAssociate.role} • كود: <span className="font-mono text-amber-400">{currentAssociate.pin}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] border-t border-stone-800/80 pt-1.5">
                          <span className="text-stone-500">حالة الحضور:</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              currentAssociate.isClockedIn
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                : 'bg-stone-800 text-stone-500'
                            }`}
                          >
                            {currentAssociate.isClockedIn ? 'على رأس العمل' : 'غير متواجد'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-950/25 border border-amber-900/30 rounded-xl p-2.5 text-[10px] text-amber-400/90 leading-relaxed font-bold">
                      ⚠️ لتغيير الحساب أو الدخول ببائع آخر، يجب الضغط على "تسجيل الخروج" أولاً لإعادتك لشاشة الدخول الرئيسية.
                    </div>

                    <div className="space-y-1 text-xs pt-1 border-t border-stone-800">
                      {currentAssociate && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!currentAssociate) return;
                              if (currentAssociate.isClockedIn) {
                                clockOutAssociate(currentAssociate.id);
                              } else {
                                clockInAssociate(currentAssociate.id);
                              }
                            }}
                            className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 space-x-reverse transition-colors ${
                              currentAssociate?.isClockedIn
                                ? 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/80 border border-amber-800/50'
                                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800/80 border border-emerald-800/50'
                            }`}
                          >
                            {currentAssociate?.isClockedIn ? (
                              <>
                                <LogOut className="w-3.5 h-3.5" />
                                <span>تسجيل انصراف {currentAssociate?.name?.split(' ')[0]}</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3.5 h-3.5" />
                                <span>تسجيل حضور {currentAssociate?.name?.split(' ')[0]}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentAssociate(null);
                              setIsAssociateDropdownOpen(false);
                            }}
                            className="w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 space-x-reverse transition-colors bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 border border-rose-900/50"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>تسجيل الخروج (صفحة الدخول)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto space-x-1 space-x-reverse bg-stone-950 px-3 py-2 border-t border-stone-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
};
