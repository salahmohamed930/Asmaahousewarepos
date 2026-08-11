import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Associate, Permission } from '../../types';
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
  Shield,
  Lock,
  User,
  CheckSquare,
  Square,
} from 'lucide-react';

const ALL_PERMISSIONS: { id: Permission; label: string; desc: string }[] = [
  { id: 'create_invoice', label: 'إنشاء فواتير', desc: 'إمكانية إعداد وبيع الفواتير' },
  { id: 'view_analytics', label: 'عرض التقارير', desc: 'اطلاع على التقارير المالية والإحصائيات' },
  { id: 'manage_catalog', label: 'إدارة الأصناف', desc: 'إضافة وتعديل المنتجات والأسعار' },
  { id: 'manage_customers', label: 'حسابات العملاء', desc: 'إدارة واستعلام بيانات العملاء' },
  { id: 'manage_associates', label: 'إدارة الموظفين والصلاحيات', desc: 'إضافة وتعديل المستخدمين وتحديد صلاحياتهم' },
  { id: 'apply_discount', label: 'تطبيق الخصم', desc: 'خصم مبالغ من الفاتورة أثناء البيع' },
  { id: 'void_invoice', label: 'إلغاء الفواتير', desc: 'إلغاء أو تعديل الفواتير السابقة' },
];

export const AssociatesView: React.FC = () => {
  const { associates, transactions, addAssociate, updateAssociate } = usePOS();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    password: string;
    pin: string;
    role: Associate['role'];
    permissions: Permission[];
    email: string;
    phone: string;
    commissionRate: number;
    dailyGoal: number;
    hourlyRate: number;
    avatar: string;
  }>({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: 'مسؤول مبيعات',
    permissions: ['create_invoice', 'apply_discount'],
    email: '',
    phone: '',
    commissionRate: 5, // %
    dailyGoal: 15000,
    hourlyRate: 35,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  });

  const handleOpenAdd = () => {
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    const generatedPassword = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({
      name: '',
      username: '',
      password: generatedPassword,
      pin: generatedPin,
      role: 'مسؤول مبيعات',
      permissions: ['create_invoice', 'apply_discount'],
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
      username: assoc.username || assoc.name.split(' ')[0].toLowerCase(),
      password: assoc.password || assoc.pin,
      pin: assoc.pin,
      role: assoc.role,
      permissions: assoc.permissions || ['create_invoice', 'apply_discount'],
      email: assoc.email,
      phone: assoc.phone,
      commissionRate: assoc.commissionRate * 100,
      dailyGoal: assoc.dailyGoal,
      hourlyRate: assoc.hourlyRate,
      avatar: assoc.avatar,
    });
    setIsAddModalOpen(true);
  };

  const togglePermission = (permId: Permission) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permId);
      if (exists) {
        return { ...prev, permissions: prev.permissions.filter((p) => p !== permId) };
      } else {
        return { ...prev, permissions: [...prev.permissions, permId] };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.pin) return;

    const cleanUsername = formData.username.trim() || formData.name.trim().toLowerCase().replace(/\s+/g, '');
    const cleanPassword = formData.password.trim() || formData.pin;

    if (editingAssociate) {
      updateAssociate({
        ...editingAssociate,
        name: formData.name,
        username: cleanUsername,
        password: cleanPassword,
        role: formData.role,
        pin: formData.pin,
        permissions: formData.permissions,
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
        username: cleanUsername,
        password: cleanPassword,
        role: formData.role,
        pin: formData.pin,
        permissions: formData.permissions,
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
              إدارة الموظفين وصلاحيات المستخدمين
            </h1>
            <p className="text-xs text-stone-400">
              أسماء للأدوات المنزلية • التحكم في اسم المستخدم، كلمة المرور، ونظام الصلاحيات
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-950 flex items-center justify-center space-x-2 space-x-reverse transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم / بائع جديد</span>
        </button>
      </div>

      {/* Roster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {associates.map((assoc) => {
          const stats = getAssociateStats(assoc.id);
          const goalProgress = Math.min(100, Math.round((stats.totalSales / assoc.dailyGoal) * 100));

          const userPermissions = assoc.permissions || [
            'create_invoice',
            'apply_discount',
          ];

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
                    className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-colors flex items-center space-x-1 space-x-reverse bg-stone-950 border border-stone-800 px-2.5 py-1 text-xs"
                    title="تعديل المستخدم والصلاحيات"
                  >
                    <Edit className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-stone-300">تعديل</span>
                  </button>
                </div>

                {/* Associate Main Details */}
                <div className="flex items-start space-x-3.5 space-x-reverse mb-4">
                  <img
                    src={assoc.avatar}
                    alt={assoc.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/40 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold text-stone-100 truncate">{assoc.name}</h3>
                    <p className="text-xs text-amber-400 font-bold">{assoc.role}</p>

                    {/* Username & Password Display */}
                    <div className="bg-stone-950 border border-stone-800/90 rounded-xl p-2 mt-2 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 font-semibold flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-400" />
                          اسم المستخدم:
                        </span>
                        <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60">
                          {assoc.username || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-400" />
                          كلمة المرور:
                        </span>
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                          {assoc.password || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 font-semibold flex items-center gap-1">
                          <Key className="w-3 h-3 text-amber-500" />
                          كود البائع (PIN):
                        </span>
                        <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60">
                          {assoc.pin || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Granted Permissions Badges */}
                <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-3 mb-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-300 font-bold flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      الصلاحيات المفعّلة:
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                      ({userPermissions.length} صلاحيات)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {ALL_PERMISSIONS.map((perm) => {
                      const hasPerm = userPermissions.includes(perm.id);
                      return (
                        <span
                          key={perm.id}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            hasPerm
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                              : 'bg-stone-900/50 text-stone-600 border border-stone-800/40 line-through'
                          }`}
                        >
                          {hasPerm ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <X className="w-2.5 h-2.5 text-stone-600" />}
                          <span>{perm.label}</span>
                        </span>
                      );
                    })}
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
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4 flex items-center space-x-2 space-x-reverse">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>{editingAssociate ? 'تعديل بيانات وصلاحيات الموظف' : 'تسجيل موظف جديد وتحديد صلاحياته'}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Full Name */}
              <div>
                <label className="block text-stone-300 font-bold mb-1">اسم الموظف بالكامل</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أسماء علي"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Username, Password & PIN Edit Fields (ADMIN PERMISSION EDITING) */}
              <div className="bg-stone-950 border border-stone-800 p-3.5 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
                  <Lock className="w-4 h-4" />
                  <span>بيانات الدخول والأمان (اسم المستخدم، كلمة المرور، وكود البائع)</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-300 text-[11px] mb-1 font-bold">اسم المستخدم (Username)</label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="مثال: asmaa"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 text-[11px] mb-1 font-bold">كلمة المرور (للجهاز)</label>
                    <input
                      type="text"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="مثال: pass123"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 text-[11px] mb-1 font-bold">كود البائع (PIN للتبديل السريع)</label>
                    <input
                      type="text"
                      required
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      placeholder="مثال: 1001"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-amber-500 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                  * يُستخدم <strong className="text-stone-400">اسم المستخدم وكلمة المرور</strong> لتسجيل الدخول الكلي للنظام. بينما يُستخدم <strong className="text-stone-400">كود البائع (PIN)</strong> المكون من 4 أرقام للتبديل السريع وتسجيل مبيعات البائع في شاشة الكاشير.
                </p>
              </div>

              {/* User Permissions Checkboxes */}
              <div className="bg-stone-950 border border-stone-800 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-200 flex items-center space-x-1.5 space-x-reverse">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>تحديد الصلاحيات الممنوحة للمستخدم:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.permissions.length === ALL_PERMISSIONS.length) {
                        setFormData({ ...formData, permissions: ['create_invoice'] });
                      } else {
                        setFormData({ ...formData, permissions: ALL_PERMISSIONS.map((p) => p.id) });
                      }
                    }}
                    className="text-[10px] text-amber-400 hover:underline font-bold"
                  >
                    {formData.permissions.length === ALL_PERMISSIONS.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = formData.permissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-2 space-x-reverse ${
                          isChecked
                            ? 'bg-amber-950/40 border-amber-600/80 text-amber-200'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-bold text-xs block text-stone-100">{perm.label}</span>
                          <span className="text-[10px] text-stone-400 block">{perm.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Role & Commission Details */}
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
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-stone-400 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg mt-4 flex items-center justify-center space-x-2 space-x-reverse"
              >
                <Check className="w-4 h-4" />
                <span>{editingAssociate ? 'حفظ الحساب والصلاحيات' : 'إنشاء المستخدم والتفويضات'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AssociatesView;
