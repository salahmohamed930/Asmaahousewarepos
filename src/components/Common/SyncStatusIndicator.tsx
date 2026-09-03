import React from 'react';
import { usePOS } from '../../context/POSContext';
import {
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertTriangle,
  WifiOff,
  Info,
} from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const {
    syncStatus,
    pendingSyncCount,
    failedSyncCount,
    syncNow,
    setIsSyncDetailsOpen,
  } = usePOS();

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await syncNow();
  };

  const renderStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center gap-1 text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-1 rounded-lg text-[11px] font-bold animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-sky-400 shrink-0" />
            <span>مزامنة...</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1 text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-1 rounded-lg text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>معلقة ({pendingSyncCount})</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1 text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-1 rounded-lg text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3 text-rose-400 animate-bounce shrink-0" />
            <span>أخطاء ({failedSyncCount})</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1 text-stone-400 bg-stone-900 border border-stone-800 px-2 py-1 rounded-lg text-[11px] font-bold">
            <WifiOff className="w-3 h-3 text-stone-400 shrink-0" />
            <span>أوفلاين</span>
          </div>
        );
      case 'synced':
      default:
        return (
          <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded-lg text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>متزامن</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Clickable Status Badge opens details modal */}
      <button
        onClick={() => setIsSyncDetailsOpen(true)}
        className="hover:opacity-90 transition-opacity focus:outline-none"
        title="انقر لعرض تفاصيل المزامنة"
      >
        {renderStatusBadge()}
      </button>

      {/* Manual Sync Now Button */}
      <button
        onClick={handleSyncClick}
        disabled={syncStatus === 'syncing' || syncStatus === 'offline'}
        className={`p-1 rounded-lg border transition-all flex items-center justify-center ${
          syncStatus === 'syncing'
            ? 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed'
            : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700/80 text-amber-400 hover:text-amber-300'
        }`}
        title="مزامنة فورية الآن"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
      </button>

      {/* Info Icon Button */}
      <button
        onClick={() => setIsSyncDetailsOpen(true)}
        className="p-1 rounded-lg bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 text-stone-400 hover:text-stone-200 transition-all hidden xl:flex items-center justify-center"
        title="عرض تفاصيل المزامنة وحالتها"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
