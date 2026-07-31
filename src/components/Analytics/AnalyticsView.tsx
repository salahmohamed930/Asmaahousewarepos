import React from 'react';
import { usePOS } from '../../context/POSContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Award,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { transactions, associates, voidTransaction } = usePOS();

  const validTransactions = transactions.filter((t) => t.status === 'مكتملة');

  // Total metrics
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.grandTotal, 0);
  const totalDiscounts = validTransactions.reduce((acc, t) => acc + t.discountTotal, 0);
  const totalOrders = validTransactions.length;

  // Revenue breakdown by Price Tier (كاش / تقسيط / جملة)
  let cashRevenue = 0;
  let installmentRevenue = 0;
  let wholesaleRevenue = 0;

  validTransactions.forEach((t) => {
    t.items.forEach((item) => {
      if (item.priceTier === 'cash') cashRevenue += item.totalPrice;
      else if (item.priceTier === 'installment') installmentRevenue += item.totalPrice;
      else if (item.priceTier === 'wholesale') wholesaleRevenue += item.totalPrice;
    });
  });

  // Total Commissions paid out
  let totalCommissionsPaid = 0;
  validTransactions.forEach((t) => {
    t.commissions.forEach((c) => {
      totalCommissionsPaid += c.commissionAmount;
    });
  });

  // Top Associate Leaderboard
  const associatePerformanceMap: Record<
    string,
    { name: string; avatar: string; sales: number; commission: number; count: number }
  > = {};

  associates.forEach((a) => {
    associatePerformanceMap[a.id] = {
      name: a.name,
      avatar: a.avatar,
      sales: 0,
      commission: 0,
      count: 0,
    };
  });

  validTransactions.forEach((t) => {
    t.commissions.forEach((c) => {
      if (associatePerformanceMap[c.associateId]) {
        associatePerformanceMap[c.associateId].sales += c.saleAmount;
        associatePerformanceMap[c.associateId].commission += c.commissionAmount;
        associatePerformanceMap[c.associateId].count += 1;
      }
    });
  });

  const sortedLeaderboard = Object.values(associatePerformanceMap).sort(
    (a, b) => b.sales - a.sales
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex items-center space-x-3 space-x-reverse bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
        <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-stone-100">
            تقارير المبيعات وتحليلات الأرباح
          </h1>
          <p className="text-xs text-stone-400">
            أسماء للأدوات المنزلية • توزيع المبيعات (كاش - تقسيط - جملة) وعمولات البائعين
          </p>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
          <span className="text-xs text-stone-400 font-bold block">إجمالي الإيرادات</span>
          <span className="text-2xl font-mono font-extrabold text-amber-400 block">
            {totalRevenue.toLocaleString()} ج.م
          </span>
          <span className="text-[10px] text-stone-500">من {totalOrders} عملية بيع</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
          <span className="text-xs text-emerald-400 font-bold block">مبيعات الكاش 💵</span>
          <span className="text-2xl font-mono font-extrabold text-stone-100 block">
            {cashRevenue.toLocaleString()} ج.م
          </span>
          <span className="text-[10px] text-stone-500">تحصيل فوري</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
          <span className="text-xs text-amber-400 font-bold block">مبيعات التقسيط 📅</span>
          <span className="text-2xl font-mono font-extrabold text-stone-100 block">
            {installmentRevenue.toLocaleString()} ج.م
          </span>
          <span className="text-[10px] text-stone-500">عقود تقسيط شهري</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-1">
          <span className="text-xs text-indigo-400 font-bold block">مبيعات الجملة 📦</span>
          <span className="text-2xl font-mono font-extrabold text-stone-100 block">
            {wholesaleRevenue.toLocaleString()} ج.م
          </span>
          <span className="text-[10px] text-stone-500">أوامر توريد جملة</span>
        </div>
      </div>

      {/* Leaderboard & Price Tier Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Associate Sales Leaderboard (7 Cols) */}
        <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold text-stone-100">
              ترتيب كفاءة البائعين وحساب العمولات
            </h2>
          </div>

          <div className="space-y-3">
            {sortedLeaderboard.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-stone-950 border border-stone-800 rounded-2xl p-3.5"
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <span className="w-6 h-6 bg-stone-900 border border-stone-800 text-amber-400 font-mono font-bold rounded-lg text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-9 h-9 rounded-xl object-cover ring-2 ring-stone-800"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-100 block">{item.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {item.count} عمليات بيع ناجحة
                    </span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-xs font-mono font-bold text-stone-100 block">
                    {item.sales.toLocaleString()} ج.م
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-400">
                    +{item.commission.toFixed(1)} ج.م عمولة
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Tier Distribution (5 Cols) */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-extrabold text-stone-100">
              توزيع المبيعات حسب نظام السعر
            </h2>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400 font-bold">كاش (نقدي)</span>
                <span className="font-mono text-stone-200">
                  {totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${
                      totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-400 font-bold">تقسيط شهري</span>
                <span className="font-mono text-stone-200">
                  {totalRevenue > 0 ? Math.round((installmentRevenue / totalRevenue) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${
                      totalRevenue > 0 ? Math.round((installmentRevenue / totalRevenue) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-indigo-400 font-bold">حسابات الجملة</span>
                <span className="font-mono text-stone-200">
                  {totalRevenue > 0 ? Math.round((wholesaleRevenue / totalRevenue) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${
                      totalRevenue > 0 ? Math.round((wholesaleRevenue / totalRevenue) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 mt-6 text-xs text-stone-400 space-y-1">
              <div className="flex justify-between">
                <span>إجمالي العمولات المستحقة للبائعين:</span>
                <span className="font-mono font-bold text-amber-400">
                  {totalCommissionsPaid.toFixed(1)} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span>إجمالي الخصومات الممنوحة:</span>
                <span className="font-mono text-stone-300">
                  {totalDiscounts.toLocaleString()} ج.م
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Transaction History Log Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-extrabold text-stone-100">سجل الفواتير والمعاملات الحديثة</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="text-stone-400 border-b border-stone-800 font-bold uppercase pb-2">
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">البائع المسؤول</th>
                <th className="p-3">العميل</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3">الإجمالي</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-stone-950/50 transition-colors">
                  <td className="p-3 font-mono font-bold text-stone-200">{tx.receiptNumber}</td>
                  <td className="p-3 text-stone-400">
                    {new Date(tx.timestamp).toLocaleString('ar-EG')}
                  </td>
                  <td className="p-3 font-bold text-amber-400">{tx.primaryAssociateName}</td>
                  <td className="p-3 text-stone-300">{tx.customerName || 'عميل نقدي'}</td>
                  <td className="p-3 text-stone-300">{tx.paymentMethod}</td>
                  <td className="p-3 font-mono font-extrabold text-stone-100">
                    {tx.grandTotal.toLocaleString()} ج.م
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        tx.status === 'مكتملة'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {tx.status === 'مكتملة' && (
                      <button
                        onClick={() => {
                          if (confirm(`إلغاء الفاتورة ${tx.receiptNumber}؟`)) {
                            voidTransaction(tx.id);
                          }
                        }}
                        className="text-stone-500 hover:text-rose-400 text-[11px] font-bold underline"
                      >
                        إلغاء الفاتورة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsView;
