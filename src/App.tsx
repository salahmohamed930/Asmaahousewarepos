import React from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { RegisterView } from './components/Register/RegisterView';
import { AssociatesView } from './components/Associates/AssociatesView';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { CatalogView } from './components/Catalog/CatalogView';
import { CustomersView } from './components/Customers/CustomersView';
import { SuppliersView } from './components/Suppliers/SuppliersView';
import { SettingsView } from './components/Settings/SettingsView';
import { DiscountsView } from './components/Discounts/DiscountsView';
import { ShieldAlert } from 'lucide-react';

const AccessDenied: React.FC<{ title?: string }> = ({ title = 'عذراً! لا تملك صلاحية الوصول هذه الشاشة' }) => {
  const { currentAssociate } = usePOS();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 mb-4 shadow-xl">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-extrabold text-white mb-2">{title}</h2>
      <p className="text-sm text-stone-400 max-w-md mb-4">
        المستخدم الحالي (<span className="text-amber-400 font-bold">{currentAssociate?.name}</span> - {currentAssociate?.role}) ليس لديه الصلاحيات الكافية لاستعراض هذه الصفحة. يرجى مراجعة مدير الفرع.
      </p>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const { currentAssociate, activeTab, hasPermission } = usePOS();

  if (!currentAssociate) {
    return <LoginScreen />;
  }

  const canAccessSettings = hasPermission('manage_associates') || currentAssociate.role === 'مدير الفرع';
  const canAccessCatalog =
    hasPermission('manage_catalog') ||
    hasPermission('add_products') ||
    hasPermission('edit_products') ||
    hasPermission('delete_products') ||
    hasPermission('view_cash_price') ||
    hasPermission('view_installment_price') ||
    hasPermission('view_wholesale_price');

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1">
        {activeTab === 'register' && (hasPermission('create_invoice') ? <RegisterView /> : <AccessDenied title="ليس لديك صلاحية إنشاء الفواتير" />)}
        {activeTab === 'associates' && (hasPermission('manage_associates') ? <AssociatesView /> : <AccessDenied title="ليس لديك صلاحية إدارة الموظفين" />)}
        {activeTab === 'analytics' && (hasPermission('view_analytics') ? <AnalyticsView /> : <AccessDenied title="ليس لديك صلاحية عرض التقارير" />)}
        {activeTab === 'catalog' && (canAccessCatalog ? <CatalogView /> : <AccessDenied title="ليس لديك صلاحية استعراض الأصناف" />)}
        {activeTab === 'customers' && (hasPermission('manage_customers') ? <CustomersView /> : <AccessDenied title="ليس لديك صلاحية حسابات العملاء" />)}
        {activeTab === 'suppliers' && (hasPermission('manage_suppliers') ? <SuppliersView /> : <AccessDenied title="ليس لديك صلاحية حسابات الموردين" />)}
        {activeTab === 'settings' && (canAccessSettings ? <SettingsView /> : <AccessDenied title="ليس لديك صلاحية الإعدادات" />)}
        {activeTab === 'discounts' && (hasPermission('apply_discount') || hasPermission('edit_products') ? <DiscountsView /> : <AccessDenied title="ليس لديك صلاحية إدارة الخصومات" />)}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <POSProvider>
      <MainLayout />
    </POSProvider>
  );
}
