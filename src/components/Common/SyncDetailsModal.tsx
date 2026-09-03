import React, { useEffect, useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { db, PendingSyncItem } from '../../lib/db';
import {
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  WifiOff,
  CloudUpload,
  CloudDownload,
  Database,
  RotateCcw,
  List,
} from 'lucide-react';

export const SyncDetailsModal: React.FC = () => {
  const {
    isSyncDetailsOpen,
    setIsSyncDetailsOpen,
    syncStatus,
    lastPushTime,
    lastPullTime,
    pendingSyncCount,
    failedSyncCount,
    lastSyncError,
    syncSummaryResult,
    syncNow,
    retryFailedItem,
    retryAllFailedItems,
  } = usePOS();

  const [pendingItems, setPendingItems] = useState<PendingSyncItem[]>([]);
  const [syncErrorItems, setSyncErrorItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'queue' | 'errors'>('summary');
  const [isLoadingList, setIsLoadingList] = useState(false);

  useEffect(() => {
    if (!isSyncDetailsOpen) return;

    const loadLists = async () => {
      setIsLoadingList(true);
      try {
        const queue = await db.pendingSync.orderBy('id').toArray();
        const errors = await db.syncErrors.orderBy('id').reverse().toArray();
        setPendingItems(queue);
        setSyncErrorItems(errors);
      } catch (err) {
        console.error('Failed to load queue details:', err);
      } finally {
        setIsLoadingList(false);
      }
    };

    loadLists();
  }, [isSyncDetailsOpen, pendingSyncCount, failedSyncCount, syncStatus]);

  if (!isSyncDetailsOpen) return null;

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'لم تتم بعد';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-right"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100 text-base">مركز إدارة المزامنة والبيانات</h3>
              <p className="text-xs text-stone-400">تابع حالة الرفع والتنزيل وقائمة العمليات المعلقة</p>
            </div>
          </div>
          <button
            onClick={() => setIsSyncDetailsOpen(false)}
            className="p-1.5 text-stone-400 hover:text-white bg-stone-800/60 hover:bg-stone-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Sub-tabs */}
        <div className="flex items-center space-x-1 space-x-reverse bg-stone-950 p-2 border-b border-stone-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 space-x-reverse transition-colors ${
              activeTab === 'summary' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>ملخص المزامنة</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 space-x-reverse transition-colors ${
              activeTab === 'queue' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>قائمة الانتظار ({pendingSyncCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 space-x-reverse transition-colors ${
              activeTab === 'errors' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>الأخطاء والسجلات ({syncErrorItems.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : syncStatus === 'syncing'
                    ? 'bg-sky-950/40 border-sky-800/60 text-sky-300 animate-pulse'
                    : syncStatus === 'pending'
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                    : syncStatus === 'failed'
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                    : 'bg-stone-800/60 border-stone-700 text-stone-300'
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  {syncStatus === 'synced' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                  {syncStatus === 'syncing' && <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />}
                  {syncStatus === 'pending' && <Clock className="w-6 h-6 text-amber-400" />}
                  {syncStatus === 'failed' && <AlertTriangle className="w-6 h-6 text-rose-400 animate-bounce" />}
                  {syncStatus === 'offline' && <WifiOff className="w-6 h-6 text-stone-400" />}
                  <div>
                    <div className="font-extrabold text-sm">
                      {syncStatus === 'synced' && 'جميع البيانات متزامنة ومحدثة بالكامل'}
                      {syncStatus === 'syncing' && 'جاري تنفيذ عملية المزامنة مع السحابة...'}
                      {syncStatus === 'pending' && `يوجد ${pendingSyncCount} عملية معلقة في انتظار الرفع`}
                      {syncStatus === 'failed' && `يوجد أخطاء في المزامنة (${failedSyncCount} عملية معلقة)`}
                      {syncStatus === 'offline' && 'الجهاز غير متصل بالإنترنت حالياً (يعمل وضع الأوفلاين)'}
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">
                      {syncStatus === 'offline'
                        ? 'يتم حفظ كافة العمليات محلياً وفي قائمة الانتظار للرفع تلقائياً فور عودة الاتصال'
                        : syncStatus === 'synced'
                        ? 'النظام يعمل بتقنية Online-First والمزامنة الخلفية بدون أي أداء مفقود'
                        : 'تتم المزامنة تلقائياً في الخلفية كل 60 ثانية أو يمكنك الضغط على زر المزامنة الآن'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={syncNow}
                  disabled={syncStatus === 'syncing' || syncStatus === 'offline'}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 space-x-reverse transition-all shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>مزامنة الآن</span>
                </button>
              </div>

              {/* Timestamp Metas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex items-center space-x-3 space-x-reverse">
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                    <CloudUpload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 font-bold block">آخر رفع محلي إلى السحابة (Push)</span>
                    <span className="text-xs font-mono font-bold text-stone-200 dir-ltr text-right block">
                      {formatDate(lastPushTime)}
                    </span>
                  </div>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex items-center space-x-3 space-x-reverse">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <CloudDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 font-bold block">آخر تنزيل سحابي إلى Dexie (Pull)</span>
                    <span className="text-xs font-mono font-bold text-stone-200 dir-ltr text-right block">
                      {formatDate(lastPullTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Summary Result Box (if manual sync ran) */}
              {syncSummaryResult && (
                <div className="bg-stone-950/80 border border-stone-800 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-stone-800/80 pb-2">
                    <span className="font-extrabold text-amber-400">نتيجة آخر عملية مزامنة يدوية</span>
                    <span className="text-[10px] text-stone-400 font-mono">الوقت: {syncSummaryResult.completedAt}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-stone-900 p-2 rounded-lg border border-stone-800">
                      <span className="text-[10px] text-stone-400 block font-bold">المرفوعات</span>
                      <span className="text-sm font-extrabold text-blue-400">{syncSummaryResult.uploadedCount}</span>
                    </div>
                    <div className="bg-stone-900 p-2 rounded-lg border border-stone-800">
                      <span className="text-[10px] text-stone-400 block font-bold">التنزيلات</span>
                      <span className="text-sm font-extrabold text-emerald-400">{syncSummaryResult.downloadedCount}</span>
                    </div>
                    <div className="bg-stone-900 p-2 rounded-lg border border-stone-800">
                      <span className="text-[10px] text-stone-400 block font-bold">الأخطاء</span>
                      <span className="text-sm font-extrabold text-rose-400">{syncSummaryResult.failedCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert Box */}
              {lastSyncError && (
                <div className="bg-rose-950/40 border border-rose-800/60 p-3.5 rounded-xl text-rose-300 text-xs space-y-1">
                  <div className="font-extrabold flex items-center space-x-1.5 space-x-reverse text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>آخر خطأ مسجل:</span>
                  </div>
                  <p className="font-mono text-[11px] bg-stone-950/80 p-2 rounded-lg border border-rose-900/40 dir-ltr text-left break-all text-rose-200">
                    {lastSyncError}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-300 font-bold">
                  جدول العمليات المعلقة في Outbox Queue ({pendingItems.length})
                </span>
                {failedSyncCount > 0 && (
                  <button
                    onClick={retryAllFailedItems}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 space-x-reverse transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة محاولة الكل ({failedSyncCount})</span>
                  </button>
                )}
              </div>

              {pendingItems.length === 0 ? (
                <div className="text-center py-8 bg-stone-950/60 border border-stone-800 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs text-stone-300 font-bold">لا يوجد أي عمليات معلقة في الانتظار</p>
                  <p className="text-[11px] text-stone-500">تم رفع كافة التغييرات المحلية بنجاح إلى قاعدة البيانات</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-stone-950 border border-stone-800 p-3 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              item.operation === 'INSERT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : item.operation === 'UPDATE'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            {item.operation}
                          </span>
                          <span className="font-extrabold text-stone-200">{item.tableName}</span>
                          <span className="text-[10px] font-mono text-stone-500">#{item.id}</span>
                        </div>

                        <div className="text-[10px] text-stone-400 space-x-2 space-x-reverse">
                          <span>
                            المعرف: <span className="font-mono text-amber-400">{item.record_id || 'N/A'}</span>
                          </span>
                          <span>•</span>
                          <span>
                            الحالة:{' '}
                            <span
                              className={`font-bold ${
                                item.status === 'failed'
                                  ? 'text-rose-400'
                                  : item.status === 'processing'
                                  ? 'text-sky-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {item.status || 'pending'}
                            </span>
                          </span>
                          <span>•</span>
                          <span>المحاولات: {item.retryCount || 0}/5</span>
                        </div>

                        {item.lastError && (
                          <div className="text-[10px] text-rose-400 font-mono bg-rose-950/40 p-1.5 rounded border border-rose-900/40 dir-ltr text-left">
                            {item.lastError}
                          </div>
                        )}
                      </div>

                      {item.id && (item.status === 'failed' || (item.retryCount && item.retryCount > 0)) && (
                        <button
                          onClick={() => retryFailedItem(item.id!)}
                          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-lg text-xs font-bold flex items-center space-x-1 space-x-reverse transition-colors shrink-0"
                          title="إعادة المحاولة فوراً"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>إعادة المحاولة</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="space-y-3">
              <div className="text-xs text-stone-300 font-bold">
                سجل أخطاء المزامنة المرفوضة Dead-Letter Queue ({syncErrorItems.length})
              </div>

              {syncErrorItems.length === 0 ? (
                <div className="text-center py-8 bg-stone-950/60 border border-stone-800 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs text-stone-300 font-bold">لا يوجد أخطاء سابقة في المزامنة</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {syncErrorItems.map((err) => (
                    <div
                      key={err.id}
                      className="bg-stone-950 border border-rose-900/40 p-3 rounded-xl text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-950 text-rose-300 border border-rose-800">
                            {err.tableName}:{err.operation}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">{formatDate(err.failedAt)}</span>
                        </div>
                        <span className="text-[10px] text-rose-400 font-bold">فشل {err.retryCount} محاولات</span>
                      </div>

                      <div className="text-[11px] text-rose-300 font-mono bg-rose-950/30 p-2 rounded border border-rose-900/30 dir-ltr text-left break-all">
                        {err.errorReason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-stone-800 bg-stone-950 flex items-center justify-between text-xs">
          <span className="text-stone-400 font-mono">Asmaa POS Sync Engine v3.0</span>
          <button
            onClick={() => setIsSyncDetailsOpen(false)}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
