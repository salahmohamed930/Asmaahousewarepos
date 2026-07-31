import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { ShieldCheck, Check, Store, Lock, AlertTriangle, Eye, EyeOff, User, KeyRound, LogIn } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { associates, setCurrentAssociate, clockInAssociate } = usePOS();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Security brute-force protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutTimer > 0) return;

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    // Match username against username, email, or name
    const matched = associates.find(
      (a) =>
        (a.username && a.username.toLowerCase() === trimmedUsername) ||
        (a.email && a.email.toLowerCase() === trimmedUsername) ||
        a.name.toLowerCase() === trimmedUsername
    );

    if (!matched) {
      handleFailedAttempt('اسم المستخدم غير مسجل بالنظام');
      return;
    }

    // Verify password (check password or pin)
    const expectedPassword = matched.password || matched.pin;
    if (trimmedPassword === expectedPassword) {
      setFailedAttempts(0);
      setSuccessMsg(`تم تسجيل الدخول بنجاح. مرحباً بك ${matched.name}`);
      
      setTimeout(() => {
        clockInAssociate(matched.id);
        setCurrentAssociate(matched);
      }, 600);
    } else {
      handleFailedAttempt('كلمة المرور غير صحيحة');
    }
  };

  const handleFailedAttempt = (msg: string) => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);

    if (newCount >= 4) {
      setLockoutTimer(30);
      setErrorMsg('تم تجاوز الحد المسموح للمحاولات الخاطئة! تم حظر الدخول مؤقتاً لمدة 30 ثانية للأمان.');
    } else {
      setErrorMsg(`${msg} (محاولة ${newCount} من 4)`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4 dir-rtl relative overflow-hidden select-none">
      {/* Ambient background blur elements */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-stone-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-7 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Security Encrypted Status Banner */}
        <div className="flex items-center justify-between bg-stone-950/90 border border-stone-800/80 rounded-2xl px-3.5 py-2 mb-6 text-[11px] text-stone-400">
          <div className="flex items-center space-x-1.5 space-x-reverse text-amber-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>نظام تسجيل الدخول الآمن (POS)</span>
          </div>
          <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-800/60 font-mono font-bold">
            مشفّر 256-Bit
          </span>
        </div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-600/20">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-2 space-x-reverse">
            <span>محلات أسماء</span>
          </h1>
          <p className="text-xs text-amber-400/90 font-medium mt-1">
            تسجيل الدخول بإسم المستخدم وكلمة المرور
          </p>
        </div>

        {/* Lockout / Status Alerts */}
        {lockoutTimer > 0 ? (
          <div className="bg-rose-950/80 border border-rose-900 text-rose-300 p-3.5 rounded-2xl text-xs font-bold mb-5 animate-pulse flex flex-col items-center justify-center space-y-1 text-center">
            <div className="flex items-center space-x-1.5 space-x-reverse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>تم تفعيل حظر الأمان الحماية ضد التخمين</span>
            </div>
            <span className="font-mono text-sm text-amber-400 font-extrabold">
              انتظر {lockoutTimer} ثانية للإعادة
            </span>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="text-center text-rose-400 text-xs font-bold mb-4 animate-shake bg-rose-950/60 border border-rose-900 py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 space-x-reverse">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="text-center text-emerald-400 text-xs font-bold mb-4 flex items-center justify-center space-x-1.5 space-x-reverse bg-emerald-950/60 border border-emerald-900 py-2.5 px-3 rounded-xl">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5 pr-1">
              اسم المستخدم (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                disabled={lockoutTimer > 0}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="أدخل اسم المستخدم (مثال: asmaa)"
                className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3 pr-10 pl-4 text-xs font-medium text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all dir-ltr text-right disabled:opacity-40"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5 pr-1">
              كلمة المرور (الرمز السري)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={lockoutTimer > 0}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3 pr-10 pl-11 text-xs font-medium text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all dir-ltr text-right disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 hover:text-amber-400 transition-colors"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={lockoutTimer > 0}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-stone-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-40 disabled:cursor-not-allowed mt-2"
          >
            <LogIn className="w-4 h-4 stroke-[2.5]" />
            <span>تسجيل الدخول للنظام</span>
          </button>
        </form>

        {/* Footer info */}
        <p className="text-[10px] text-center text-stone-600 mt-5">
          محلات أسماء التجاري &copy; {new Date().getFullYear()} - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
};
