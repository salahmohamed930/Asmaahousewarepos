import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { KeyRound, X, Check, Delete, Store, LogIn, UserCheck, ShieldCheck } from 'lucide-react';

interface QuickPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickPinModal: React.FC<QuickPinModalProps> = ({ isOpen, onClose }) => {
  const { associates, currentAssociate, quickSwitchByPin, clockInAssociate } = usePOS();
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
      if (matched) {
        clockInAssociate(matched.id);
      }
      setSuccessMsg(`تم تسجيل الدخول بنجاح: ${matched?.name || 'البائع'}`);
      setTimeout(() => {
        setPin('');
        setSuccessMsg('');
        onClose();
      }, 700);
    } else {
      setErrorMsg('كود البائع غير صحيح. يرجى المحاولة مرة أخرى');
      setTimeout(() => {
        setPin('');
      }, 900);
    }
  };

  const selectAssociateDirect = (assocPin: string) => {
    setPin(assocPin);
    verifyPin(assocPin);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Header Info */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-100 flex items-center justify-center space-x-2 space-x-reverse">
            <span>تسجيل الدخول للنظام</span>
            <span className="text-[10px] bg-amber-950 border border-amber-800 text-amber-400 px-2 py-0.5 rounded-full font-mono">
              رمز البائع PIN
            </span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            أدخل كود البائع (4 أرقام) للدخول السريع وتبديل المستلم على الكاشير
          </p>
        </div>

        {/* PIN Entry Display */}
        <div className="flex justify-center space-x-3 space-x-reverse mb-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-12 h-14 rounded-2xl border flex items-center justify-center text-2xl font-mono font-extrabold transition-all ${
                pin.length > idx
                  ? 'border-amber-500 bg-amber-950/50 text-amber-300 shadow-lg shadow-amber-950/50 scale-105'
                  : 'border-stone-800 bg-stone-950 text-stone-600'
              }`}
            >
              {pin.length > idx ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <p className="text-center text-rose-400 text-xs font-bold mb-3 animate-bounce bg-rose-950/60 border border-rose-900 py-1.5 px-3 rounded-xl">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-center text-emerald-400 text-xs font-bold mb-3 flex items-center justify-center space-x-1.5 space-x-reverse bg-emerald-950/60 border border-emerald-900 py-1.5 px-3 rounded-xl">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-13 rounded-2xl bg-stone-950 hover:bg-stone-800 active:scale-95 text-stone-100 text-xl font-mono font-extrabold transition-all border border-stone-800 shadow-sm hover:border-amber-500/40"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-13 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-rose-400 text-xs font-bold transition-all border border-stone-800"
          >
            مسح
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-13 rounded-2xl bg-stone-950 hover:bg-stone-800 active:scale-95 text-stone-100 text-xl font-mono font-extrabold transition-all border border-stone-800 shadow-sm hover:border-amber-500/40"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-13 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-amber-400 flex items-center justify-center transition-all border border-stone-800"
            title="حذف آخر رقم"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Select Employee Cards */}
        <div className="border-t border-stone-800 pt-4">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>اختيار سريع للبائعين المسجلين:</span>
            <span className="text-[10px] text-amber-500 font-mono">اكواد تجريبية</span>
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pl-1">
            {associates.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAssociateDirect(a.pin)}
                className={`flex items-center space-x-2.5 space-x-reverse p-2 rounded-2xl border text-right transition-all group ${
                  currentAssociate?.id === a.id
                    ? 'bg-amber-950/60 border-amber-800 text-white'
                    : 'bg-stone-950 hover:bg-stone-800/80 border-stone-800 text-stone-300'
                }`}
              >
                <img
                  src={a.avatar}
                  alt={a.name}
                  className="w-8 h-8 rounded-xl object-cover ring-1 ring-stone-700 group-hover:ring-amber-500 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-200 truncate">{a.name}</p>
                  <p className="text-[10px] text-amber-400 font-mono font-extrabold">
                    كود: {a.pin}
                  </p>
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
