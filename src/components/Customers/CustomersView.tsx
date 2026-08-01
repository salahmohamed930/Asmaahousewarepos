import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer } from '../../types';
import { UserCheck, UserPlus, Search, ShoppingBag, Heart, X, Phone, Mail, FileText } from 'lucide-react';
import { CustomerAccountModal } from './CustomerAccountModal';

export const CustomersView: React.FC = () => {
  const {
    customers,
    associates,
    addCustomer,
    setSelectedCustomer,
    setActiveTab,
  } = usePOS();

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountCust, setSelectedAccountCust] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    preferredAssociateId: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    isCreditEligible: false,
    creditLimit: 0,
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      preferredAssociateId: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      isCreditEligible: false,
      creditLimit: 0,
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    addCustomer(formData);
    setIsAddModalOpen(false);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              دليل العملاء وحسابات الآجل والجملة
            </h1>
            <p className="text-xs text-stone-400">
              أسماء للأدوات المنزلية • متابعة مشتريات العملاء، نقاط الولاء، والبائع المفضّل
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>تسجيل عميل جديد</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث باسم العميل، رقم الهاتف، أو البريد الإلكتروني..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-200 rounded-xl pr-10 pl-8 py-2.5 focus:outline-none focus:border-amber-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 transition-colors"
              title="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((cust) => {
          const prefAssoc = cust.preferredAssociateId
            ? associates.find((a) => a.id === cust.preferredAssociateId)
            : null;

          const currentDebt = cust.currentDebt || 0;

          return (
            <div
              key={cust.id}
              className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between hover:border-stone-700 transition-all"
            >
              <div 
                onClick={() => setSelectedAccountCust(cust)}
                className="cursor-pointer group space-y-3"
                title="اضغط لفتح كشف حساب العميل والمديونيات والمدفوعات"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-11 h-11 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-100 group-hover:text-amber-400 transition-colors flex items-center gap-1.5 flex-wrap">
                        <span>{cust.name}</span>
                        {cust.isCreditEligible && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                            مؤهل للآجل
                          </span>
                        )}
                        {currentDebt > 0 && (
                          <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                            مستحق {currentDebt.toLocaleString()} ج.م
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-amber-400 font-mono flex items-center space-x-1 space-x-reverse mt-0.5">
                        <Phone className="w-3 h-3 text-stone-500" />
                        <span>{cust.phone}</span>
                      </p>
                      <p className="text-[10px] text-stone-500">{cust.email}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 bg-stone-950 border border-stone-800 rounded-2xl p-2.5 text-center text-[10px]">
                  <div>
                    <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                      نقاط الولاء
                    </span>
                    <span className="font-mono font-extrabold text-amber-400">
                      {cust.loyaltyPoints} ن
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                      المبيعات
                    </span>
                    <span className="font-mono font-extrabold text-stone-100">
                      {(cust.totalSpent || 0).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-stone-500 uppercase block font-bold mb-0.5">
                      المديونية
                    </span>
                    <span className={`font-mono font-extrabold block ${currentDebt > 0 ? 'text-rose-400' : 'text-stone-500'}`}>
                      {currentDebt > 0 ? `${currentDebt.toLocaleString()} ج.م` : '0'}
                    </span>
                  </div>
                </div>

                {prefAssoc && (
                  <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-stone-400 bg-stone-950/60 border border-stone-800/80 p-2 rounded-xl">
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
                    <span>البائع المفضل:</span>
                    <span className="font-semibold text-stone-200">{prefAssoc.name}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-stone-850 pt-3">
                <button
                  onClick={() => setSelectedAccountCust(cust)}
                  className="py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-400" />
                  <span>كشف الحساب</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedCustomer(cust);
                    setActiveTab('register');
                  }}
                  className="py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>فتح الكاشير</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4">إنشاء ملف عميل جديد</h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">اسم العميل / اسم المحل</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">البائع المفضل للعميل</label>
                <select
                  value={formData.preferredAssociateId}
                  onChange={(e) =>
                    setFormData({ ...formData, preferredAssociateId: e.target.value })
                  }
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                >
                  <option value="">بدون بائع محدد</option>
                  {associates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-stone-800 space-y-3">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isCreditEligible}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        isCreditEligible: e.target.checked,
                        creditLimit: e.target.checked ? 10000 : 0 
                      })
                    }
                    className="rounded border-stone-800 bg-stone-950 text-amber-600 focus:ring-amber-500 focus:ring-opacity-25"
                  />
                  <span className="text-stone-300 font-bold">تأهيل العميل للشراء الآجل والجملة</span>
                </label>

                {formData.isCreditEligible && (
                  <div>
                    <label className="block text-stone-400 mb-1">الحد الائتماني الكلي (سقف المديونية ج.م)</label>
                    <input
                      type="number"
                      value={formData.creditLimit || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="10000"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg mt-4"
              >
                حفظ ملف العميل
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Account Modal */}
      {selectedAccountCust && (
        <CustomerAccountModal
          customer={customers.find(c => c.id === selectedAccountCust.id) || selectedAccountCust}
          isOpen={true}
          onClose={() => setSelectedAccountCust(null)}
        />
      )}

    </div>
  );
};

export default CustomersView;
