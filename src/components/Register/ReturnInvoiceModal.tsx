import React, { useState, useEffect, useMemo } from 'react';
import { Transaction } from '../../types';
import {
  RotateCcw,
  X,
  CheckSquare,
  Square,
  Plus,
  Minus,
  AlertCircle,
  Package,
  User,
  Calendar,
  CreditCard,
  ArrowDownLeft,
  Check,
  Search,
} from 'lucide-react';

interface ReturnInvoiceModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onConfirmReturn: (returnedItems: { productId: string; quantity: number }[]) => Promise<void>;
}

export const ReturnInvoiceModal: React.FC<ReturnInvoiceModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onConfirmReturn,
}) => {
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate remaining returnable quantity for each item in the transaction
  const itemsWithRemaining = useMemo(() => {
    if (!transaction || !transaction.items) return [];

    const existingReturned = transaction.returnedQuantities || {};
    const invSubtotal = transaction.subtotal || transaction.grandTotal || 1;
    const invDiscount = transaction.discountTotal || 0;
    const discountRatio = invSubtotal > 0 ? invDiscount / invSubtotal : 0;

    return transaction.items.map((item) => {
      const previouslyReturned = existingReturned[item.productId] || 0;
      const remainingQty = Math.max(0, item.quantity - previouslyReturned);
      const effectiveDiscountPerUnit = item.unitPrice * discountRatio;
      const netRefundPerUnit = Math.max(0, item.unitPrice - effectiveDiscountPerUnit);

      return {
        ...item,
        previouslyReturned,
        remainingQty,
        netRefundPerUnit,
      };
    });
  }, [transaction]);

  // When modal opens, initialize with all remaining returnable items selected
  useEffect(() => {
    if (isOpen && itemsWithRemaining.length > 0) {
      const initial: Record<string, number> = {};
      itemsWithRemaining.forEach((item) => {
        if (item.remainingQty > 0) {
          initial[item.productId] = item.remainingQty;
        } else {
          initial[item.productId] = 0;
        }
      });
      setSelectedQuantities(initial);
      setIsSubmitting(false);
      setSearchQuery('');
    }
  }, [isOpen, itemsWithRemaining]);

  if (!isOpen || !transaction) return null;

  // Filter items by search query if invoice has multiple items
  const filteredItems = itemsWithRemaining.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.productName.toLowerCase().includes(q) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.productBarcode && item.productBarcode.toLowerCase().includes(q))
    );
  });

  // Toggle selection for an item
  const handleToggleItem = (productId: string, maxQty: number) => {
    setSelectedQuantities((prev) => {
      const current = prev[productId] || 0;
      return {
        ...prev,
        [productId]: current > 0 ? 0 : maxQty,
      };
    });
  };

  // Change quantity for a specific item
  const handleQuantityChange = (productId: string, qty: number, maxQty: number) => {
    const validQty = Math.min(Math.max(0, qty), maxQty);
    setSelectedQuantities((prev) => ({
      ...prev,
      [productId]: validQty,
    }));
  };

  // Select all items at full available quantities
  const handleSelectAll = () => {
    const all: Record<string, number> = {};
    itemsWithRemaining.forEach((item) => {
      all[item.productId] = item.remainingQty;
    });
    setSelectedQuantities(all);
  };

  // Deselect all items
  const handleDeselectAll = () => {
    const none: Record<string, number> = {};
    itemsWithRemaining.forEach((item) => {
      none[item.productId] = 0;
    });
    setSelectedQuantities(none);
  };

  // Summary computations
  const selectedItemsCount = Object.entries(selectedQuantities).filter(([, qty]) => qty > 0).length;
  const totalPiecesToReturn = Object.values(selectedQuantities).reduce((sum, qty) => sum + qty, 0);

  const totalRefundAmount = itemsWithRemaining.reduce((sum, item) => {
    const returnQty = selectedQuantities[item.productId] || 0;
    return sum + returnQty * item.netRefundPerUnit;
  }, 0);

  const isFullReturn =
    itemsWithRemaining.length > 0 &&
    itemsWithRemaining.every((item) => (selectedQuantities[item.productId] || 0) === item.remainingQty);

  const handleSubmit = async () => {
    if (totalPiecesToReturn <= 0) return;

    const payload = Object.entries(selectedQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
      }));

    setIsSubmitting(true);
    try {
      await onConfirmReturn(payload);
      onClose();
    } catch (err: any) {
      alert(`حدث خطأ أثناء إجراء المرتجع: ${err?.message || 'يرجى المحاولة مجدداً'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 dir-rtl animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-stone-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-stone-100">
                  استرجاع أصناف الفاتورة
                </h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-rose-950/60 border border-rose-800 text-rose-300 font-bold">
                  #{transaction.receiptNumber}
                </span>
                {transaction.isPartiallyReturned && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-bold">
                    مسترجع جزء منها مسبقاً
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                حدد الأصناف والكميات المراد استرجاعها لإعادتها للمخزون وتسوية الحساب
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-stone-400 hover:text-stone-100 rounded-xl hover:bg-stone-800/80 transition-colors"
            title="إلغاء وإغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Metadata Bar */}
        <div className="px-5 py-2.5 bg-stone-950/30 border-b border-stone-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-300">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-stone-400">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>
                {new Date(transaction.timestamp).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {transaction.customerName && (
              <div className="flex items-center gap-1.5 text-stone-300">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">العميل:</span>
                <span className="text-amber-300">{transaction.customerName}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-stone-400">
              <CreditCard className="w-3.5 h-3.5 text-stone-500" />
              <span>طريقة الدفع:</span>
              <span className="font-bold text-stone-200">{transaction.paymentMethod}</span>
            </div>
          </div>

          <div className="text-stone-400 text-xs">
            إجمالي الفاتورة الأصلية:{' '}
            <span className="font-mono font-bold text-stone-200">
              {(transaction.originalGrandTotal || transaction.grandTotal).toLocaleString()} ج.م
            </span>
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="px-5 py-3 border-b border-stone-800/80 flex flex-wrap items-center justify-between gap-2.5 bg-stone-900/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 border border-stone-700/80 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>تحديد كل الأصناف المتبقية</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl bg-stone-800/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold flex items-center gap-1.5 border border-stone-800 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>إلغاء التحديد</span>
            </button>
          </div>

          {itemsWithRemaining.length > 4 && (
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في أصناف الفاتورة..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-stone-800/40">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-stone-500">
              <Package className="w-10 h-10 mx-auto mb-2 stroke-[1.25] text-stone-600" />
              <p className="text-sm font-bold text-stone-400">لا توجد أصناف مطابقة للبحث</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const selectedQty = selectedQuantities[item.productId] || 0;
              const isSelected = selectedQty > 0;
              const isExhausted = item.remainingQty === 0;

              return (
                <div
                  key={item.productId}
                  className={`pt-2.5 pb-2 px-3 rounded-2xl border transition-all ${
                    isExhausted
                      ? 'bg-stone-950/30 border-stone-800/40 opacity-50'
                      : isSelected
                      ? 'bg-rose-950/20 border-rose-800/50 shadow-sm'
                      : 'bg-stone-950/40 border-stone-800/70 hover:border-stone-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item Information & Checkbox */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        disabled={isExhausted || isSubmitting}
                        onClick={() => handleToggleItem(item.productId, item.remainingQty)}
                        className={`mt-1 p-1 rounded-lg transition-colors ${
                          isExhausted
                            ? 'text-stone-600 cursor-not-allowed'
                            : isSelected
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-stone-500 hover:text-stone-300'
                        }`}
                        title={isSelected ? 'إلغاء الاسترجاع' : 'تحديد للاسترجاع'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-rose-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-stone-100 truncate">
                            {item.productName}
                          </h4>
                          {item.sku && (
                            <span className="font-mono text-[10px] text-stone-400 bg-stone-900 border border-stone-800 px-1.5 py-0.2 rounded">
                              {item.sku}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400">
                            (سعر القطعة: {item.unitPrice.toLocaleString()} ج.م)
                          </span>
                        </div>

                        {/* Sold & Remaining Indicators */}
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-400 flex-wrap">
                          <span>
                            الكمية المباعة الأصلية:{' '}
                            <strong className="text-stone-200 font-mono">{item.quantity}</strong>
                          </span>
                          {item.previouslyReturned > 0 && (
                            <span className="text-amber-400/90 font-bold">
                              تم استرجاع مسبقاً:{' '}
                              <strong className="font-mono">{item.previouslyReturned}</strong>
                            </span>
                          )}
                          <span>
                            المتاح للاسترجاع الآن:{' '}
                            <strong
                              className={`font-mono ${
                                item.remainingQty > 0 ? 'text-emerald-400' : 'text-stone-500'
                              }`}
                            >
                              {item.remainingQty}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Adjuster & Item Refund Subtotal */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      {isExhausted ? (
                        <span className="text-xs text-stone-500 font-bold py-1 px-3 bg-stone-900 rounded-xl border border-stone-800">
                          تم استرجاع كامل الكمية
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center border border-stone-700 bg-stone-950 rounded-xl p-0.5 shadow-inner">
                            <button
                              type="button"
                              disabled={selectedQty <= 0 || isSubmitting}
                              onClick={() =>
                                handleQuantityChange(
                                  item.productId,
                                  selectedQty - 1,
                                  item.remainingQty
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              title="تقليل الكمية"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <input
                              type="number"
                              min={0}
                              max={item.remainingQty}
                              value={selectedQty}
                              onChange={(e) =>
                                handleQuantityChange(
                                  item.productId,
                                  parseInt(e.target.value) || 0,
                                  item.remainingQty
                                )
                              }
                              disabled={isSubmitting}
                              className="w-12 text-center bg-transparent text-sm font-bold font-mono text-stone-100 focus:outline-none"
                            />

                            <button
                              type="button"
                              disabled={selectedQty >= item.remainingQty || isSubmitting}
                              onClick={() =>
                                handleQuantityChange(
                                  item.productId,
                                  selectedQty + 1,
                                  item.remainingQty
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              title="زيادة الكمية"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Quick 'Max' button */}
                          <button
                            type="button"
                            disabled={selectedQty === item.remainingQty || isSubmitting}
                            onClick={() =>
                              handleQuantityChange(
                                item.productId,
                                item.remainingQty,
                                item.remainingQty
                              )
                            }
                            className="text-[10px] font-bold px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700/60 disabled:opacity-30 transition-colors"
                            title="إرجاع كامل المتاح"
                          >
                            الكل
                          </button>

                          {/* Line Refund Total */}
                          <div className="text-left min-w-[90px]">
                            <div className="text-[10px] text-stone-500 font-bold">المسترد:</div>
                            <div className="text-xs font-mono font-black text-rose-400">
                              {(selectedQty * item.netRefundPerUnit).toLocaleString()} ج.م
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/70 space-y-4">
          
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                {selectedItemsCount}
              </div>
              <div>
                <div className="text-stone-400">أصناف محددة:</div>
                <div className="font-bold text-stone-200">
                  {selectedItemsCount} صنف ({totalPiecesToReturn} قطعة)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <div className="text-stone-400">المبلغ المسترد للعميل:</div>
                <div className="font-mono font-black text-base text-rose-400">
                  {totalRefundAmount.toLocaleString()} ج.م
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="text-stone-400">نوع الاسترجاع:</div>
                <div className="font-bold text-emerald-400">
                  {isFullReturn ? 'مرتجع كامل للفاتورة' : totalPiecesToReturn > 0 ? 'مرتجع جزئي لأصناف محددة' : 'لم يتم تحديد أصناف'}
                </div>
              </div>
            </div>
          </div>

          {/* Operational Notices */}
          <div className="text-[11px] text-stone-400 flex items-center gap-2 px-1">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              سيتم إعادة القطع المرتجعة فوراً إلى مخزون المنتجات وتحديث سجلات المبيعات ومديونية العميل (إن وجدت).
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={totalPiecesToReturn <= 0 || isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all ${
                totalPiecesToReturn > 0 && !isSubmitting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95 shadow-rose-950/50'
                  : 'bg-stone-800 text-stone-500 border border-stone-800 cursor-not-allowed'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>
                {isSubmitting
                  ? 'جاري إتمام المرتجع...'
                  : `تأكيد استرجاع (${totalPiecesToReturn} قطعة - ${totalRefundAmount.toLocaleString()} ج.م)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
