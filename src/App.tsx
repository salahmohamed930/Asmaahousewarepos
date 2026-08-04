import React from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { RegisterView } from './components/Register/RegisterView';
import { AssociatesView } from './components/Associates/AssociatesView';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { CatalogView } from './components/Catalog/CatalogView';
import { CustomersView } from './components/Customers/CustomersView';
import { SettingsView } from './components/Settings/SettingsView';

const MainLayout: React.FC = () => {
  const { currentAssociate, activeTab } = usePOS();

  if (!currentAssociate) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1">
        {activeTab === 'register' && <RegisterView />}
        {activeTab === 'associates' && <AssociatesView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'catalog' && <CatalogView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'settings' && <SettingsView />}
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
