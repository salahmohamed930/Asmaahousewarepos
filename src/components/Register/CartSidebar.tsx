import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  FileText,
  Trash2,
  Users,
  UserPlus,
  ChevronDown,
  X,
  UserCheck,
  Plus,
  Minus,
  Search,
  CreditCard,
  Clock,
} from 'lucide-react';
import SplitAssociateModal from './SplitAssociateModal';

interface CartSidebarProps {
  onOpenCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ onOpenCheckout }) => {
  const {
    cart,
    currentAssociate,
    associates,
    quickSwitchByPin,
    setCurrentAssociate,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    addCustomer,
    splitAssociates,
    taxRate,
    globalPriceTier,
    updateCartQuantity,
    updateCartItemDiscount,
    updateCartItemAssociate,
    removeFromCart,
    clearCart,
    holdCart,
    getCartItemDiscountAmount,
    activeHeldTransactionId,
    transactions,
  } = usePOS();

  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);

  // Seller PIN state - starts EMPTY by default as requested!
  const [sellerPinInput, setSellerPinInput] = useState('');

  // New quick customer state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Totals calculations
  let subtotal = 0;
  let discountTotal = 0;

  cart.forEach((item) => {
    // Determine active unit price based on global price tier
    const unitPrice =
      globalPriceTier === 'cash'
        ? item.product.priceCash
        : globalPriceTier === 'installment'
        ? item.product.priceInstallment
        : item.product.priceWholesale;

    const originalLinePrice = unitPrice * item.quantity;
    const itemDiscount = getCartItemDiscountAmount(item);
    subtotal += originalLinePrice;
    discountTotal += itemDiscount;
  });

  const netSubtotal = subtotal - discountTotal;
  const taxTotal = Math.round(netSubtotal * taxRate * 100) / 100;
  const grandTotal = Math.round((netSubtotal + taxTotal) * 100) / 100;

  // Filtered customer search (by name or phone)
  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert('يرجى إدخال اسم العميل ورقم التليفون');
      return;
    }
    const created = addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      email: `${newCustPhone.trim()}@asmaa.eg`,
      notes: 'تمت الإضافة من شاشة الفواتير',
    });
    setSelectedCustomer(created);
    setNewCustName('');
    setNewCustPhone('');
    setShowAddCustomerForm(false);
    setIsCustomerDropdownOpen(false);
  };

  if (!currentAssociate) {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center text-stone-400 dir-rtl">
        يرجى اختيار الكاشير أو البائع المسؤول لفتح شاشة الفواتير.
      </div>
    );
  }

  return (
    <>
      <div className="bg-stone-900 border border-stone-800 rounded-xl flex flex-col h-[calc(100vh-6.5rem)] shadow-md overflow-hidden dir-rtl">
        
        {/* ======================================================== */}
        {/* 1. HEADER OF INVOICE: CUSTOMER LINK & DETAILS             */}
        {/* ======================================================== */}
        <div className="p-3 bg-stone-950/90 border-b border-stone-800 space-y-2">
          
          {/* Header Title Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 space-x-reverse">
              <FileText className="w-3.5 h-3.5" />
              <span>محتويات الفاتورة ({cart.length} أصناف)</span>
            </span>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 space-x-reverse transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>إفراغ السلة</span>
              </button>
            )}
          </div>

          {/* Primary Associate/Seller Dropdown Selector */}
          <div className="bg-stone-900 border border-stone-850 p-2 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 space-x-reverse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-extrabold text-stone-300">البائع النشط للمبيعات:</span>
            </div>
            <select
              value={currentAssociate?.id || ''}
              onChange={(e) => {
                const selected = associates.find((a) => a.id === e.target.value);
                if (selected) {
                  setCurrentAssociate(selected);
                }
              }}
              className="bg-stone-950 border border-stone-800 text-[11px] font-black text-amber-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500"
            >
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (كود: {a.pin})
                </option>
              ))}
            </select>
          </div>

          {/* Customer Name & Phone Number Field (With Database Search) */}
          <div className="relative">
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-amber-950/30 border border-amber-800/60 p-2 rounded-xl">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="w-7 h-7 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <span className="text-xs font-bold text-stone-100">
                        العميل: {selectedCustomer.name}
                      </span>
                      <span className="text-[9px] text-amber-400 font-mono bg-stone-900 px-1 py-0.2 rounded border border-stone-800">
                        📞 {selectedCustomer.phone}
                      </span>
                    </div>
                    <span className="text-[9px] text-stone-400 block mt-0.5">
                      نقاط الولاء: {selectedCustomer.loyaltyPoints} | إجمالي المشتريات: {selectedCustomer.totalSpent.toLocaleString()} ج.م
                    </span>
                    {selectedCustomer.notes && (
                      <span className="text-[9px] text-amber-400 bg-amber-500/5 border border-amber-500/15 px-1.5 py-0.5 rounded block mt-1 font-medium max-w-[280px] truncate" title={selectedCustomer.notes}>
                        📝 {selectedCustomer.notes}
                      </span>
                    )}
                    {selectedCustomer.address && (
                      <span className="text-[9px] text-stone-300 bg-stone-900/60 border border-stone-800 px-1.5 py-0.5 rounded block mt-0.5 font-medium max-w-[280px] truncate" title={selectedCustomer.address}>
                        📍 {selectedCustomer.address}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
                  title="إلغاء ربط الفاتورة بالعميل"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث باسم العميل أو التليفون..."
                    value={customerSearch}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-8 pl-14 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                  <div className="absolute left-1.5 top-1.5 flex items-center space-x-1 space-x-reverse">
                    {customerSearch && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearch('')}
                        className="p-0.5 text-stone-400 hover:text-stone-200 rounded-md hover:bg-stone-800 transition-colors"
                        title="مسح البحث"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerForm(!showAddCustomerForm)}
                      className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[9px] font-bold flex items-center space-x-1 space-x-reverse transition-colors"
                      title="إضافة عميل جديد"
                    >
                      <UserPlus className="w-2.5 h-2.5" />
                      <span>جديد</span>
                    </button>
                  </div>
                </div>

                {/* Quick Add Customer Modal / Inline Form */}
                {showAddCustomerForm && (
                  <form onSubmit={handleCreateCustomer} className="mt-1.5 p-2 bg-stone-950 border border-stone-800 rounded-xl space-y-1.5">
                    <p className="text-[10px] font-bold text-amber-400">إضافة عميل جديد لقاعدة البيانات:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="اسم العميل الكامل"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                        required
                      />
                      <input
                        type="tel"
                        placeholder="رقم التليفون"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-2 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => setShowAddCustomerForm(false)}
                        className="px-2.5 py-1 text-xs text-stone-400 hover:text-white"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl"
                      >
                        حفظ وربط بالفاتورة
                      </button>
                    </div>
                  </form>
                )}

                {/* Customer Search Dropdown */}
                {isCustomerDropdownOpen && !showAddCustomerForm && (
                  <div className="absolute left-0 right-0 top-12 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-2 z-40 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 p-1 border-b border-stone-800 mb-1">
                      <span>اختر عميلاً من قاعدة البيانات ({filteredCustomers.length}):</span>
                      <button
                        onClick={() => setIsCustomerDropdownOpen(false)}
                        className="text-stone-500 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-stone-500">
                        لم يتم العثور على عميل بهذا الاسم أو الرقم.
                        <button
                          onClick={() => setShowAddCustomerForm(true)}
                          className="block mx-auto mt-1 text-amber-400 font-bold underline"
                        >
                          + اضغط هنا لإضافة عميل جديد
                        </button>
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="w-full text-right p-2 rounded-xl hover:bg-stone-800 flex items-center justify-between text-xs text-stone-200 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-stone-100">{c.name}</span>
                            <span className="block text-[10px] font-mono text-amber-400">
                              📞 {c.phone}
                            </span>
                          </div>
                          <div className="text-left font-mono text-[10px] text-stone-400">
                            <span>{c.loyaltyPoints} نقطة</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ======================================================== */}
        {/* 2. INVOICE ITEMS SINGLE-ROW TABLE                        */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 py-8">
              <FileText className="w-10 h-10 stroke-[1.25] text-stone-700 mb-1.5" />
              <p className="text-xs font-bold text-stone-400">الفاتورة فارغة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800 bg-stone-950/40">
                    <th className="py-1.5 px-2">اسم الصنف</th>
                    <th className="py-1.5 px-1 text-center">الكمية</th>
                    <th className="py-1.5 px-1 text-center">السعر</th>
                    <th className="py-1.5 px-1 text-center">الخصم</th>
                    <th className="py-1.5 px-1 text-center">إجمالي الصنف</th>
                    <th className="py-1.5 px-1 text-center">البائع</th>
                    <th className="py-1.5 px-1 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {cart.map((item) => {
                    // Active price based on current selected price tier
                    const unitPrice =
                      globalPriceTier === 'cash'
                        ? item.product.priceCash
                        : globalPriceTier === 'installment'
                        ? item.product.priceInstallment
                        : item.product.priceWholesale;

                    const lineDiscount = getCartItemDiscountAmount(item);
                    const lineTotal = Math.max(0, unitPrice * item.quantity - lineDiscount);
                    const overallDiscountPercent = Math.round((lineDiscount / (unitPrice * item.quantity)) * 105) > 0 
                      ? Math.round((lineDiscount / (unitPrice * item.quantity)) * 100)
                      : 0;
                    
                    const itemAssociate = item.assignedAssociateId
                      ? associates.find((a) => a.id === item.assignedAssociateId)
                      : currentAssociate;

                    return (
                      <tr
                        key={item.product.id}
                        className="hover:bg-stone-950/80 transition-colors text-xs text-stone-200"
                      >
                        {/* 1. اسم الصنف */}
                        <td className="py-1.5 px-2">
                          <div className="flex items-center space-x-2 space-x-reverse min-w-[150px]">
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="w-7 h-7 rounded-md object-cover bg-stone-950 border border-stone-800"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-stone-100 block truncate text-[11px]">
                                {item.product.name}
                              </span>
                              <span className="text-[9px] font-mono text-stone-500 block">
                                {item.product.sku}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. الكمية */}
                        <td className="py-1.5 px-1 text-center">
                          <div className="inline-flex items-center space-x-0.5 space-x-reverse bg-stone-950 border border-stone-800 rounded-lg p-0.5">
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity === 1 ? -1 : item.quantity - 1)}
                              className="p-0.5 hover:bg-stone-800 rounded-md text-stone-400 hover:text-white"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  updateCartQuantity(item.product.id, val);
                                }
                              }}
                              className="w-8 bg-transparent text-center font-mono text-[10px] font-bold text-amber-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-none p-0"
                            />
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity === -1 ? 1 : item.quantity + 1)}
                              className="p-0.5 hover:bg-stone-800 rounded-md text-stone-400 hover:text-white"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* 3. السعر */}
                        <td className="py-1.5 px-1 text-center font-mono font-bold text-stone-300 whitespace-nowrap text-[11px]">
                          <span>{unitPrice.toLocaleString()} ج.م</span>
                        </td>

                        {/* 4. الخصم */}
                        <td className="py-1.5 px-1 text-center font-mono whitespace-nowrap text-[11px]">
                          {lineDiscount > 0 ? (
                            <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[10px]">
                              -{lineDiscount.toLocaleString()} ج.م
                              {overallDiscountPercent > 0 && ` (${overallDiscountPercent}%)`}
                            </span>
                          ) : (
                            <span className="text-stone-600 font-bold">-</span>
                          )}
                        </td>

                        {/* 5. إجمالي الصنف */}
                        <td className="py-1.5 px-1 text-center font-mono font-extrabold text-amber-400 whitespace-nowrap text-[11px]">
                          <span>{lineTotal.toLocaleString()} ج.م</span>
                        </td>

                        {/* 5. البائع */}
                        <td className="py-1.5 px-1 text-center">
                          <select
                            value={item.assignedAssociateId || currentAssociate?.id || ''}
                            onChange={(e) =>
                              updateCartItemAssociate(item.product.id, e.target.value)
                            }
                            className="bg-stone-950 border border-stone-800 text-[9px] font-bold text-amber-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-amber-500"
                          >
                            {associates.map((a) => (
                              <option key={a.id} value={a.id}>
                                كود: {a.pin}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* حذف الصنف */}
                        <td className="py-1.5 px-1 text-center">
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 text-stone-500 hover:text-rose-400 hover:bg-stone-800 rounded-md transition-colors"
                            title="حذف من الفاتورة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. FOOTER TOTALS & SUBMIT INVOICE BUTTON                  */}
        {/* ======================================================== */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 space-y-2">
          
          <div className="space-y-1 text-[11px] text-stone-400">
            <div className="flex justify-between">
              <span>الإجمالي قبل الخصم (الأصناف: {cart.reduce((a, c) => a + c.quantity, 0)})</span>
              <span className="font-mono text-stone-200 font-bold">{subtotal.toLocaleString()} ج.م</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>إجمالي الخصم</span>
                <span className="font-mono">-{discountTotal.toLocaleString()} ج.م</span>
              </div>
            )}

            <div className="flex justify-between text-stone-400">
              <span>ضريبة القيمة المضافة ({(taxRate * 100).toFixed(0)}%)</span>
              <span className="font-mono text-stone-200">{taxTotal.toLocaleString()} ج.م</span>
            </div>

            <div className="flex justify-between text-base font-extrabold text-white pt-1.5 border-t border-stone-800">
              <span>{cart.some((item) => item.quantity < 0) ? 'إجمالي قيمة المرتجع المسترد' : (discountTotal > 0 ? 'الإجمالي بعد الخصم' : 'إجمالي الفاتورة')}</span>
              <span className="font-mono text-amber-400">{grandTotal.toLocaleString()} ج.م</span>
            </div>
          </div>

          {activeHeldTransactionId && (
            <div className="p-2 bg-amber-950/80 border border-amber-800/80 rounded-xl flex items-center justify-between text-xs text-amber-200 animate-pulse">
              <div className="flex items-center space-x-1.5 space-x-reverse font-bold text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  جاري استكمال الفاتورة المعلقة (
                  {transactions.find((t) => t.id === activeHeldTransactionId)?.receiptNumber || 'معلقة'}
                  )
                </span>
              </div>
              <button
                type="button"
                onClick={clearCart}
                className="text-[10px] text-amber-400 hover:text-rose-400 underline font-bold"
                title="إلغاء وتفريغ السلة"
              >
                إلغاء
              </button>
            </div>
          )}

          <div className="flex space-x-1.5 space-x-reverse pt-0.5">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="px-2 py-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl border border-stone-800 transition-colors"
                title="تفريغ الفاتورة بالكامل"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              </button>
            )}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!selectedCustomer) {
                    alert('⚠️ يجب اختيار أو إضافة عميل أولاً لتعليق الفاتورة!');
                    return;
                  }
                  try {
                    holdCart('فاتورة معلقة للعميل');
                    alert(activeHeldTransactionId ? '✅ تم تحديث الفاتورة المعلقة بنجاح.' : '✅ تم تعليق الفاتورة وحفظها بنجاح في القائمة.');
                  } catch (e: any) {
                    alert(`خطأ: ${e.message}`);
                  }
                }}
                className={`px-2.5 py-2 rounded-xl border transition-all flex items-center justify-center space-x-1 space-x-reverse font-bold text-[10px] ${
                  selectedCustomer
                    ? 'bg-amber-950/70 hover:bg-amber-900 border-amber-800 text-amber-300'
                    : 'bg-stone-900/40 border-stone-800 text-stone-600 cursor-not-allowed'
                }`}
                title={selectedCustomer ? "تعليق الفاتورة وحفظها" : "يجب اختيار عميل أولاً لتعليق الفاتورة"}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{activeHeldTransactionId ? 'تحديث المعلقة' : 'تعليق'}</span>
              </button>
            )}

            <button
              onClick={onOpenCheckout}
              disabled={cart.length === 0}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white rounded-xl font-extrabold text-xs shadow-md shadow-amber-950 flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-[0.99]"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{cart.some((item) => item.quantity < 0) ? `إتمام المرتجع وصرف المبلغ (${grandTotal.toLocaleString()} ج.م)` : `إتمام الفاتورة والدفع (${grandTotal.toLocaleString()} ج.م)`}</span>
            </button>
          </div>

        </div>

      </div>

      {/* Split Associate Modal */}
      <SplitAssociateModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
      />
    </>
  );
};

export default CartSidebar;
