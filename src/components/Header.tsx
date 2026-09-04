import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../context/POSContext';
import { DEFAULT_SHORTCUT_KEYS } from '../data/initialData';
import { QuickPinModal } from './QuickPinModal';
import { SyncStatusIndicator } from './Common/SyncStatusIndicator';
import { SyncDetailsModal } from './Common/SyncDetailsModal';
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
    hasPermission,
    settings,
  } = usePOS();

  const [isAssociateDropdownOpen, setIsAssociateDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('left');
  const [isQuickPinModalOpen, setIsQuickPinModalOpen] = useState(false);
  const associateButtonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateDropdownPosition = () => {
    if (associateButtonRef.current) {
      const rect = associateButtonRef.current.getBoundingClientRect();
      // If opening to the right will overflow the viewport, align right
      if (rect.left + 270 > window.innerWidth) {
        setDropdownPosition('right');
      } else {
        setDropdownPosition('left');
      }
    }
  };

  const toggleAssociateDropdown = () => {
    if (!isAssociateDropdownOpen) {
      updateDropdownPosition();
    }
    setIsAssociateDropdownOpen(!isAssociateDropdownOpen);
  };

  useEffect(() => {
    if (isAssociateDropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      return () => window.removeEventListener('resize', updateDropdownPosition);
    }
  }, [isAssociateDropdownOpen]);

  // Shortcut Listener for Quick Pin / Lock
  useEffect(() => {
    const handleShortcutAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; key: string }>;
      const action = customEvent.detail?.action;
      if (action === 'quick_lock') {
        setIsQuickPinModalOpen(true);
      }
    };

    window.addEventListener('pos-shortcut-action', handleShortcutAction);
    return () => {
      window.removeEventListener('pos-shortcut-action', handleShortcutAction);
    };
  }, []);

  const getShortcutKeyForAction = (actionId: string): string | null => {
    const activeMap = { ...DEFAULT_SHORTCUT_KEYS, ...(settings.shortcutKeys || {}) };
    const entry = Object.entries(activeMap).find(([_, act]) => act === actionId);
    return entry ? entry[0] : null;
  };

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
    if (tab.id === 'register') return hasPermission('create_invoice');
    if (tab.id === 'catalog') {
      return (
        hasPermission('manage_catalog') ||
        hasPermission('add_products') ||
        hasPermission('edit_products') ||
        hasPermission('delete_products') ||
        hasPermission('view_cash_price') ||
        hasPermission('view_installment_price') ||
        hasPermission('view_wholesale_price')
      );
    }
    if (tab.id === 'discounts') return hasPermission('apply_discount') || hasPermission('edit_products');
    if (tab.id === 'analytics') return hasPermission('view_analytics');
    if (tab.id === 'customers') return hasPermission('manage_customers');
    if (tab.id === 'suppliers') return hasPermission('manage_suppliers');
    if (tab.id === 'associates') return hasPermission('manage_associates');
    if (tab.id === 'settings') return hasPermission('manage_associates') || currentAssociate?.role === 'مدير الفرع';
    return true;
  });

  // Automatically switch active tab if current user loses access to active tab
  React.useEffect(() => {
    if (!currentAssociate) return;
    const isAllowed = tabs.some((t) => t.id === activeTab);
    if (!isAllowed) {
      const fallback = tabs[0]?.id || 'register';
      setActiveTab(fallback as any);
    }
  }, [currentAssociate?.id, currentAssociate?.role, currentAssociate?.permissions, activeTab, tabs]);

  return (
    <>
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md w-full max-w-full">
        <div className="w-full max-w-[1700px] mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 h-14 w-full min-w-0">
            
            {/* Right: Brand & Navigation */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0 text-amber-500">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Store className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-stone-200 text-xs hidden sm:inline">أسماء هوم</span>
              </div>

              {/* Navigation Tabs */}
              <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-stone-950/70 p-1 rounded-xl border border-stone-800/80 shrink-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const shortcutKey = getShortcutKeyForAction(`open_${tab.id}`);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                      {shortcutKey && (
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded border font-black ${
                          isActive
                            ? 'bg-amber-700/60 text-amber-100 border-amber-400/50'
                            : 'bg-stone-900 text-amber-400 border-stone-800'
                        }`}>
                          {shortcutKey}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Left Active Associate Switcher & Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
              {/* Sync Status Badge & Controls */}
              <SyncStatusIndicator />

              {/* Active Associate Selector Pill */}
              <div className="relative" ref={associateButtonRef}>
                <button
                  onClick={toggleAssociateDropdown}
                  className="flex items-center gap-1.5 bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 p-1 sm:p-1.5 pl-2 sm:pl-2.5 rounded-xl transition-all"
                >
                  {currentAssociate ? (
                    <>
                      <img
                        src={currentAssociate.avatar}
                        alt={currentAssociate.name}
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-amber-500/40 shrink-0"
                      />
                      <div className="text-right hidden xl:block">
                        <div className="text-xs font-extrabold text-stone-100 flex items-center gap-1">
                          <span>{currentAssociate.name}</span>
                          <span className="text-[10px] text-amber-400 bg-amber-950/80 border border-amber-800 px-1 rounded font-mono">
                            كود: {currentAssociate.pin}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 leading-none">{currentAssociate.role}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-stone-400 px-1.5 py-0.5">اختر الكاشير</div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                </button>

                {/* Dropdown Menu */}
                {isAssociateDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAssociateDropdownOpen(false)}
                    />
                    <div
                      ref={dropdownRef}
                      className={`absolute mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right space-y-2.5 ${
                        dropdownPosition === 'right' ? 'right-0 left-auto' : 'left-0 right-auto'
                      }`}
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
                  </>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto gap-1 bg-stone-950 px-2 py-1.5 border-t border-stone-800 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
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

      <QuickPinModal isOpen={isQuickPinModalOpen} onClose={() => setIsQuickPinModalOpen(false)} />
      <SyncDetailsModal />
    </>
  );
};
