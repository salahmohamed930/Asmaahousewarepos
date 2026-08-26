import React, { useState } from 'react';
import { Customer, Transaction, PaymentMethod } from '../../types';
import { usePOS } from '../../context/POSContext';
import { 
  X, 
  FileText, 
  CreditCard, 
  History, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  PlusCircle,
  Sparkles,
  Phone,
  Mail,
  UserCheck,
  MapPin,
  Edit,
  Save,
  User
} from 'lucide-react';

interface CustomerAccountModalProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
}

type ActiveSubTab = 'overview' | 'invoices' | 'payments';

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  customer,
  isOpen,
  onClose
}) => {
  const { transactions, payCustomerDebt, currentAssociate, updateCustomer } = usePOS();
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('overview');
  
  // Basic Info States (Name, Phone, Email)
  const [customerName, setCustomerName] = useState<string>(customer.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(customer.phone || '');
  const [customerEmail, setCustomerEmail] = useState<string>(customer.email || '');
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState<boolean>(false);
  const [basicInfoSuccess, setBasicInfoSuccess] = useState<string>('');

  // Credit eligibility states
  const [isCreditEligible, setIsCreditEligible] = useState<boolean>(customer.isCreditEligible || false);
  const [creditLimitInput, setCreditLimitInput] = useState<string>(String(customer.creditLimit || 0));
  const [creditSuccess, setCreditSuccess] = useState<string>('');

  // Customer notes state
  const [customerNotes, setCustomerNotes] = useState<string>(customer.notes || '');
  const [notesSavedMessage, setNotesSavedMessage] = useState<string>('');

  // Customer address state
  const [customerAddress, setCustomerAddress] = useState<string>(customer.address || '');
  const [addressSavedMessage, setAddressSavedMessage] = useState<string>('');

  React.useEffect(() => {
    setCustomerName(customer.name || '');
    setCustomerPhone(customer.phone || '');
    setCustomerEmail(customer.email || '');
    setIsCreditEligible(customer.isCreditEligible || false);
    setCreditLimitInput(String(customer.creditLimit || 0));
    setCustomerNotes(customer.notes || '');
    setCustomerAddress(customer.address || '');
  }, [customer]);

  // Payment states
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');

  if (!isOpen) return null;

  const handleSaveBasicInfo = () => {
    if (!customerName.trim()) return;
    updateCustomer({
      ...customer,
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail.trim(),
    });
    setBasicInfoSuccess('تم حفظ اسم العميل ورقم الهاتف بنجاح!');
    setIsEditingBasicInfo(false);
    setTimeout(() => setBasicInfoSuccess(''), 3000);
  };

  // Filter transactions for this customer
  const customerTx = transactions.filter(t => t.customerId === customer.id);
  
  // Filter invoices (excluding pure debt payments)
  const invoices = customerTx.filter(t => {
    const isPayment = t.items.some(item => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || t.id.startsWith('pay_'));
    return !isPayment;
  });

  // Filter payments
  const payments = customerTx.filter(t => {
    return t.items.some(item => item.productId === 'debt_payment' || (item as any).product?.id === 'debt_payment' || t.id.startsWith('pay_'));
  });

  const currentDebt = customer.currentDebt || 0;
  const creditLimit = customer.creditLimit || 0;
  const remainingLimit = customer.isCreditEligible ? Math.max(0, creditLimit - currentDebt) : 0;

  const handlePayDebt = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('برجاء إدخال مبلغ صحيح أكبر من صفر.');
      return;
    }

    if (amt > currentDebt) {
      setPaymentError(`المبلغ المدخل (${amt.toLocaleString()} ج.م) أكبر من قيمة المديونية الحالية (${currentDebt.toLocaleString()} ج.م).`);
      return;
    }

    try {
      payCustomerDebt(customer.id, amt, paymentMethod, paymentNotes);
      setPaymentSuccess(`تم تسجيل دفعة السداد بقيمة ${amt.toLocaleString()} ج.م بنجاح!`);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError('حدث خطأ أثناء تسجيل عملية السداد.');
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-stone-100">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center space-x-3 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            
            {!isEditingBasicInfo ? (
              <div className="flex-1">
                <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
                  <h2 className="text-lg font-extrabold text-stone-100">كشف حساب العميل: {customer.name}</h2>
                  <button
                    onClick={() => setIsEditingBasicInfo(true)}
                    className="text-[11px] px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-bold transition-all flex items-center space-x-1 space-x-reverse"
                    title="تعديل اسم العميل ورقم الهاتف"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل الاسم / الهاتف</span>
                  </button>
                </div>
                <div className="flex items-center space-x-4 space-x-reverse text-xs text-stone-400 mt-1">
                  <span className="flex items-center space-x-1 space-x-reverse font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-500" />
                    <span>{customer.phone}</span>
                  </span>
                  {customer.email && (
                    <span className="flex items-center space-x-1 space-x-reverse">
                      <Mail className="w-3.5 h-3.5 text-stone-500" />
                      <span>{customer.email}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-stone-950 p-3 rounded-2xl border border-amber-500/40 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-1">اسم العميل</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 text-xs focus:border-amber-500 focus:outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-100 text-xs font-mono focus:border-amber-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                  <button
                    onClick={() => {
                      setCustomerName(customer.name || '');
                      setCustomerPhone(customer.phone || '');
                      setIsEditingBasicInfo(false);
                    }}
                    className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveBasicInfo}
                    className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 space-x-reverse"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-stone-950/60 border-b border-stone-800 px-6 py-2 shrink-0 flex space-x-2 space-x-reverse overflow-x-auto">
          <button
            onClick={() => { setActiveTab('overview'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'overview'
                ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>ملخص الحساب والمديونية</span>
          </button>

          <button
            onClick={() => { setActiveTab('invoices'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'invoices'
                ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>فواتير المبيعات ({invoices.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('payments'); setPaymentSuccess(''); setPaymentError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse ${
              activeTab === 'payments'
                ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المدفوعات والسداد ({payments.length})</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Financial Summary */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Credit Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">إجمالي المديونية الحالية</span>
                    <span className={`font-mono text-lg font-extrabold block ${currentDebt > 0 ? 'text-rose-400 animate-pulse' : 'text-stone-400'}`}>
                      {currentDebt.toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">الحد الائتماني الكلي</span>
                    <span className="font-mono text-lg font-extrabold text-stone-300 block">
                      {customer.isCreditEligible ? `${creditLimit.toLocaleString()} ج.م` : 'غير مفعل'}
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 p-4 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-500 block mb-1 font-bold">الحد المتبقي للآجل</span>
                    <span className="font-mono text-lg font-extrabold text-emerald-400 block">
                      {customer.isCreditEligible ? `${remainingLimit.toLocaleString()} ج.م` : '0 ج.م'}
                    </span>
                  </div>
                </div>

                {/* Loyalty & Purchases */}
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-stone-400 block mb-1 font-medium">نقاط الولاء النشطة</span>
                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-mono font-extrabold text-amber-400 text-sm">{customer.loyaltyPoints} نقطة</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 block mb-1 font-medium">إجمالي حجم المبيعات (المدفوع والآجل)</span>
                    <span className="font-mono font-extrabold text-stone-100 text-sm">{(customer.totalSpent || 0).toLocaleString()} ج.م</span>
                  </div>
                </div>

                {/* Account Details Checklist */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-stone-400 mb-2 border-b border-stone-900 pb-2">تفاصيل العضوية والآجل</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">حالة أهلية الآجل:</span>
                      <span className={customer.isCreditEligible ? "text-emerald-400 font-bold" : "text-rose-400"}>
                        {customer.isCreditEligible ? "مؤهل للآجل والجملة" : "غير مؤهل"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">فئة الأسعار الافتراضية:</span>
                      <span className="text-stone-300 font-bold">
                        {customer.isCreditEligible ? "سعر الجملة آجل" : "نقدي عادي"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">مجموع الفواتير المسجلة:</span>
                      <span className="text-stone-300 font-mono font-bold">{invoices.length} فواتير</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">دفعات السداد المكتملة:</span>
                      <span className="text-emerald-400 font-mono font-bold">{payments.length} عمليات</span>
                    </div>
                  </div>
                </div>

                {/* Customer Basic Info (Name & Phone Edit) */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                      <User className="w-3.5 h-3.5" />
                      <span>تعديل اسم العميل ورقم الهاتف</span>
                    </h4>
                  </div>

                  {basicInfoSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-2.5 flex items-center space-x-1.5 space-x-reverse">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>{basicInfoSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-stone-400 mb-1 font-medium">اسم العميل / اسم المحل</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسم العميل..."
                        className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-400 mb-1 font-medium">رقم الهاتف</label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="رقم الهاتف..."
                        className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 font-mono focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-stone-400 mb-1 font-medium">البريد الإلكتروني (اختياري)</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="البريد الإلكتروني..."
                        className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-stone-500">سيتم حفظ التعديلات فوراً في حساب العميل والقواعد البيانات</span>
                    <button
                      type="button"
                      onClick={handleSaveBasicInfo}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ تعديلات البيانات</span>
                    </button>
                  </div>
                </div>

                {/* Customer Address / عنوان العميل */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>عنوان / سكن العميل</span>
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="اكتب عنوان العميل هنا بالتفصيل..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs"
                    />
                    <div className="flex justify-between items-center">
                      {addressSavedMessage ? (
                        <span className="text-[10px] text-emerald-400 font-bold animate-pulse">{addressSavedMessage}</span>
                      ) : (
                        <span className="text-[10px] text-stone-500">سيتم حفظ العنوان في قاعدة بيانات العميل</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateCustomer({
                            ...customer,
                            address: customerAddress
                          });
                          setAddressSavedMessage('تم حفظ العنوان بنجاح!');
                          setTimeout(() => setAddressSavedMessage(''), 3000);
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] rounded-xl transition-all"
                      >
                        حفظ العنوان
                      </button>
                    </div>
                  </div>
                </div>

                {/* Customer Notes / ملاحظات العميل */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                      <FileText className="w-3.5 h-3.5" />
                      <span>ملاحظات ومذكرة خاصة بالعميل</span>
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <textarea
                      placeholder="اكتب أي ملاحظات خاصة بهذا العميل هنا (مثلاً: ملاحظات عن سداد الأقساط، شروط خاصة بالدفع، طريقة التعامل المفضلة)..."
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-stone-900 border border-stone-850 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 text-xs"
                    />
                    <div className="flex justify-between items-center">
                      {notesSavedMessage ? (
                        <span className="text-[10px] text-emerald-400 font-bold animate-pulse">{notesSavedMessage}</span>
                      ) : (
                        <span className="text-[10px] text-stone-500">سيتم حفظ هذه الملاحظات بشكل دائم في حساب العميل</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateCustomer({
                            ...customer,
                            notes: customerNotes
                          });
                          setNotesSavedMessage('تم حفظ الملاحظات بنجاح!');
                          setTimeout(() => setNotesSavedMessage(''), 3000);
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] rounded-xl transition-all"
                      >
                        حفظ الملاحظات
                      </button>
                    </div>
                  </div>
                </div>

                {/* Credit Eligibility / Qualification Form */}
                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <h4 className="text-xs font-bold text-stone-200">إدارة تأهيل الشراء الآجل</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isCreditEligible ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                    }`}>
                      {isCreditEligible ? 'مؤهل للشراء الآجل والجملة' : 'غير مؤهل حالياً'}
                    </span>
                  </div>

                  {creditSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-2.5 flex items-start space-x-1.5 space-x-reverse">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{creditSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-stone-400 block font-medium">تغيير حالة أهلية الآجل</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !isCreditEligible;
                          setIsCreditEligible(nextVal);
                          if (!nextVal) {
                            setCreditLimitInput('0');
                          } else if (parseFloat(creditLimitInput) === 0) {
                            setCreditLimitInput('10000');
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold border transition-all flex items-center justify-center space-x-2 space-x-reverse ${
                          isCreditEligible 
                            ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-stone-900 hover:bg-stone-850 text-stone-300 border-stone-800'
                        }`}
                      >
                        <CheckCircle className={`w-4 h-4 ${isCreditEligible ? 'text-emerald-400' : 'text-stone-500'}`} />
                        <span>{isCreditEligible ? 'مؤهل (اضغط لإلغاء التأهيل)' : 'غير مؤهل (اضغط للتأهيل)'}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 block font-medium">سقف المديونية / حد الائتمان (ج.م)</label>
                      <input
                        type="number"
                        disabled={!isCreditEligible}
                        value={creditLimitInput}
                        onChange={(e) => setCreditLimitInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-700 font-mono text-left focus:border-amber-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-stone-900">
                    <button
                      type="button"
                      onClick={() => {
                        const limit = parseFloat(creditLimitInput) || 0;
                        updateCustomer({
                          ...customer,
                          isCreditEligible,
                          creditLimit: isCreditEligible ? limit : 0
                        });
                        setCreditSuccess('تم تحديث بيانات تأهيل الشراء الآجل بنجاح!');
                        setTimeout(() => setCreditSuccess(''), 3000);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-bold rounded-xl transition-all text-xs"
                    >
                      حفظ تعديلات التأهيل
                    </button>
                  </div>
                </div>

              </div>

              {/* Record Debt Payment Form (سداد المديونية) */}
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 space-x-reverse mb-4 border-b border-stone-900 pb-3">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-extrabold text-stone-200">تسجيل دفعة سداد آجل</h3>
                  </div>

                  {paymentSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-3 mb-4 flex items-start space-x-2 space-x-reverse">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{paymentSuccess}</span>
                    </div>
                  )}

                  {paymentError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl p-3 mb-4 flex items-start space-x-2 space-x-reverse">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {currentDebt === 0 ? (
                    <div className="text-center py-6 text-stone-500 space-y-2">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto opacity-40" />
                      <p className="text-xs">العميل ليس عليه مديونيات مستحقة في الوقت الحالي.</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePayDebt} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-stone-400 mb-1 font-medium">مبلغ السداد المستلم (ج.م)</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            placeholder="0.00"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-700 text-left font-mono focus:border-amber-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setPaymentAmount(currentDebt.toString())}
                            className="absolute left-2.5 top-1.5 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/20 transition-all font-bold"
                          >
                            سداد الكل
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-stone-400 mb-1 font-medium">طريقة السداد</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="كاش">كاش (نقدي)</option>
                          <option value="شبكة / فيزا">شبكة / فيزا (إلكتروني)</option>
                          <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-stone-400 mb-1 font-medium">ملاحظات أو رقم الإيصال (اختياري)</label>
                        <textarea
                          placeholder="ملاحظات حول دفعة السداد..."
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-700 focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 space-x-reverse"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>تسجيل سداد الدفعة</span>
                      </button>
                    </form>
                  )}
                </div>

                <div className="text-[10px] text-stone-500 pt-3 border-t border-stone-900 text-center mt-4">
                  مسؤول الكاشير: {currentAssociate?.name || 'النظام'}
                </div>
              </div>

            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-stone-500 space-y-3 bg-stone-950/40 border border-stone-800/60 rounded-3xl">
                  <FileText className="w-12 h-12 text-stone-600 mx-auto" />
                  <p className="text-xs">لم يتم العثور على فواتير مبيعات سابقة لهذا العميل.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((tx, idx) => {
                    const totalItemsCount = tx.items.reduce((sum, item) => sum + item.quantity, 0);
                    return (
                      <div 
                        key={tx.id && tx.id !== 'null' ? tx.id : `inv_${idx}`}
                        className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 hover:border-stone-700 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <span className="font-mono font-bold text-amber-400 text-sm">{tx.receiptNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === 'ملغاة' 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 space-x-reverse text-stone-400 text-[11px]">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-stone-600" />
                              <span>{new Date(tx.timestamp).toLocaleString('ar-EG')}</span>
                            </span>
                            <span>•</span>
                            <span>البائع: {tx.primaryAssociateName}</span>
                          </div>
                        </div>

                        {/* Items Preview */}
                        <div className="bg-stone-900/60 rounded-xl p-2.5 max-w-xs w-full text-[11px] text-stone-400 border border-stone-800/50">
                          <span className="font-bold text-stone-300 block mb-1">المنتجات ({totalItemsCount}):</span>
                          <p className="truncate">
                            {tx.items.map(item => `${item.productName || (item as any).product?.name || 'منتج'} (x${item.quantity})`).join('، ')}
                          </p>
                        </div>

                        {/* Totals & Debt info */}
                        <div className="text-left font-mono shrink-0 flex flex-col justify-end">
                          <div className="text-stone-300 font-extrabold text-sm mb-1">
                            {tx.grandTotal.toLocaleString()} ج.م
                          </div>
                          
                          {tx.amountDeferred !== undefined && tx.amountDeferred > 0 && (
                            <div className="text-[10px] text-rose-400 font-bold bg-rose-500/5 border border-rose-500/10 px-1.5 py-0.5 rounded">
                              مرحل آجل: {tx.amountDeferred.toLocaleString()} ج.م
                            </div>
                          )}
                          {tx.amountPaid !== undefined && tx.amountPaid > 0 && (
                            <div className="text-[10px] text-emerald-400 mt-0.5">
                              مدفوع كاشير: {tx.amountPaid.toLocaleString()} ج.م
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS LOG TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-stone-500 space-y-3 bg-stone-950/40 border border-stone-800/60 rounded-3xl">
                  <History className="w-12 h-12 text-stone-600 mx-auto" />
                  <p className="text-xs">لا يوجد سجلات سداد أو دفعات مديونية مسجلة سابقاً.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((p, idx) => {
                    return (
                      <div 
                        key={p.id && p.id !== 'null' ? p.id : `pmt_${idx}`}
                        className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 hover:border-stone-700 transition-all text-xs flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <span className="font-mono font-bold text-emerald-400">{p.receiptNumber}</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-500/20 font-bold">
                              عملية سداد دفعة
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 space-x-reverse text-stone-400 text-[11px]">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-stone-600" />
                              <span>{new Date(p.timestamp).toLocaleString('ar-EG')}</span>
                            </span>
                            <span>•</span>
                            <span>الكاشير: {p.primaryAssociateName}</span>
                          </div>
                          {p.notes && (
                            <p className="text-stone-400 text-[11px] bg-stone-900/40 p-1.5 rounded-lg border border-stone-800/40 inline-block mt-1">
                              ملاحظة: {p.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-left font-mono">
                          <div className="text-emerald-400 font-extrabold text-base">
                            + {Math.abs(p.grandTotal).toLocaleString()} ج.م
                          </div>
                          <span className="text-[10px] text-stone-500">طريقة السداد: {p.paymentMethod}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
