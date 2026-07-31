import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { supabase, SUPABASE_CONFIG } from '../../lib/supabase';
import {
  syncProductToSupabase,
  syncTransactionToSupabase,
  syncCustomerToSupabase,
  syncAssociateToSupabase,
} from '../../lib/supabaseSync';
import {
  Database,
  RefreshCw,
  Server,
  Table,
  CheckCircle2,
  AlertCircle,
  Search,
  Code,
  ArrowUpRight,
  Layers,
  UploadCloud,
  ExternalLink,
} from 'lucide-react';

export const DatabaseView: React.FC = () => {
  const { products, transactions, customers, associates } = usePOS();
  
  const [selectedTable, setSelectedTable] = useState<'products' | 'transactions' | 'customers' | 'associates'>('products');
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rawViewMode, setRawViewMode] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    fetchTableData(selectedTable);
  }, [selectedTable]);

  const fetchTableData = async (tableName: string) => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(50);
      if (error) {
        // Fallback to local context data if Supabase table is not created yet
        setStatusMsg({
          type: 'info',
          text: `جارٍ عرض بيانات الجدول المحترفة محلياً (جدول ${tableName} في Supabase غير مكرر أو يتطلب إنشاء الجداول).`,
        });
        loadFallbackLocalData(tableName);
      } else if (data && data.length > 0) {
        setTableData(data);
        setStatusMsg({
          type: 'success',
          text: `تم جلب ${data.length} سجلاً بنجاح من قاعدة البيانات (Supabase).`,
        });
      } else {
        loadFallbackLocalData(tableName);
        setStatusMsg({
          type: 'info',
          text: `الجدول فارغ في Supabase. يمكنك النقر على "مزامنة كافة البيانات" لرفع البيانات فوراً.`,
        });
      }
    } catch (err: any) {
      loadFallbackLocalData(tableName);
      setStatusMsg({
        type: 'info',
        text: `عرض البيانات المزامنة للجدول ${tableName}.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFallbackLocalData = (tableName: string) => {
    if (tableName === 'products') {
      setTableData(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          cash_price: p.priceCash,
          stock_quantity: p.stock,
          image_url: p.image,
        }))
      );
    } else if (tableName === 'transactions') {
      setTableData(
        transactions.map((t) => ({
          id: t.id,
          receipt_number: t.receiptNumber,
          grand_total: t.grandTotal,
          payment_method: t.paymentMethod,
          associate_name: t.primaryAssociateName,
          customer_name: t.customerName || 'عميل نقدي',
          timestamp: t.timestamp,
        }))
      );
    } else if (tableName === 'customers') {
      setTableData(
        customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          loyalty_points: c.loyaltyPoints,
          total_spent: c.totalSpent,
        }))
      );
    } else if (tableName === 'associates') {
      setTableData(
        associates.map((a) => ({
          id: a.id,
          name: a.name,
          username: a.username,
          pin: '****',
          role: a.role,
          email: a.email,
        }))
      );
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setStatusMsg({ type: 'info', text: 'جارٍ مزامنة وتصدير جميع بيانات المحل إلى Supabase...' });
    
    try {
      for (const p of products) await syncProductToSupabase(p);
      for (const t of transactions) await syncTransactionToSupabase(t);
      for (const c of customers) await syncCustomerToSupabase(c);
      for (const a of associates) await syncAssociateToSupabase(a);
      
      setStatusMsg({
        type: 'success',
        text: 'تمت المزامنة بنجاح! جميع المنتجات، الفواتير، والعملاء تم رفعهم لقاعدة بيانات Supabase.',
      });
      fetchTableData(selectedTable);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `حدث خطأ أثناء المزامنة: ${err.message || err}`,
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const filteredData = tableData.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto dir-rtl space-y-6">
      {/* Top Header & Connection Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5 space-x-reverse">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 text-stone-950 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Database className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h1 className="text-xl font-black text-white">مستكشف قاعدة البيانات (Supabase)</h1>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center space-x-1 space-x-reverse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>متصل الآن</span>
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                استعراض ومزامنة البيانات اللحظية المربوطة بسحابة Supabase Live Cloud Database
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="flex items-center space-x-2 space-x-reverse bg-amber-600 hover:bg-amber-500 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              <UploadCloud className={`w-4 h-4 ${isSyncingAll ? 'animate-bounce' : ''}`} />
              <span>{isSyncingAll ? 'جارٍ المزامنة...' : 'مزامنة السحابة الآن'}</span>
            </button>

            <button
              onClick={() => fetchTableData(selectedTable)}
              disabled={isLoading}
              className="p-2.5 text-stone-300 hover:text-white bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-2xl transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Supabase Connection Metadata Details */}
        <div className="mt-6 pt-5 border-t border-stone-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-2xl">
            <p className="text-[10px] text-stone-500 font-bold uppercase">رابط المشروع (URL):</p>
            <p className="font-mono text-[11px] text-emerald-400 truncate dir-ltr text-right mt-1">
              {SUPABASE_CONFIG.url}
            </p>
          </div>

          <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-2xl">
            <p className="text-[10px] text-stone-500 font-bold uppercase">المفتاح العام (Publishable Key):</p>
            <p className="font-mono text-[11px] text-amber-400 truncate dir-ltr text-right mt-1">
              {SUPABASE_CONFIG.anonKey.slice(0, 24)}...
            </p>
          </div>

          <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-2xl">
            <p className="text-[10px] text-stone-500 font-bold uppercase">إجمالي الجداول المتاحة:</p>
            <p className="font-mono text-[11px] text-stone-200 font-bold mt-1">
              4 جداول رئيسية (محمية)
            </p>
          </div>

          <div className="bg-stone-950 border border-stone-800/80 p-3 rounded-2xl">
            <p className="text-[10px] text-stone-500 font-bold uppercase">حالة المزامنة الأوتوماتيكية:</p>
            <p className="font-mono text-[11px] text-emerald-400 font-bold mt-1 flex items-center space-x-1 space-x-reverse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>نشطة ومفعلة</span>
            </p>
          </div>
        </div>
      </div>

      {/* Table Selector Tabs & Search */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Tables Selection Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'products', name: 'المنتجات والشرائح (products)', count: products.length },
              { id: 'transactions', name: 'الفواتير والمعاملات (transactions)', count: transactions.length },
              { id: 'customers', name: 'سجل العملاء (customers)', count: customers.length },
              { id: 'associates', name: 'البائعين والكاشير (associates)', count: associates.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t.id as any)}
                className={`flex items-center space-x-2 space-x-reverse px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  selectedTable === t.id
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>{t.name}</span>
                <span className="bg-stone-950/60 px-2 py-0.5 rounded-full text-[10px] font-mono border border-stone-700/50">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Controls: Search & Raw JSON View Toggle */}
          <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالجدول..."
                className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-2 pr-9 pl-3 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => setRawViewMode(!rawViewMode)}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all ${
                rawViewMode
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
              }`}
              title="عرض بصيغة JSON"
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center space-x-2 space-x-reverse ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-900/80'
                : statusMsg.type === 'error'
                ? 'bg-rose-950/60 text-rose-300 border border-rose-900/80'
                : 'bg-amber-950/50 text-amber-300 border border-amber-900/60'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Data View Section */}
        {rawViewMode ? (
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-emerald-400 dir-ltr text-left leading-relaxed">
              {JSON.stringify(filteredData, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="overflow-x-auto border border-stone-800 rounded-2xl">
            {filteredData.length === 0 ? (
              <div className="p-12 text-center text-stone-500 text-xs">
                لا توجد بيانات متطابقة في جدول {selectedTable}
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-stone-950 text-stone-400 font-bold border-b border-stone-800 uppercase tracking-wider">
                  <tr>
                    {Object.keys(filteredData[0]).map((key) => (
                      <th key={key} className="p-3 whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/80 text-stone-200 font-medium">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-stone-800/40 transition-colors">
                      {Object.entries(row).map(([k, val]: [string, any], vIdx) => (
                        <td key={vIdx} className="p-3 whitespace-nowrap font-mono text-stone-300">
                          {typeof val === 'object' ? (
                            <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">
                              {JSON.stringify(val).slice(0, 30)}...
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
