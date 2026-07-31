import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { SplitAssociate } from '../../types';
import { Users, X, Check, Percent, Plus, Trash2 } from 'lucide-react';

interface SplitAssociateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SplitAssociateModal: React.FC<SplitAssociateModalProps> = ({ isOpen, onClose }) => {
  const { currentAssociate, associates, splitAssociates, setSplitAssociates } = usePOS();

  const [splits, setSplits] = useState<SplitAssociate[]>(splitAssociates);

  if (!isOpen || !currentAssociate) return null;

  // Filter out current associate from secondary choices
  const availableAssociates = associates.filter(
    (a) => a.id !== currentAssociate.id && !splits.some((s) => s.associateId === a.id)
  );

  const handleAddSplit = (associateId: string) => {
    // default share 50% split evenly
    const newSplits = [...splits, { associateId, sharePercentage: 50 }];

    // Adjust primary associate remaining percentage
    setSplits(newSplits);
  };

  const handleRemoveSplit = (associateId: string) => {
    setSplits(splits.filter((s) => s.associateId !== associateId));
  };

  const handleUpdatePercentage = (associateId: string, sharePercentage: number) => {
    setSplits(
      splits.map((s) =>
        s.associateId === associateId
          ? { ...s, sharePercentage: Math.max(1, Math.min(99, sharePercentage)) }
          : s
      )
    );
  };

  const totalSplitPercent = splits.reduce((acc, s) => acc + s.sharePercentage, 0);
  const primaryPercent = Math.max(0, 100 - totalSplitPercent);

  const handleSave = () => {
    if (totalSplitPercent >= 100) {
      alert('Total secondary split percentage cannot exceed 99%. Primary associate must retain at least 1%.');
      return;
    }
    setSplitAssociates(splits);
    onClose();
  };

  const handleClearSplits = () => {
    setSplits([]);
    setSplitAssociates([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Split Sale Commission</h2>
            <p className="text-xs text-stone-400">
              Co-assisted sale attribution & credit percentage split
            </p>
          </div>
        </div>

        {/* Primary Associate Row */}
        <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3.5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={currentAssociate.avatar}
                alt={currentAssociate.name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-500/50"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white">{currentAssociate.name}</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-medium">
                    Primary Register
                  </span>
                </div>
                <p className="text-xs text-stone-400">
                  Base Rate: {(currentAssociate.commissionRate * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-mono font-bold text-emerald-400">
                {primaryPercent}%
              </span>
              <p className="text-[10px] text-stone-400">Sale Credit</p>
            </div>
          </div>
        </div>

        {/* Secondary Split Associates */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
            Co-Assisting Associates ({splits.length})
          </p>

          {splits.length === 0 ? (
            <div className="text-center py-6 bg-stone-950/50 rounded-2xl border border-dashed border-stone-800 text-stone-500 text-xs">
              No co-assisting associates added yet.
              <br />
              100% of commission goes to {currentAssociate.name}.
            </div>
          ) : (
            splits.map((split) => {
              const assoc = associates.find((a) => a.id === split.associateId);
              if (!assoc) return null;

              return (
                <div
                  key={split.associateId}
                  className="flex items-center justify-between bg-stone-800/80 border border-stone-700/80 rounded-2xl p-3"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={assoc.avatar}
                      alt={assoc.name}
                      className="w-9 h-9 rounded-xl object-cover"
                    />
                    <div>
                      <span className="text-xs font-semibold text-stone-200 block">
                        {assoc.name}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        Comm Rate: {(assoc.commissionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5 bg-stone-900 border border-stone-700 rounded-xl px-2 py-1">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={split.sharePercentage}
                        onChange={(e) =>
                          handleUpdatePercentage(split.associateId, parseInt(e.target.value) || 0)
                        }
                        className="w-12 bg-transparent text-right font-mono font-bold text-stone-100 text-sm focus:outline-none"
                      />
                      <Percent className="w-3.5 h-3.5 text-stone-400" />
                    </div>

                    <button
                      onClick={() => handleRemoveSplit(split.associateId)}
                      className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-900 rounded-xl transition-colors"
                      title="Remove split"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Assistant Dropdown */}
        {availableAssociates.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">
              Add Co-Assisting Associate:
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {availableAssociates.map((assoc) => (
                <button
                  key={assoc.id}
                  onClick={() => handleAddSplit(assoc.id)}
                  className="flex items-center space-x-2.5 p-2 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-xl text-left transition-colors"
                >
                  <img
                    src={assoc.avatar}
                    alt={assoc.name}
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-stone-200 truncate">{assoc.name}</p>
                    <p className="text-[10px] text-stone-500">{assoc.role}</p>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center space-x-3 border-t border-stone-800 pt-4">
          <button
            onClick={handleClearSplits}
            className="px-4 py-2.5 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl text-xs font-medium border border-stone-800 transition-colors"
          >
            Clear Splits
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Apply Split ({primaryPercent}% / {totalSplitPercent}%)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SplitAssociateModal;
