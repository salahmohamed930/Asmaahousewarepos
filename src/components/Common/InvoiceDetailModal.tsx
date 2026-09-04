import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction, TransactionItem, PaymentMethod, Customer } from '../../types';
import {
  FileText,
  X,
  Printer,
  Edit,
  Save,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
  User,
  Calendar,
  DollarSign,
  CreditCard,
  RotateCcw
} from 'lucide-react';
import { ReceiptModal } from '../Register/ReceiptModal';

interface InvoiceDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  const {
    currentAssociate,
    hasPermission,
    updateTransaction,
    voidTransaction,
    deleteTransaction,
    restoreHeldTransaction,
    products,
    customers,
    startEditingTransaction,
  } = usePOS();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showReceiptPrint, setShowReceiptPrint] = useState<boolean>(false);

  // Editable transaction copy
  const [editedTx, setEditedTx] = useState<Transaction | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (transaction) {
      setEditedTx(JSON.parse(JSON.stringify(transaction)));
      setIsEditing(false);
      setSaveSuccess('');
      setSaveError('');
    }
  }, [transaction]);

  if (!transaction || !editedTx) return null;

  // Permission check for editing old invoices
  const canEditInvoice = !currentAssociate || hasPermission('edit_invoice') || currentAssociate?.role === 'مدير الفرع';
  const canVoidInvoice = !currentAssociate || hasPermission('void_invoice') || currentAssociate?.role === 'مدير الفرع';

  // Recalculate totals
  const recalculateTotals = (items: TransactionItem[], discountTotal: number, taxRatePercent: number = 0) => {
    const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
    const taxTotal = (subtotal - discountTotal) * (taxRatePercent / 100);
    const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);
    return { subtotal, grandTotal, taxTotal };
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updatedItems = [...editedTx.items];
    const item = updatedItems[index];
    item.quantity = newQty;
    item.totalPrice = item.unitPrice * newQty;

    const { subtotal, grandTotal } = recalculateTotals(updatedItems, editedTx.discountTotal || 0);
    const newPaid = Math.min(editedTx.amountPaid || grandTotal, grandTotal);
    const newDeferred = Math.max(0, grandTotal - newPaid);

    setEditedTx({
      ...editedTx,
      items: updatedItems,
      subtotal,
      grandTotal,
      amountPaid: newPaid,
      amountDeferred: newDeferred,
    });
  };

  const handleItemUnitPriceChange = (index: number, newUnitPrice: number) => {
    if (newUnitPrice < 0) return;
    const updatedItems = [...editedTx.items];
    const item = updatedItems[index];
    item.unitPrice = newUnitPrice;
    item.totalPrice = newUnitPrice * item.quantity;

    const { subtotal, grandTotal } = recalculateTotals(updatedItems, editedTx.discountTotal || 0);
    const newPaid = Math.min(editedTx.amountPaid || grandTotal, grandTotal);
    const newDeferred = Math.max(0, grandTotal - newPaid);

    setEditedTx({
      ...editedTx,
      items: updatedItems,
      subtotal,
      grandTotal,
      amountPaid: newPaid,
      amountDeferred: newDeferred,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (editedTx.items.length <= 1) {
      alert('لا يمكن حذف جميع الأصناف من الفاتورة. يمكن حذف الفاتورة أو إلغاؤها بدلاً من ذلك.');
      return;
    }
    const updatedItems = editedTx.items.filter((_, idx) => idx !== index);
    const { subtotal, grandTotal } = recalculateTotals(updatedItems, editedTx.discountTotal || 0);
    const newPaid = Math.min(editedTx.amountPaid || grandTotal, grandTotal);
    const newDeferred = Math.max(0, grandTotal - newPaid);

    setEditedTx({
      ...editedTx,
      items: updatedItems,
      subtotal,
      grandTotal,
      amountPaid: newPaid,
      amountDeferred: newDeferred,
    });
  };

  const handleAddProductToTx = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const existingIndex = editedTx.items.findIndex((it) => it.productId === prod.id);
    let updatedItems: TransactionItem[] = [];

    if (existingIndex > -1) {
      updatedItems = [...editedTx.items];
      updatedItems[existingIndex].quantity += 1;
      updatedItems[existingIndex].totalPrice = updatedItems[existingIndex].unitPrice * updatedItems[existingIndex].quantity;
    } else {
      const newItem: TransactionItem = {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: 1,
        priceTier: 'cash',
        unitPrice: prod.priceCash,
        totalPrice: prod.priceCash,
      };
      updatedItems = [...editedTx.items, newItem];
    }

    const { subtotal, grandTotal } = recalculateTotals(updatedItems, editedTx.discountTotal || 0);
    const newPaid = Math.min(editedTx.amountPaid || grandTotal, grandTotal);
    const newDeferred = Math.max(0, grandTotal - newPaid);

    setEditedTx({
      ...editedTx,
      items: updatedItems,
      subtotal,
      grandTotal,
      amountPaid: newPaid,
      amountDeferred: newDeferred,
    });
    setSelectedProductId('');
  };

  const handleDiscountChange = (discountVal: number) => {
    const discount = Math.max(0, discountVal);
    const { subtotal, grandTotal } = recalculateTotals(editedTx.items, discount);
    const newPaid = Math.min(editedTx.amountPaid || grandTotal, grandTotal);
    const newDeferred = Math.max(0, grandTotal - newPaid);

    setEditedTx({
      ...editedTx,
      discountTotal: discount,
      subtotal,
      grandTotal,
      amountPaid: newPaid,
      amountDeferred: newDeferred,
    });
  };

  const handlePaidAmountChange = (paidVal: number) => {
    const paid = Math.max(0, paidVal);
    const deferred = Math.max(0, editedTx.grandTotal - paid);
    setEditedTx({
      ...editedTx,
      amountPaid: paid,
      amountDeferred: deferred,
    });
  };

  const handleCustomerChange = (custId: string) => {
    if (!custId) {
      setEditedTx({
        ...editedTx,
        customerId: undefined,
        customerName: 'عميل نقدي',
      });
      return;
    }
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setEditedTx({
        ...editedTx,
        customerId: cust.id,
        customerName: cust.name,
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!canEditInvoice) {
      alert('ليس لديك صلاحية تعديل هذه الفاتورة.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      await updateTransaction(editedTx);
      setSaveSuccess('تم حفظ تعديلات الفاتورة وتحديث البيانات بنجاح!');
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err.message || 'حدث خطأ أثناء حفظ الفاتورة.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoidTx = () => {
    if (!canVoidInvoice) {
      alert('ليس لديك صلاحية إلغاء الفاتورة.');
      return;
    }
    if (confirm(`هل أنت متأكد من إلغاء الفاتورة #${editedTx.receiptNumber}؟`)) {
      voidTransaction(editedTx.id);
      alert('تم إلغاء الفاتورة بنجاح.');
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 dir-rtl">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="bg-stone-950 px-6 py-4 border-b border-stone-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h2 className="text-base sm:text-lg font-black text-stone-100">
                    تفاصيل الفاتورة #{editedTx.receiptNumber}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      editedTx.status === 'معلقة'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : editedTx.status === 'مكتملة'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {editedTx.status}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  تاريخ العملية: {!isNaN(new Date(editedTx.timestamp).getTime())
                    ? new Date(editedTx.timestamp).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '—'}
                </p>
              </div>
            </div>

            {/* Permission Indicator & Close */}
            <div className="flex items-center space-x-2 space-x-reverse">
              {canEditInvoice ? (
                <div className="hidden sm:flex items-center space-x-1 space-x-reverse bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>صلاحية تعديل الفواتير مفعّلة</span>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-1 space-x-reverse bg-stone-800/60 border border-stone-700/60 text-stone-400 px-3 py-1 rounded-xl text-xs font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>عرض فقط (مطلوب صلاحية مدير)</span>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-100 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          {saveSuccess && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 px-6 py-2.5 text-xs font-bold flex items-center space-x-2 space-x-reverse shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}
          {saveError && (
            <div className="bg-rose-500/10 border-b border-rose-500/30 text-rose-400 px-6 py-2.5 text-xs font-bold flex items-center space-x-2 space-x-reverse shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Content Scrollable Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            
            {/* Meta Data Grid (Customer, Cashier, Payment Method) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4">
              
              {/* Customer */}
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 font-bold flex items-center space-x-1 space-x-reverse">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>العميل:</span>
                </span>
                {isEditing && canEditInvoice ? (
                  <select
                    value={editedTx.customerId || ''}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="">عميل نقدي</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-extrabold text-stone-100 block">
                    {editedTx.customerName || 'عميل نقدي'}
                  </span>
                )}
              </div>

              {/* Cashier / Seller */}
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 font-bold flex items-center space-x-1 space-x-reverse">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>البائع / الكاشير:</span>
                </span>
                <span className="text-sm font-extrabold text-amber-300 block">
                  {editedTx.primaryAssociateName || 'النظام'}
                </span>
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 font-bold flex items-center space-x-1 space-x-reverse">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>طريقة الدفع:</span>
                </span>
                {isEditing && canEditInvoice ? (
                  <select
                    value={editedTx.paymentMethod}
                    onChange={(e) => setEditedTx({ ...editedTx, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="كاش">كاش (نقدي)</option>
                    <option value="فيزا / كارت">فيزا / كارت</option>
                    <option value="تقسيط شهري">تقسيط شهري</option>
                    <option value="آجل / حساب جملة">آجل / حساب جملة</option>
                    <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                  </select>
                ) : (
                  <span className="text-sm font-extrabold text-emerald-400 block">
                    {editedTx.paymentMethod}
                  </span>
                )}
              </div>

            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-stone-100 text-sm">أصناف ومنتجات الفاتورة ({editedTx.items.length})</h3>
                
                {/* Add product dropdown in edit mode */}
                {isEditing && canEditInvoice && (
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- اختر منتج لإضافته للفاتورة --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.priceCash.toLocaleString()} ج.م (المخزن: {p.stock})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddProductToTx}
                      disabled={!selectedProductId}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center space-x-1 space-x-reverse disabled:opacity-50 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto border border-stone-800 rounded-2xl bg-stone-950">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-stone-800 text-stone-400 font-bold uppercase bg-stone-900/60">
                      <th className="p-3">#</th>
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">الباركود / SKU</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-left">سعر الوحدة</th>
                      <th className="p-3 text-left">الإجمالي</th>
                      {isEditing && canEditInvoice && <th className="p-3 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-stone-200">
                    {editedTx.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-900/40 transition-colors">
                        <td className="p-3 text-stone-500 font-mono font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-stone-100">{item.productName}</td>
                        <td className="p-3 text-stone-400 font-mono">{item.sku || 'N/A'}</td>
                        
                        {/* Quantity */}
                        <td className="p-3 text-center">
                          {isEditing && canEditInvoice ? (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                              className="w-16 bg-stone-900 border border-stone-700 text-center rounded-lg px-2 py-1 text-amber-300 font-mono font-bold"
                            />
                          ) : (
                            <span className="font-mono font-bold bg-stone-900 px-2 py-0.5 rounded text-amber-300">
                              {item.quantity}
                            </span>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="p-3 text-left font-mono">
                          {isEditing && canEditInvoice ? (
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemUnitPriceChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 bg-stone-900 border border-stone-700 text-left rounded-lg px-2 py-1 text-stone-100 font-mono font-bold"
                            />
                          ) : (
                            <span>{item.unitPrice.toLocaleString()} ج.م</span>
                          )}
                        </td>

                        {/* Total Price */}
                        <td className="p-3 text-left font-mono font-extrabold text-amber-400">
                          {item.totalPrice.toLocaleString()} ج.م
                        </td>

                        {/* Actions */}
                        {isEditing && canEditInvoice && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-stone-500 hover:text-rose-400 p-1 transition-colors"
                              title="حذف المنتج من الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-stone-800">
              
              {/* Left Column: Notes & Custom Details */}
              <div className="space-y-3">
                <label className="block text-stone-400 font-bold text-xs">ملاحظات الفاتورة:</label>
                {isEditing && canEditInvoice ? (
                  <textarea
                    value={editedTx.notes || ''}
                    onChange={(e) => setEditedTx({ ...editedTx, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                    placeholder="ملاحظات إضافية على الفاتورة..."
                  />
                ) : (
                  <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 min-h-[75px] text-stone-300">
                    {editedTx.notes || 'لا توجد ملاحظات مسجلة على الفاتورة'}
                  </div>
                )}
              </div>

              {/* Right Column: Totals Summary */}
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2.5 font-mono">
                <div className="flex justify-between text-stone-400">
                  <span>المجموع الفرعي:</span>
                  <span className="font-extrabold text-stone-200">{(editedTx.subtotal || 0).toLocaleString()} ج.م</span>
                </div>

                <div className="flex justify-between items-center text-stone-400">
                  <span>الخصم الممنوح:</span>
                  {isEditing && canEditInvoice ? (
                    <input
                      type="number"
                      min="0"
                      value={editedTx.discountTotal || 0}
                      onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                      className="w-28 bg-stone-900 border border-stone-700 text-left rounded-lg px-2 py-1 text-rose-400 font-mono font-bold text-xs"
                    />
                  ) : (
                    <span className="font-extrabold text-rose-400">- {(editedTx.discountTotal || 0).toLocaleString()} ج.م</span>
                  )}
                </div>

                <div className="border-t border-stone-800 pt-2 flex justify-between text-base font-extrabold text-amber-400">
                  <span>إجمالي الفاتورة الصافي:</span>
                  <span>{editedTx.grandTotal.toLocaleString()} ج.م</span>
                </div>

                {/* Paid & Deferred breakdown */}
                <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-400 font-bold">المبلغ المدفوع كاشير:</span>
                    {isEditing && canEditInvoice ? (
                      <input
                        type="number"
                        min="0"
                        value={editedTx.amountPaid !== undefined ? editedTx.amountPaid : editedTx.grandTotal}
                        onChange={(e) => handlePaidAmountChange(parseFloat(e.target.value) || 0)}
                        className="w-28 bg-stone-950 border border-stone-700 text-left rounded-lg px-2 py-1 text-emerald-400 font-mono font-bold"
                      />
                    ) : (
                      <span className="font-extrabold text-emerald-400">
                        {(editedTx.amountPaid !== undefined ? editedTx.amountPaid : editedTx.grandTotal).toLocaleString()} ج.م
                      </span>
                    )}
                  </div>

                  {editedTx.amountDeferred !== undefined && editedTx.amountDeferred > 0 && (
                    <div className="flex justify-between text-xs text-rose-400 font-bold border-t border-stone-800/60 pt-1.5">
                      <span>المبلغ المتبقي / مرحل آجل:</span>
                      <span>{editedTx.amountDeferred.toLocaleString()} ج.م</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Footer Controls */}
          <div className="bg-stone-950 px-6 py-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            
            {/* Right side buttons: Print & Void */}
            <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowReceiptPrint(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse justify-center flex-1 sm:flex-none"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة</span>
              </button>

              {canVoidInvoice && editedTx.status === 'مكتملة' && !editedTx.id.startsWith('pay_') && (
                <button
                  type="button"
                  onClick={handleVoidTx}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 space-x-reverse justify-center"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إلغاء الفاتورة</span>
                </button>
              )}
            </div>

            {/* Left side buttons: Edit / Save / Close */}
            <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto justify-end">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedTx(JSON.parse(JSON.stringify(transaction)));
                      setIsEditing(false);
                      setSaveError('');
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-all"
                  >
                    إلغاء التعديل
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse shadow-lg shadow-emerald-900/30"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                  </button>
                </>
              ) : (
                <>
                  {editedTx?.status === 'معلقة' ? (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => {
                          if (editedTx) {
                            restoreHeldTransaction(editedTx.id);
                            onClose();
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse shadow-md"
                        title="استكمال الفاتورة المعلقة ونقلها للسلة"
                      >
                        <Check className="w-4 h-4" />
                        <span>استكمال الفاتورة في السلة</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (editedTx) {
                            await deleteTransaction(editedTx.id);
                            onClose();
                          }
                        }}
                        className="px-3 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/70 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse"
                        title="حذف هذه الفاتورة المعلقة نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف المعلقة نهائياً</span>
                      </button>
                    </div>
                  ) : canEditInvoice ? (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => {
                          if (editedTx && startEditingTransaction(editedTx)) {
                            onClose();
                          }
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse shadow-md shadow-amber-950/40"
                        title="فتح الفاتورة في شاشة الكاشير للتعديل الحر الشامل"
                      >
                        <Edit className="w-4 h-4" />
                        <span>تعديل كامل بالكرت وشاشة البيع</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-all border border-stone-700"
                        title="تعديل سريع داخل النافذة"
                      >
                        <span>تعديل سريع</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1 space-x-reverse">
                      <span>🔒 للعرض فقط (ليس لديك صلاحية لتعديل الفواتير)</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs transition-all"
                  >
                    إغلاق
                  </button>
                </>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Printable Receipt Modal */}
      {showReceiptPrint && (
        <ReceiptModal
          transaction={editedTx}
          onClose={() => setShowReceiptPrint(false)}
        />
      )}
    </>
  );
};
