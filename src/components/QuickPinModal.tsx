import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { KeyRound, X, Check, Delete, Sparkles, UserCheck } from 'lucide-react';

interface QuickPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickPinModal: React.FC<QuickPinModalProps> = ({ isOpen, onClose }) => {
  const { associates, quickSwitchByPin } = usePOS();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const verifyPin = (pinToTest: string) => {
    const success = quickSwitchByPin(pinToTest);
    if (success) {
      const matched = associates.find((a) => a.pin === pinToTest);
      setSuccessMsg(`Switched to ${matched?.name || 'Associate'}`);
      setTimeout(() => {
        setPin('');
        setSuccessMsg('');
        onClose();
      }, 600);
    } else {
      setErrorMsg('Invalid PIN code. Please try again.');
      setTimeout(() => {
        setPin('');
      }, 800);
    }
  };

  const selectAssociateDirect = (assocPin: string) => {
    setPin(assocPin);
    verifyPin(assocPin);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Associate PIN Terminal</h2>
          <p className="text-xs text-stone-400 mt-1">
            Enter 4-digit associate PIN to switch register operator
          </p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center space-x-3 mb-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-12 h-14 rounded-2xl border flex items-center justify-center text-2xl font-mono font-bold transition-all ${
                pin.length > idx
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-sm shadow-emerald-900/50 scale-105'
                  : 'border-stone-800 bg-stone-950 text-stone-600'
              }`}
            >
              {pin.length > idx ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <p className="text-center text-rose-400 text-xs font-medium mb-3 animate-bounce">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-center text-emerald-400 text-xs font-semibold mb-3 flex items-center justify-center space-x-1">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-100 text-xl font-mono font-semibold transition-all border border-stone-700/60 shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-400 text-xs font-medium transition-all border border-stone-800"
          >
            Clear
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-100 text-xl font-mono font-semibold transition-all border border-stone-700/60 shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-400 flex items-center justify-center transition-all border border-stone-800"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Select Roster Shortcuts */}
        <div className="border-t border-stone-800 pt-4">
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2.5">
            Quick Select (Demo Roster):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {associates.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAssociateDirect(a.pin)}
                className="flex items-center space-x-2 p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-left transition-all group"
              >
                <img
                  src={a.avatar}
                  alt={a.name}
                  className="w-7 h-7 rounded-lg object-cover ring-1 ring-stone-700 group-hover:ring-emerald-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-stone-200 truncate">{a.name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">PIN: {a.pin}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuickPinModal;
