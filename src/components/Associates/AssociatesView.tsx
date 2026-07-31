import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Associate } from '../../types';
import {
  Users,
  UserPlus,
  Award,
  TrendingUp,
  Key,
  Clock,
  Sparkles,
  DollarSign,
  Edit,
  X,
  Check,
} from 'lucide-react';

export const AssociatesView: React.FC = () => {
  const { associates, transactions, addAssociate, updateAssociate } = usePOS();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: 'مسؤول مبيعات' as Associate['role'],
    pin: '',
    email: '',
    phone: '',
    commissionRate: 5, // %
    dailyGoal: 15000,
    hourlyRate: 35,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      role: 'مسؤول مبيعات',
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      email: '',
      phone: '',
      commissionRate: 5,
      dailyGoal: 15000,
      hourlyRate: 35,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    });
    setEditingAssociate(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (assoc: Associate) => {
    setEditingAssociate(assoc);
    setFormData({
      name: assoc.name,
      role: assoc.role,
      pin: assoc.pin,
      email: assoc.email,
      phone: assoc.phone,
      commissionRate: assoc.commissionRate * 100,
      dailyGoal: assoc.dailyGoal,
      hourlyRate: assoc.hourlyRate,
      avatar: assoc.avatar,
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.pin) return;

    if (editingAssociate) {
      updateAssociate({
        ...editingAssociate,
        name: formData.name,
        role: formData.role,
        pin: formData.pin,
        email: formData.email,
        phone: formData.phone,
        commissionRate: formData.commissionRate / 100,
        dailyGoal: formData.dailyGoal,
        hourlyRate: formData.hourlyRate,
        avatar: formData.avatar,
      });
    } else {
      addAssociate({
        name: formData.name,
        role: formData.role,
        pin: formData.pin,
        email: formData.email,
        phone: formData.phone,
        commissionRate: formData.commissionRate / 100,
        dailyGoal: formData.dailyGoal,
        hourlyRate: formData.hourlyRate,
        avatar: formData.avatar,
      });
    }

    setIsAddModalOpen(false);
  };

  // Calculate totals per associate from transactions
  const getAssociateStats = (assocId: string) => {
    let totalSales = 0;
    let totalCommission = 0;
    let salesCount = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'ملغاة') return;
      tx.commissions.forEach((comm) => {
        if (comm.associateId === assocId) {
          totalSales += comm.saleAmount;
          totalCommission += comm.commissionAmount;
          salesCount += 1;
        }
      });
    });

    return { totalSales, totalCommission, salesCount };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
              فريق المبيعات وحساب العمولات
            </h1>
            <p className="text-xs text-stone-400">
              أسماء للأدوات المنزلية • متابعة المبيعات اليومية ونسب العمولات والرمز السري
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة بائع جديد</span>
        </button>
      </div>

      {/* Roster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {associates.map((assoc) => {
          const stats = getAssociateStats(assoc.id);
          const goalProgress = Math.min(100, Math.round((stats.totalSales / assoc.dailyGoal) * 100));

          return (
            <div
              key={assoc.id}
              className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              <div>
                {/* Status Indicator Pill */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 space-x-reverse ${
                      assoc.isClockedIn
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-stone-950 text-stone-500 border border-stone-800'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{assoc.isClockedIn ? 'على رأس العمل' : 'خارج وردية'}</span>
                  </span>

                  <button
                    onClick={() => handleOpenEdit(assoc)}
                    className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                {/* Associate Main Details */}
                <div className="flex items-center space-x-3.5 space-x-reverse mb-4">
                  <img
                    src={assoc.avatar}
                    alt={assoc.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/40"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-stone-100">{assoc.name}</h3>
                    <p className="text-xs text-amber-400 font-bold">{assoc.role}</p>
                    <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-stone-400 mt-1">
                      <Key className="w-3 h-3 text-stone-500" />
                      <span className="font-mono">PIN: {assoc.pin}</span>
                      <span>•</span>
                      <span>{(assoc.commissionRate * 100).toFixed(1)}% عمولة</span>
                    </div>
                  </div>
                </div>

                {/* Daily Goal Progress */}
                <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">الهدف اليومي للمبيعات:</span>
                    <span className="font-mono font-bold text-stone-200">
                      {stats.totalSales.toLocaleString()} / {assoc.dailyGoal.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${goalProgress}%` }}
                    />
                  </div>
                </div>

                {/* Performance Stats Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block mb-0.5">
                      إجمالي المبيعات
                    </span>
                    <span className="font-mono font-extrabold text-stone-100 text-sm">
                      {stats.totalSales.toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] text-stone-400 block font-mono">
                      ({stats.salesCount} فاتورة)
                    </span>
                  </div>

                  <div className="bg-stone-950 border border-stone-800 rounded-2xl p-3">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block mb-0.5">
                      عمولة البائع
                    </span>
                    <span className="font-mono font-extrabold text-amber-400 text-sm">
                      +{stats.totalCommission.toFixed(1)} ج.م
                    </span>
                    <span className="text-[10px] text-stone-400 block">مستحقة الصرف</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4">
              {editingAssociate ? 'تعديل بيانات البائع' : 'تسجيل بائع جديد'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">اسم البائع بالكامل</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 mb-1">المسمى الوظيفي</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as Associate['role'] })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                  >
                    <option value="مسؤول مبيعات">مسؤول مبيعات</option>
                    <option value="بائع أول">بائع أول</option>
                    <option value="مشرف قسم">مشرف قسم</option>
                    <option value="مدير الفرع">مدير الفرع</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">رمز PIN للدخول</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 mb-1">نسبة العمولة (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.commissionRate}
                    onChange={(e) =>
                      setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">الهدف اليومي (ج.م)</label>
                  <input
                    type="number"
                    value={formData.dailyGoal}
                    onChange={(e) =>
                      setFormData({ ...formData, dailyGoal: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg mt-4"
              >
                {editingAssociate ? 'حفظ التعديلات' : 'إضافة البائع'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AssociatesView;
