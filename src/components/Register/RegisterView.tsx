import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product, Transaction, PriceTier, InvoiceDaysAccess } from '../../types';
import { searchProductsForPOS, getProductByBarcode, getCategories } from '../../services/products.service';
import {
  Search,
  Barcode,
  Plus,
  Check,
  Tag,
  Package,
  FileText,
  Filter,
  Calendar,
  CreditCard,
  ArrowRight,
  Printer,
  Eye,
  Trash2,
  Clock,
  RotateCcw,
  User,
  Hash,
  X,
  Users,
  Wallet,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import CartSidebar from './CartSidebar';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';
import { InvoiceDetailModal } from '../Common/InvoiceDetailModal';

export const RegisterView: React.FC = () => {
  const {
    products,
    addToCart,
    globalPriceTier,
    setGlobalPriceTier,
    transactions,
    voidTransaction,
    restoreHeldTransaction,
    activeHeldTransactionId,
    deleteTransaction,
    clearAllHeldTransactions,
    associates,
    currentAssociate,
    customers,
    quickSwitchByPin,
    cart,
    expenses,
    addExpense,
    deleteExpense,
    returnTransaction,
    suppliers,
    hasPermission,
    editingTransaction,
    startEditingTransaction,
    cancelEditingTransaction,
    startNewInvoice,
  } = usePOS();

  const canManageExpenses = hasPermission('manage_expenses');
  const canReturn = hasPermission('return_invoice');
  const canVoid = hasPermission('void_invoice');
  const canEditInvoice = !currentAssociate || currentAssociate.role === 'مدير الفرع' || hasPermission('edit_invoice');
  const canViewCash = hasPermission('view_cash_price');
  const canViewInstallment = hasPermission('view_installment_price');
  const canViewWholesale = hasPermission('view_wholesale_price');

  const handleOpenInvoiceEditOrView = (tx: Transaction) => {
    if (canEditInvoice) {
      const success = startEditingTransaction(tx);
      if (success) {
        setViewMode('create');
      } else {
        setSelectedTxForDetail(tx);
      }
    } else {
      setSelectedTxForDetail(tx);
    }
  };

  // Mode state: DEFAULT TO 'history' AS REQUESTED!
  const [viewMode, setViewMode] = useState<'history' | 'create' | 'expenses'>('history');

  // Expense management state in RegisterView
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('رواتب وأجور');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [expenseFilter, setExpenseFilter] = useState('all');
  const [linkedSupplierId, setLinkedSupplierId] = useState('');
  const [linkedAssociateId, setLinkedAssociateId] = useState('');

  // Held invoices management states
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  const [confirmClearAllHeld, setConfirmClearAllHeld] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'completed' | 'voided' | 'refunded'>('all');

  const handleLocalAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    
    const parsedAmount = parseFloat(expenseAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === linkedSupplierId);
    const selectedAssociate = associates.find((a) => a.id === linkedAssociateId);

    addExpense({
      amount: parsedAmount,
      category: expenseCategory,
      description: expenseDescription,
      linkedSupplierId: expenseCategory === 'دفعة لمورد' ? linkedSupplierId : undefined,
      linkedSupplierName: expenseCategory === 'دفعة لمورد' ? selectedSupplier?.name : undefined,
      linkedAssociateId: expenseCategory === 'سلفة لموظف' ? linkedAssociateId : undefined,
      linkedAssociateName: expenseCategory === 'سلفة لموظف' ? selectedAssociate?.name : undefined,
    });

    // Reset fields & close modal
    setExpenseAmount('');
    setExpenseCategory('رواتب وأجور');
    setExpenseDescription('');
    setLinkedSupplierId('');
    setLinkedAssociateId('');
    setIsAddExpenseModalOpen(false);
  };

  const filteredExpenses = expenses.filter(exp => {
    if (expenseFilter === 'all') return true;
    return exp.category === expenseFilter;
  });

  const totalExpensesSum = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const expenseCategoriesList = [
    'رواتب وأجور',
    'سلفة لموظف',
    'دفعة لمورد',
    'إيجار',
    'مرافق (كهرباء / مياه)',
    'بضاعة ومستلزمات',
    'بوفيه وضيافة',
    'مصاريف نقل وشحن',
    'أخرى'
  ];

  // Mobile Sub Tab state inside creation view
  const [mobileSubTab, setMobileSubTab] = useState<'catalog' | 'cart'>('catalog');

  // User invoice days access permission
  const userInvoiceAccess: InvoiceDaysAccess =
    currentAssociate?.invoiceDaysAccess || (currentAssociate?.role === 'مدير الفرع' ? 'all' : 'today');
  const userInvoiceCustomDays = currentAssociate?.invoiceCustomDaysLimit || 1;

  // History search & filters state
  const [historySearch, setHistorySearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(() => {
    return userInvoiceAccess === 'today' ? 'today' : 'all';
  });
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  useEffect(() => {
    if (userInvoiceAccess === 'today') {
      setDateFilter('today');
    }
  }, [userInvoiceAccess]);

  // Register / Creation State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  // Seller PIN input state inside catalog
  const [sellerPinInput, setSellerPinInput] = useState<string>(currentAssociate?.pin || '');

  const barcodeInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus barcode input when opening invoice creation page
  useEffect(() => {
    if (viewMode === 'create' && !isPaymentOpen) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, isPaymentOpen]);

  // Keep seller PIN synchronized when associate switches
  useEffect(() => {
    if (currentAssociate?.pin && currentAssociate.pin !== sellerPinInput) {
      setSellerPinInput(currentAssociate.pin);
    }
  }, [currentAssociate]);

  // --- Server-Side POS Products Search & Barcode Lookup ---
  const [posProducts, setPosProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState<boolean>(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(['الكل']);
  const [isBarcodeLoading, setIsBarcodeLoading] = useState<boolean>(false);

  // 1. Debounce text search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 2. Query products from Supabase directly
  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    const fetchPOSProducts = async () => {
      setIsSearchingProducts(true);
      const res = await searchProductsForPOS({
        search: debouncedSearchQuery,
        category: selectedCategory,
        limit: 25,
        abortSignal: controller.signal,
      });

      if (isSubscribed) {
        setPosProducts(res.products);
        setIsSearchingProducts(false);
      }
    };

    fetchPOSProducts();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [debouncedSearchQuery, selectedCategory]);

  // 3. Query categories
  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
    });
  }, []);

  // 4. Scanner exact match lookup in Supabase
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = barcodeInput.trim();
    if (!clean) return;

    setIsBarcodeLoading(true);
    try {
      const matchedProduct = await getProductByBarcode(clean);
      if (matchedProduct) {
        triggerAddToCart(matchedProduct);
        setBarcodeInput('');
      } else {
        alert(`لم يتم العثور على منتج برقم باركود أو كود: "${clean}"`);
      }
    } finally {
      setIsBarcodeLoading(false);
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  // Shortcut Action Listener for RegisterView
  useEffect(() => {
    const handleShortcutAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; key: string }>;
      const action = customEvent.detail?.action;

      if (action === 'open_new_invoice') {
        setViewMode('create');
        setTimeout(() => {
          const barcodeInput = document.getElementById('pos-barcode-input');
          if (barcodeInput) {
            barcodeInput.focus();
          }
        }, 50);
      } else if (action === 'checkout_payment') {
        setViewMode('create');
        if (cart.length > 0) {
          setIsPaymentOpen(true);
        } else {
          alert('سلة المبيعات فارغة! يرجى إضافة أصناف أولاً لإتمام الفاتورة.');
        }
      } else if (action === 'add_expense') {
        setViewMode('history');
        setIsAddExpenseModalOpen(true);
      } else if (action === 'focus_search') {
        setViewMode('create');
        setTimeout(() => {
          const searchInput = document.getElementById('pos-search-input');
          if (searchInput) {
            searchInput.focus();
          }
        }, 50);
      } else if (action === 'print_last_receipt') {
        if (transactions.length > 0) {
          setCompletedTransaction(transactions[0]);
        } else {
          alert('لا توجد فواتير سابقة لطباعتها حالياً.');
        }
      }
    };

    window.addEventListener('pos-shortcut-action', handleShortcutAction);
    return () => {
      window.removeEventListener('pos-shortcut-action', handleShortcutAction);
    };
  }, [cart.length, transactions]);

  const triggerAddToCart = (product: Product) => {
    addToCart(product, 1);
    setAddedAnimationId(product.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 500);
  };

  const isAnyInvoiceFilterActive =
    historySearch.trim() !== '' ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    (userInvoiceAccess === 'today' ? false : dateFilter !== 'all') ||
    sellerFilter !== 'all' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const resetInvoiceFilters = () => {
    setHistorySearch('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateFilter(userInvoiceAccess === 'today' ? 'today' : 'all');
    setSellerFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Filtered Past Invoices History Logic
  const filteredTransactions = transactions.filter((tx) => {
    if (!tx) return false;

    // 0. Enforce user's allowed invoice days permission (صلاحية نطاق الأيام للمستخدم)
    if (userInvoiceAccess !== 'all') {
      const txTime = new Date(tx.timestamp).getTime();
      if (!isNaN(txTime)) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        let minAllowedTime = 0;
        if (userInvoiceAccess === 'today') {
          minAllowedTime = startOfToday;
        } else if (userInvoiceAccess === 'last_2_days') {
          minAllowedTime = startOfToday - (1 * 24 * 60 * 60 * 1000);
        } else if (userInvoiceAccess === 'last_7_days') {
          minAllowedTime = startOfToday - (6 * 24 * 60 * 60 * 1000);
        } else if (userInvoiceAccess === 'last_30_days') {
          minAllowedTime = startOfToday - (29 * 24 * 60 * 60 * 1000);
        } else if (userInvoiceAccess === 'custom') {
          minAllowedTime = startOfToday - (Math.max(1, userInvoiceCustomDays - 1) * 24 * 60 * 60 * 1000);
        }

        if (txTime < minAllowedTime) {
          return false;
        }
      }
    }

    // 1. Search Query (Invoice ID, Receipt #, Customer Name/Phone, Seller Name/PIN, Product Name/Barcode/SKU, Amount, Notes)
    const rawQ = (historySearch || '').trim();
    if (rawQ) {
      const q = rawQ.toLowerCase();
      const cleanQ = q.replace(/^(#|inv-|inv)/i, '').trim();

      const txId = String(tx.id || '').toLowerCase();
      const receiptNo = String(tx.receiptNumber || '').toLowerCase();
      const cleanReceiptNo = receiptNo.replace(/^(#|inv-|inv)/i, '').trim();

      const matchId = txId.includes(q) || receiptNo.includes(q) || (Boolean(cleanQ) && cleanReceiptNo.includes(cleanQ));
      const matchCustName = Boolean(tx.customerName && String(tx.customerName).toLowerCase().includes(q));

      // Customer Phone match
      let matchCustPhone = false;
      if ((tx as any).customerPhone && String((tx as any).customerPhone).includes(rawQ)) {
        matchCustPhone = true;
      } else if (tx.customerId && customers) {
        const custObj = customers.find((c) => c.id === tx.customerId);
        if (custObj && custObj.phone && custObj.phone.includes(rawQ)) {
          matchCustPhone = true;
        }
      }

      // Associate match (PIN or Name)
      const primaryAssoc = associates.find(
        (a) => a.id === tx.primaryAssociateId || a.id === (tx as any).associateId
      );
      const matchAssociatePin =
        associates.some(
          (a) => (a.id === tx.primaryAssociateId || a.id === (tx as any).associateId) && a.pin && a.pin.includes(rawQ)
        ) || Boolean(primaryAssoc && primaryAssoc.pin && primaryAssoc.pin.includes(rawQ));

      const matchAssociateName = Boolean(
        (tx.primaryAssociateName && tx.primaryAssociateName.toLowerCase().includes(q)) ||
        (primaryAssoc && primaryAssoc.name.toLowerCase().includes(q))
      );

      // Items match (Name, Barcode, SKU)
      const matchItems =
        Array.isArray(tx.items) &&
        tx.items.some((item) => {
          if (!item) return false;
          const pName = String(item.productName || '').toLowerCase();
          const pBarcode = String((item as any).barcode || '').toLowerCase();
          const pSku = String((item as any).sku || '').toLowerCase();
          return pName.includes(q) || pBarcode.includes(q) || pSku.includes(q);
        });

      // Amount match
      const grandTotalStr = String(tx.grandTotal ?? tx.subtotal ?? '');
      const matchAmount = grandTotalStr === rawQ || grandTotalStr.startsWith(rawQ);

      // Notes match
      const matchNotes = Boolean(
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.paymentDetails && tx.paymentDetails.toLowerCase().includes(q))
      );

      if (
        !matchId &&
        !matchCustName &&
        !matchCustPhone &&
        !matchAssociatePin &&
        !matchAssociateName &&
        !matchItems &&
        !matchAmount &&
        !matchNotes
      ) {
        return false;
      }
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      const s = String(tx.status || '').toLowerCase();
      if (statusFilter === 'held') {
        if (s !== 'معلقة' && s !== 'held') return false;
      } else if (statusFilter === 'completed') {
        if (s !== 'مكتملة' && s !== 'completed') return false;
      } else if (statusFilter === 'voided') {
        if (s !== 'ملغاة' && s !== 'voided') return false;
      } else if (statusFilter === 'refunded') {
        if (s !== 'مسترجعة' && s !== 'refunded') return false;
      }
    }

    // 3. Payment Method Filter (Robust multi-language & split payment support)
    if (paymentFilter !== 'all') {
      const pm = String(tx.paymentMethod || '').trim();
      const pmLower = pm.toLowerCase();
      const isSplit =
        pm === 'دفع متعدد' ||
        pmLower === 'split' ||
        (Array.isArray(tx.splitPayments) && tx.splitPayments.length > 1);

      if (paymentFilter === 'cash') {
        const hasCash =
          pm === 'كاش' ||
          pmLower === 'cash' ||
          (Array.isArray(tx.splitPayments) &&
            tx.splitPayments.some((sp) => sp.method === 'كاش' || (sp.method as any) === 'cash'));
        if (!hasCash) return false;
      } else if (paymentFilter === 'card') {
        const hasCard =
          pm === 'فيزا / كارت' ||
          pmLower === 'card' ||
          pmLower === 'visa' ||
          pm.includes('فيزا') ||
          pm.includes('كارت') ||
          (Array.isArray(tx.splitPayments) &&
            tx.splitPayments.some(
              (sp) =>
                sp.method === 'فيزا / كارت' ||
                (sp.method as any) === 'card' ||
                (sp.method as any) === 'visa' ||
                String(sp.method).includes('فيزا')
            ));
        if (!hasCard) return false;
      } else if (paymentFilter === 'installment') {
        const hasInst =
          pm === 'تقسيط شهري' ||
          pm === 'تقسيط' ||
          pmLower === 'installment' ||
          pm.includes('تقسيط') ||
          (Array.isArray(tx.splitPayments) &&
            tx.splitPayments.some(
              (sp) =>
                sp.method === 'تقسيط شهري' ||
                (sp.method as any) === 'installment' ||
                String(sp.method).includes('تقسيط')
            ));
        if (!hasInst) return false;
      } else if (paymentFilter === 'credit') {
        const hasCredit =
          pm === 'آجل / حساب جملة' ||
          pm === 'آجل' ||
          pmLower === 'credit' ||
          pmLower === 'deferred' ||
          pm.includes('آجل') ||
          (tx.amountDeferred !== undefined && tx.amountDeferred > 0) ||
          (Array.isArray(tx.splitPayments) &&
            tx.splitPayments.some(
              (sp) =>
                sp.method === 'آجل / حساب جملة' ||
                (sp.method as any) === 'deferred' ||
                String(sp.method).includes('آجل')
            ));
        if (!hasCredit) return false;
      } else if (paymentFilter === 'wallet') {
        const hasWallet =
          pm === 'محفظة إلكترونية' ||
          pmLower === 'wallet' ||
          pm.includes('محفظة') ||
          (Array.isArray(tx.splitPayments) &&
            tx.splitPayments.some(
              (sp) =>
                sp.method === 'محفظة إلكترونية' ||
                (sp.method as any) === 'wallet' ||
                String(sp.method).includes('محفظة')
            ));
        if (!hasWallet) return false;
      } else if (paymentFilter === 'split') {
        if (!isSplit) return false;
      } else if (paymentFilter === 'loyalty') {
        const hasLoyalty = pm === 'نقاط ولاء' || pmLower === 'loyalty' || pm.includes('ولاء');
        if (!hasLoyalty) return false;
      } else {
        if (pm !== paymentFilter) return false;
      }
    }

    // 4. Date Filter
    if (dateFilter !== 'all') {
      const txDate = new Date(tx.timestamp);
      if (!isNaN(txDate.getTime())) {
        const now = new Date();

        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          if (txDate < startOfToday || txDate > endOfToday) return false;
        } else if (dateFilter === 'yesterday') {
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
          const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
          if (txDate < startOfYesterday || txDate > endOfYesterday) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          if (txDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          if (txDate < startOfMonth) return false;
        } else if (dateFilter === 'last_month') {
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          if (txDate < startOfLastMonth || txDate > endOfLastMonth) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(`${customStartDate}T00:00:00`);
            if (!isNaN(start.getTime()) && txDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(`${customEndDate}T23:59:59.999`);
            if (!isNaN(end.getTime()) && txDate > end) return false;
          }
        }
      }
    }

    // 5. Seller Filter (By ID, PIN, or Name)
    if (sellerFilter !== 'all') {
      const targetAssoc = associates.find(
        (a) => a.id === sellerFilter || a.pin === sellerFilter || a.name === sellerFilter
      );
      const targetId = targetAssoc ? targetAssoc.id : sellerFilter;
      const targetPin = targetAssoc ? targetAssoc.pin : sellerFilter;
      const targetName = targetAssoc ? targetAssoc.name : '';

      const assocId = tx.primaryAssociateId || (tx as any).associateId;
      const txAssocObj = associates.find((a) => a.id === assocId);

      const matchesId = assocId === targetId;
      const matchesPin =
        (txAssocObj && txAssocObj.pin === targetPin) || Boolean(targetAssoc && txAssocObj?.pin === targetAssoc.pin);
      const matchesName = Boolean(
        (targetName && tx.primaryAssociateName === targetName) ||
        (targetName && txAssocObj && txAssocObj.name === targetName)
      );

      const matchesSplit =
        Array.isArray(tx.splitAssociates) &&
        tx.splitAssociates.some((sa: any) => sa.associateId === targetId || (targetName && sa.associateName === targetName));
      const matchesItems =
        Array.isArray(tx.items) &&
        tx.items.some((item: any) => item.assignedAssociateId === targetId);

      if (!matchesId && !matchesPin && !matchesName && !matchesSplit && !matchesItems) {
        return false;
      }
    }

    return true;
  });

  // Sort: held ('معلقة') always comes first, followed by newest transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aHeld = a.status === 'معلقة' ? 1 : 0;
    const bHeld = b.status === 'معلقة' ? 1 : 0;
    if (aHeld !== bHeld) {
      return bHeld - aHeld;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Calculate quick summary metrics for past invoices
  const totalInvoicesCount = filteredTransactions.filter((tx) => tx.status !== 'معلقة').length;
  const totalHeldCount = filteredTransactions.filter((tx) => tx.status === 'معلقة').length;
  const allHeldCount = transactions.filter((tx) => tx.status === 'معلقة').length;
  const totalSalesSum = filteredTransactions
    .filter((tx) => tx.status === 'مكتملة')
    .reduce((acc, tx) => acc + (tx.grandTotal || tx.subtotal || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 dir-rtl space-y-3.5">

      {/* ======================================================== */}
      {/* 1. DEFAULT HISTORY VIEW: PAST INVOICES ARCHIVE            */}
      {/* ======================================================== */}
      {viewMode === 'history' ? (
        <div className="space-y-4">
          
          {/* Top heading and action bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800/80 p-4 rounded-2xl shadow-md">
            <div>
              <h1 className="text-lg font-black text-stone-100 flex items-center gap-2">
                <span>إدارة الحسابات والعمليات اليومية</span>
                <span className="text-xs font-mono bg-stone-950 border border-stone-800 px-2.5 py-0.5 rounded-full text-stone-300 font-bold flex items-center gap-1.5">
                  <span className="text-amber-400 font-black">{filteredTransactions.length}</span>
                  <span>فاتورة معروضة</span>
                  {userInvoiceAccess !== 'all' && (
                    <span className="text-[10px] text-amber-400/90 font-sans border-r border-stone-800 pr-1.5 mr-0.5">
                      ({userInvoiceAccess === 'today' ? 'اليوم فقط' :
                        userInvoiceAccess === 'last_2_days' ? 'اليوم وأمس' :
                        userInvoiceAccess === 'last_7_days' ? 'آخر 7 أيام' :
                        userInvoiceAccess === 'last_30_days' ? 'آخر 30 يوماً' :
                        `آخر ${userInvoiceCustomDays} أيام`})
                    </span>
                  )}
                </span>
                {allHeldCount > 0 && (
                  <div className="flex items-center gap-1.5 mr-1">
                    <button
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === 'held' ? 'all' : 'held')}
                      className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 transition-all ${
                        statusFilter === 'held'
                          ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                          : 'bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900/60 animate-pulse'
                      }`}
                      title="انقر لتصفية الفواتير المعلقة فقط"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{allHeldCount} معلقة</span>
                    </button>

                    {confirmClearAllHeld ? (
                      <div className="flex items-center space-x-1 space-x-reverse bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-xl animate-in fade-in">
                        <span className="text-[10px] text-rose-200 font-bold">تأكيد مسح كافة المعلقات؟</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await clearAllHeldTransactions();
                            setConfirmClearAllHeld(false);
                            setStatusFilter('all');
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-black"
                        >
                          نعم، مسح الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearAllHeld(false)}
                          className="px-1.5 py-0.5 text-stone-400 hover:text-stone-200 text-[9px]"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllHeld(true)}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950 border border-rose-900/60 px-2 py-0.5 rounded-xl transition-all flex items-center gap-1"
                        title="حذف وتفريغ جميع الفواتير المعلقة من النظام نهائياً"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>مسح جميع المعلقات</span>
                      </button>
                    )}
                  </div>
                )}
              </h1>
              <p className="text-xs text-stone-400 mt-1">تابع فواتير المبيعات والمصروفات اليومية من شاشة واحدة موحدة</p>
            </div>
            
            <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto">
              <button
                onClick={async () => {
                  try {
                    await startNewInvoice();
                    setViewMode('create');
                  } catch (e: any) {
                    alert(`خطأ: ${e.message}`);
                  }
                }}
                className="flex-1 sm:flex-initial py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-md shadow-amber-950/40"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إنشاء فاتورة مبيعات</span>
              </button>

              {canManageExpenses && (
                <button
                  onClick={() => setIsAddExpenseModalOpen(true)}
                  className="flex-1 sm:flex-initial py-2 px-4 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-md shadow-rose-950/40"
                >
                  <TrendingDown className="w-4 h-4 stroke-[2.5]" />
                  <span>تسجيل مصروف جديد</span>
                </button>
              )}
            </div>
          </div>

          {/* Unified 2-Column Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            
            {/* Right Column: Invoices Log (col-span-8) */}
            <div className="xl:col-span-8 space-y-3.5">

          {/* Controls & Search Filters Bar */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-2 shadow-sm space-y-2">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              
              {/* Search Bar */}
              <div className="md:col-span-4 relative flex items-center">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث برقم الفاتورة، العميل، التليفون، البائع، الصنف..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-9 pl-7 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                />
                {historySearch ? (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute left-2.5 top-2 text-stone-500 hover:text-stone-300 transition-colors"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : isAnyInvoiceFilterActive ? (
                  <button
                    type="button"
                    onClick={resetInvoiceFilters}
                    className="absolute left-2 top-1.5 text-stone-400 hover:text-amber-400 p-1 transition-colors"
                    title="إعادة ضبط كافة الفلاتر والبحث"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                ) : null}
              </div>

              {/* Status Filter */}
              <div className="md:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                    statusFilter !== 'all'
                      ? 'border-amber-500 text-amber-300'
                      : 'border-stone-800 text-stone-200 focus:border-amber-500'
                  }`}
                >
                  <option value="all">الحالة: الكل</option>
                  <option value="completed">✅ مكتملة</option>
                  <option value="held">⏳ معلقة ({allHeldCount})</option>
                  <option value="voided">❌ ملغاة</option>
                  <option value="refunded">↩️ مسترجعة</option>
                </select>
              </div>

              {/* Payment Filter */}
              <div className="md:col-span-2">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                    paymentFilter !== 'all'
                      ? 'border-amber-500 text-amber-300'
                      : 'border-stone-800 text-stone-200 focus:border-amber-500'
                  }`}
                >
                  <option value="all">طريقة الدفع: الكل</option>
                  <option value="cash">كاش 💵</option>
                  <option value="card">فيزا / كارت 💳</option>
                  <option value="installment">تقسيط شهري 📅</option>
                  <option value="credit">آجل / جملة ⏳</option>
                  <option value="wallet">محفظة إلكترونية 📱</option>
                  <option value="split">دفع متعدد 🔀</option>
                  <option value="loyalty">نقاط ولاء ⭐</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="md:col-span-2">
                {userInvoiceAccess === 'today' ? (
                  <select
                    value="today"
                    disabled
                    className="w-full bg-stone-950 border border-stone-800 text-amber-400 font-bold rounded-xl px-2.5 py-1.5 text-xs focus:outline-none cursor-not-allowed opacity-90"
                    title="صلاحية حسابك مقيدة بعرض فواتير اليوم فقط"
                  >
                    <option value="today">فواتير اليوم 📅 (مقيد بالصلاحية)</option>
                  </select>
                ) : userInvoiceAccess === 'last_2_days' ? (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                      dateFilter !== 'all'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-stone-800 text-stone-200 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">اليوم والأمس (الكل المتاح)</option>
                    <option value="today">فواتير اليوم 📅</option>
                    <option value="yesterday">فواتير الأمس ⏪</option>
                  </select>
                ) : userInvoiceAccess === 'last_7_days' ? (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                      dateFilter !== 'all'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-stone-800 text-stone-200 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">آخر 7 أيام (الكل المتاح)</option>
                    <option value="today">فواتير اليوم 📅</option>
                    <option value="yesterday">فواتير الأمس ⏪</option>
                    <option value="week">آخر 7 أيام 🗓️</option>
                  </select>
                ) : userInvoiceAccess === 'last_30_days' ? (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                      dateFilter !== 'all'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-stone-800 text-stone-200 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">آخر 30 يوماً (الكل المتاح)</option>
                    <option value="today">فواتير اليوم 📅</option>
                    <option value="yesterday">فواتير الأمس ⏪</option>
                    <option value="week">آخر 7 أيام 🗓️</option>
                    <option value="month">هذا الشهر 📊</option>
                  </select>
                ) : userInvoiceAccess === 'custom' ? (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                      dateFilter !== 'all'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-stone-800 text-stone-200 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">آخر {userInvoiceCustomDays} أيام (الكل المتاح)</option>
                    <option value="today">فواتير اليوم 📅</option>
                    <option value="yesterday">فواتير الأمس ⏪</option>
                    <option value="custom">فترة مخصصة... 📆</option>
                  </select>
                ) : (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                      dateFilter !== 'all'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-stone-800 text-stone-200 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">التاريخ: الكل</option>
                    <option value="today">فواتير اليوم 📅</option>
                    <option value="yesterday">فواتير الأمس ⏪</option>
                    <option value="week">آخر 7 أيام 🗓️</option>
                    <option value="month">هذا الشهر 📊</option>
                    <option value="last_month">الشهر السابق 📉</option>
                    <option value="custom">فترة مخصصة... 📆</option>
                  </select>
                )}
              </div>

              {/* Seller PIN / Name Filter */}
              <div className="md:col-span-2">
                <select
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className={`w-full bg-stone-950 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                    sellerFilter !== 'all'
                      ? 'border-amber-500 text-amber-300'
                      : 'border-stone-800 text-stone-200 focus:border-amber-500'
                  }`}
                >
                  <option value="all">البائع: الكل</option>
                  {associates.map((a, idx) => (
                    <option key={a.id ? `assoc_flt_${a.id}_${idx}` : `assoc_flt_${idx}`} value={a.id}>
                      {a.name} ({a.pin})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Custom Date Range Row */}
            {dateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-stone-800/80 text-xs text-stone-300 bg-stone-950/40 p-2 rounded-xl">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>الفترة المحددة:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500 text-[11px]">من:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500 text-[11px]">إلى:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-[11px] text-stone-400 hover:text-rose-400 underline font-bold transition-colors"
                  >
                    مسح التواريخ
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Past Invoices Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-md overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <FileText className="w-10 h-10 stroke-[1.25] text-stone-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-stone-300">لم يتم العثور على فواتير سابقة مطابقة للفلاتر الحالية</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر لإظهار الفواتير
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
                  {isAnyInvoiceFilterActive && (
                    <button
                      type="button"
                      onClick={resetInvoiceFilters}
                      className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse transition-all shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>إعادة ضبط كافة الفلاتر</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewMode('create')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse transition-all shadow-md shadow-amber-950/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة فاتورة جديدة الآن</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-stone-950 text-[10px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800">
                      <th className="py-2 px-3">رقم الفاتورة</th>
                      <th className="py-2 px-3">التاريخ والوقت</th>
                      <th className="py-2 px-3">اسم العميل</th>
                      <th className="py-2 px-3 text-center">كود البائع</th>
                      <th className="py-2 px-3 text-center">طريقة الدفع</th>
                      <th className="py-2 px-3 text-center">الإجمالي</th>
                      <th className="py-2 px-3 text-center">الحالة</th>
                      <th className="py-2 px-3 text-center">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80 text-xs text-stone-200">
                    {sortedTransactions.map((tx, idx) => {
                      const assocId = tx.primaryAssociateId || (tx as any).associateId;
                      const assoc = associates.find((a) => a.id === assocId);
                      const sellerPinCode = assoc ? assoc.pin : '101';
                      const txDate = new Date(tx.timestamp);
                      const formattedDate = !isNaN(txDate.getTime())
                        ? txDate.toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—';

                      const isVoided = tx.status === 'ملغاة';
                      const isHeld = tx.status === 'معلقة';
                      const txTotal = tx.grandTotal ?? tx.subtotal ?? 0;

                      return (
                        <tr
                          key={tx.id ? `tx_${tx.id}_${idx}` : `tx_${idx}`}
                          className={`transition-colors ${
                            isHeld
                              ? 'bg-amber-950/20 hover:bg-amber-950/30 border-r-4 border-amber-500'
                              : 'hover:bg-stone-950/60'
                          }`}
                        >
                          {/* رقم الفاتورة */}
                          <td
                            className="py-1.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap cursor-pointer hover:underline hover:text-amber-300 transition-colors"
                            onClick={() => handleOpenInvoiceEditOrView(tx)}
                            title="انقر لفتح وتعديل الفاتورة في شاشة البيع الكاشير"
                          >
                            #{tx.receiptNumber}
                          </td>

                          {/* التاريخ والوقت */}
                          <td className="py-1.5 px-3 text-stone-400 whitespace-nowrap">
                            <span className="flex items-center space-x-1.5 space-x-reverse">
                              <Clock className="w-3 h-3 text-stone-500" />
                              <span className="text-[11px]">{formattedDate}</span>
                            </span>
                          </td>

                          {/* العميل */}
                          <td className="py-1.5 px-3">
                            <span className="font-bold text-stone-100 block">
                              {tx.customerName || 'عميل نقدي'}
                            </span>
                          </td>

                          {/* كود البائع ONLY */}
                          <td className="py-1.5 px-3 text-center">
                            <span className="font-mono font-extrabold text-amber-400 bg-stone-950 border border-stone-800 px-2 py-0.2 rounded-lg text-[10px] inline-block">
                              كود: {sellerPinCode}
                            </span>
                          </td>

                          {/* طريقة الدفع */}
                          <td className="py-1.5 px-3 text-center">
                            {isHeld ? (
                              <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                                معلقة ⏳
                              </span>
                            ) : (() => {
                              const pm = String(tx.paymentMethod || '');
                              const pmLower = pm.toLowerCase();
                              const isCash = pm === 'كاش' || pmLower === 'cash';
                              const isCard = pm === 'فيزا / كارت' || pmLower === 'card' || pmLower === 'visa' || pm.includes('فيزا');
                              const isInstallment = pm === 'تقسيط شهري' || pm === 'تقسيط' || pmLower === 'installment' || pm.includes('تقسيط');
                              const isCredit = pm === 'آجل / حساب جملة' || pm === 'آجل' || pmLower === 'credit' || pmLower === 'deferred';
                              const isWallet = pm === 'محفظة إلكترونية' || pmLower === 'wallet' || pm.includes('محفظة');
                              const isSplit = pm === 'دفع متعدد' || pmLower === 'split' || (Array.isArray(tx.splitPayments) && tx.splitPayments.length > 1);
                              const isLoyalty = pm === 'نقاط ولاء' || pmLower === 'loyalty' || pm.includes('ولاء');

                              if (isCash) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    كاش 💵
                                  </span>
                                );
                              }
                              if (isCard) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                    فيزا / كارت 💳
                                  </span>
                                );
                              }
                              if (isInstallment) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                    تقسيط 📅
                                  </span>
                                );
                              }
                              if (isCredit) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                                    آجل / جملة ⏳
                                  </span>
                                );
                              }
                              if (isWallet) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                                    محفظة 📱
                                  </span>
                                );
                              }
                              if (isSplit) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                                    دفع متعدد 🔀
                                  </span>
                                );
                              }
                              if (isLoyalty) {
                                return (
                                  <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-yellow-950 text-yellow-300 border border-yellow-800">
                                    نقاط ولاء ⭐
                                  </span>
                                );
                              }
                              return (
                                <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-bold bg-stone-950 text-stone-300 border border-stone-800">
                                  {pm || 'غير محدد'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* الإجمالي */}
                          <td className="py-1.5 px-3 text-center font-mono font-extrabold text-white whitespace-nowrap text-[11px]">
                            {(txTotal || 0).toLocaleString()} ج.م
                          </td>

                          {/* الحالة */}
                          <td className="py-1.5 px-3 text-center">
                            {isHeld ? (
                              tx.id === activeHeldTransactionId ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-600 text-white border border-amber-400 animate-bounce">
                                  جاري استكمالها ✏️
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                                  معلقة ⏳
                                </span>
                              )
                            ) : isVoided ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                ملغاة
                              </span>
                            ) : tx.status === 'مسترجعة' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-stone-950 text-amber-400 border border-amber-500/40">
                                مسترجعة ↩
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                مكتملة ✓
                              </span>
                            )}
                          </td>

                          {/* خيارات الفاتورة */}
                          <td className="py-1.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5 space-x-reverse justify-center">
                              {isHeld ? (
                                <>
                                  <button
                                    onClick={() => {
                                      restoreHeldTransaction(tx.id);
                                      setViewMode('create');
                                    }}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-[10px] flex items-center space-x-1 space-x-reverse transition-all active:scale-95 animate-pulse"
                                    title="استكمال الفاتورة وتفريغها في السلة"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>استكمال</span>
                                  </button>

                                  {confirmDeleteTxId === tx.id ? (
                                    <div className="flex items-center space-x-1 space-x-reverse bg-rose-950 border border-rose-700 px-1 py-0.5 rounded-lg animate-in fade-in">
                                      <button
                                        onClick={async () => {
                                          await deleteTransaction(tx.id);
                                          setConfirmDeleteTxId(null);
                                        }}
                                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black rounded"
                                      >
                                        تأكيد
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteTxId(null)}
                                        className="px-1 py-0.5 text-stone-400 hover:text-white text-[9px]"
                                      >
                                        إلغاء
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeleteTxId(tx.id)}
                                      className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors border border-stone-800"
                                      title="حذف وإلغاء الفاتورة المعلقة نهائياً"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenInvoiceEditOrView(tx)}
                                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-[11px] flex items-center space-x-1 space-x-reverse transition-colors shadow-sm"
                                    title="فتح الفاتورة للتعديل الكامل في شاشة البيع الكاشير"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>فتح / تعديل</span>
                                  </button>
                                  <button
                                    onClick={() => setCompletedTransaction(tx)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-[11px] flex items-center space-x-1 space-x-reverse transition-colors"
                                    title="عرض وطباعة الفاتورة"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>طباعة</span>
                                  </button>
                                  {tx.status === 'مكتملة' && canReturn && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`هل أنت متأكد من رغبتك في عمل مرتجع للفاتورة رقم #${tx.receiptNumber}؟ سيتم إرجاع المنتجات للمخزن وتحديث مديونية العميل والبيع.`)) {
                                          returnTransaction(tx.id);
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-800/40 font-bold rounded-xl text-[11px] flex items-center space-x-1 space-x-reverse transition-colors"
                                      title="عمل مرتجع لهذه الفاتورة"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>مرتجع</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
              </div>
            </div>

            {/* Left Column: Expenses list (col-span-4) */}
            <div className="xl:col-span-4 space-y-3.5">
              
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-stone-300 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <span>حركة سجل المصروفات</span>
                </h2>

                <div className="w-36">
                  <select
                    value={expenseFilter}
                    onChange={(e) => setExpenseFilter(e.target.value)}
                    className="bg-stone-950 border border-stone-800 focus:border-rose-500 rounded-xl px-2.5 py-1 text-[11px] font-bold text-stone-300 focus:outline-none w-full"
                  >
                    <option value="all">كل الفئات</option>
                    {expenseCategoriesList.map((cat, idx) => (
                      <option key={`exp_cat1_${cat}_${idx}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Highlight Stats Widget for Expenses */}
              <div className="bg-stone-900 border border-stone-800/85 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 font-bold block">إجمالي قيمة المصروفات</span>
                    <span className="text-xs font-extrabold text-stone-300 mt-0.5 block">حسب الفئة المحددة</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-lg font-black text-rose-500 font-mono">{totalExpensesSum.toLocaleString()}</span>
                  <span className="text-[10px] text-stone-400 font-bold mr-1 font-mono">ج.م</span>
                </div>
              </div>

              {/* Expenses compact list / table */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-md overflow-hidden">
                {filteredExpenses.length === 0 ? (
                  <div className="py-12 text-center text-stone-500">
                    <Wallet className="w-9 h-9 text-stone-600 mx-auto mb-2 stroke-[1.25]" />
                    <p className="text-xs font-bold text-stone-400">لا يوجد مصروفات مسجلة</p>
                    <p className="text-[10px] text-stone-600 mt-1">اضغط على زر "تسجيل مصروف جديد" بالأعلى</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-stone-950 text-[10px] font-black text-stone-400 border-b border-stone-800">
                          <th className="py-2.5 px-3">التاريخ</th>
                          <th className="py-2.5 px-2 font-bold">الفئة والبيان</th>
                          <th className="py-2.5 px-2 text-center font-bold">القيمة</th>
                          <th className="py-2.5 px-2 text-left pl-3 font-bold">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-850 text-xs text-stone-300">
                        {filteredExpenses.map((exp, idx) => (
                          <tr key={exp.id ? `exp1_${exp.id}_${idx}` : `exp1_${idx}`} className="hover:bg-stone-955/40">
                            <td className="py-2 px-3 whitespace-nowrap text-stone-400 text-[10px] font-mono">
                              {new Date(exp.timestamp).toLocaleDateString('ar-EG', {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="py-2 px-2">
                              <span className="px-1.5 py-0.2 rounded bg-stone-950 text-stone-300 border border-stone-800 font-bold text-[9px] block w-fit mb-0.5">
                                {exp.category}
                              </span>
                              <p className="text-[11px] text-stone-100 max-w-[130px] truncate" title={exp.description}>
                                {exp.description || 'بلا بيان إضافي'}
                              </p>
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-black text-rose-500 text-[11px]">
                              {exp.amount.toLocaleString()} ج.م
                            </td>
                            <td className="py-2 px-2 text-left pl-3">
                              <button
                                onClick={() => {
                                  if (confirm('هل تريد حذف قيد هذا المصروف نهائياً؟')) {
                                    deleteExpense(exp.id);
                                  }
                                }}
                                className="p-1 text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                                title="حذف المصروف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      ) : (
        <>
          {/* ======================================================== */
             /* 2. CREATE NEW INVOICE VIEW (COMPACT CATALOG & CART)       */
             /* ======================================================== */}
          {/* Mobile View Selector Tab (Only visible on screens < lg) */}
          <div className="lg:hidden grid grid-cols-2 gap-2 bg-stone-900/60 p-1 rounded-xl border border-stone-800 mb-2">
          <button
            onClick={() => setMobileSubTab('catalog')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse ${
              mobileSubTab === 'catalog'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>الأصناف والكتالوج ({posProducts.length})</span>
          </button>
          <button
            onClick={() => setMobileSubTab('cart')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse relative ${
              mobileSubTab === 'cart'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>الفاتورة والسلة ({cart.length})</span>
            {cart.length > 0 && (
              <span className="mr-1.5 bg-rose-500 text-white text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {editingTransaction && (
          <div className="bg-amber-950/80 border border-amber-600/60 rounded-2xl p-3.5 mb-4 flex items-center justify-between text-amber-200 shadow-lg">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-lg shrink-0">
                ✏️
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h3 className="font-extrabold text-sm text-amber-100">
                    جاري تعديل الفاتورة رقم #{editingTransaction.receiptNumber}
                  </h3>
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-md font-extrabold">
                    حرية التعديل الكاملة
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  العميل الحالي: <strong className="text-amber-400">{editingTransaction.customerName || 'عميل نقدي'}</strong> | يمكنك إضافة أو حذف أصناف، تعديل الكميات والأسعار، ثم حفظ التعديلات.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                cancelEditingTransaction();
                setViewMode('history');
              }}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-bold rounded-xl border border-stone-700 transition-colors flex items-center space-x-1 space-x-reverse shrink-0"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>إلغاء التعديل</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Compact Product Selector Catalog (5 Cols) */}
          <div className={`lg:col-span-5 xl:col-span-5 space-y-3 ${mobileSubTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Header Controls inside Catalog */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 shadow-xl space-y-2.5">
              
              {/* Row 1: Back to Invoices List button (Top of Catalog ONLY) & Title */}
              <div className="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    onClick={() => setViewMode('history')}
                    className="px-2.5 py-1.5 bg-stone-800 hover:bg-amber-600 text-stone-200 hover:text-white rounded-xl text-[11px] font-bold flex items-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-sm"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>العودة للفواتير</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await startNewInvoice();
                      } catch (e: any) {
                        alert(`خطأ: ${e.message}`);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold flex items-center space-x-1 space-x-reverse transition-all active:scale-95 shadow-sm"
                    title="فتح فاتورة جديدة وتلقائياً توضع الفاتورة الحالية على الانتظار"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>فاتورة جديدة</span>
                  </button>
                </div>

                <div className="flex items-center space-x-1.5 space-x-reverse">
                  <span className="text-[11px] font-extrabold text-amber-400 bg-amber-950 border border-amber-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>كتالوج الاصناف ({posProducts.length})</span>
                  </span>
                </div>
              </div>

              {/* Row 2: Active Seller Display (Read-Only) */}
              <div className="bg-stone-950 border border-stone-800 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="text-stone-400 font-semibold">البائع المسؤول:</span>
                  <span className="font-extrabold text-stone-100">{currentAssociate?.name}</span>
                  <span className="text-[10px] text-stone-400">({currentAssociate?.role})</span>
                </div>
                {currentAssociate ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    كود: {currentAssociate.pin} ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-semibold bg-rose-950/80 border border-rose-900/60 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    غير مسجل
                  </span>
                )}
              </div>

              {/* Row 3: Product Search & Barcode Scanner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {/* Product Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
                  <input
                    id="pos-search-input"
                    type="text"
                    placeholder="بحث منتج أو كود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-8 pl-7 py-1.5 text-[11px] text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2 top-2 text-stone-400 hover:text-stone-200 p-0.5 rounded-md hover:bg-stone-800 transition-colors"
                      title="مسح البحث"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Barcode Scanner Input */}
                <form onSubmit={handleBarcodeScan} className="relative">
                  <Barcode className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-2.5" />
                  <input
                    id="pos-barcode-input"
                    ref={barcodeInputRef}
                    autoFocus
                    type="text"
                    placeholder={isBarcodeLoading ? 'جاري الفحص...' : 'باركود + Enter'}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    disabled={isBarcodeLoading}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pr-8 pl-7 py-1.5 text-[11px] font-mono text-stone-100 placeholder-stone-500 focus:outline-none"
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="absolute left-2 top-2 text-stone-400 hover:text-stone-200 p-0.5 rounded-md hover:bg-stone-800 transition-colors"
                      title="مسح"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </form>
              </div>

              {/* Row 4: Horizontal Scrollable Category Filter */}
              <div className="flex items-center space-x-1.5 space-x-reverse overflow-x-auto pb-1.5 scrollbar-none border-b border-stone-800/60">
                {categories.map((cat, idx) => (
                  <button
                    key={`pos_cat_${cat}_${idx}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800/80'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Price Tier Selection */}
              <div className="bg-stone-950 border border-stone-800 p-1.5 rounded-xl flex items-center justify-between text-[11px] gap-1.5">
                <span className="font-bold text-stone-300 flex items-center space-x-1 space-x-reverse shrink-0">
                  <Tag className="w-3 h-3 text-amber-400" />
                  <span>التسعير:</span>
                </span>

                <div className="flex gap-1 flex-1">
                  {[
                    { id: 'cash', label: 'كاش 💵', canView: canViewCash },
                    { id: 'installment', label: 'تقسيط 📅', canView: canViewInstallment },
                    { id: 'wholesale', label: 'جملة 📦', canView: canViewWholesale },
                  ]
                    .filter((t) => t.canView)
                    .map((tier, idx) => (
                      <button
                        key={`tier_${tier.id}_${idx}`}
                        onClick={() => setGlobalPriceTier(tier.id as PriceTier)}
                        className={`flex-1 py-0.5 rounded-lg font-bold text-[10px] transition-all text-center ${
                          globalPriceTier === tier.id
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                </div>
              </div>

            </div>

            {/* Compact Product List - Rendered as Rows */}
            <div className="flex flex-col space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
              {isSearchingProducts ? (
                <div className="py-12 text-center text-stone-400 space-y-2 bg-stone-900 border border-stone-800 rounded-xl">
                  <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-stone-300">جاري البحث في Supabase...</p>
                </div>
              ) : posProducts.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2 bg-stone-900 border border-stone-800 rounded-xl">
                  <Package className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="text-xs font-bold text-stone-300">لا توجد أصناف تطابق البحث</p>
                </div>
              ) : (
                posProducts.map((product, idx) => {
                const isLowStock = product.stock <= 5;
                const isOutOfStock = product.stock === 0;
                const isJustAdded = addedAnimationId === product.id;

                const canViewActivePrice =
                  globalPriceTier === 'cash'
                    ? canViewCash
                    : globalPriceTier === 'installment'
                    ? canViewInstallment
                    : canViewWholesale;

                const activePrice =
                  globalPriceTier === 'cash'
                    ? product.priceCash
                    : globalPriceTier === 'installment'
                    ? product.priceInstallment
                    : product.priceWholesale;

                const displayPrice = canViewActivePrice ? `${activePrice.toLocaleString()} ج.م` : '***';

                return (
                  <div
                    key={product.id ? `pos_prod_${product.id}_${idx}` : `pos_prod_${idx}`}
                    onClick={() => !isOutOfStock && triggerAddToCart(product)}
                    className={`bg-stone-900 border border-stone-800 hover:border-amber-500/60 rounded-xl p-1.5 flex items-center justify-between transition-all group cursor-pointer relative shadow-sm space-x-1.5 space-x-reverse ${
                      isJustAdded ? 'scale-[0.99] border-amber-500 ring-1 ring-amber-500/50' : ''
                    }`}
                  >
                    {/* Left/Right Product Image & Main Info */}
                    <div className="flex items-center space-x-2 space-x-reverse min-w-0 flex-1">
                      <div className="w-8.5 h-8.5 rounded-lg overflow-hidden bg-stone-950 border border-stone-800 shrink-0 relative">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 space-x-reverse">
                          <h3 className="text-[11px] font-bold text-stone-100 truncate group-hover:text-amber-400 transition-colors">
                            {product.name}
                          </h3>
                          <span className="text-[8px] bg-stone-950 text-stone-400 border border-stone-800 px-1 py-0.2 rounded font-mono shrink-0">
                            {product.category}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 space-x-reverse text-[8px] text-stone-500 font-mono mt-0.5">
                          <span>كود: {product.sku}</span>
                          <span>•</span>
                          <span>باركود: {product.barcode}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock, Active Price & Quick Add Button */}
                    <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                      <span
                        className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                          isOutOfStock
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isLowStock
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-stone-950 text-emerald-400 border border-stone-800'
                        }`}
                      >
                        {isOutOfStock ? 'نفد المخزون' : `مخزون: ${product.stock}`}
                      </span>

                      <span className="text-[11px] font-mono font-extrabold text-amber-400 min-w-[55px] text-left">
                        {displayPrice}
                      </span>

                      <button
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOutOfStock) triggerAddToCart(product);
                        }}
                        className={`py-0.5 px-2 rounded-lg text-[10px] font-bold flex items-center space-x-1 space-x-reverse transition-all ${
                          isJustAdded
                            ? 'bg-amber-500 text-white'
                            : isOutOfStock
                            ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                        }`}
                        title="إضافة للفاتورة"
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>إضافة</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                );
              }))}
            </div>

          </div>

          {/* Cart Sidebar Panel (7 Cols - High Visibility) */}
          <div className={`lg:col-span-7 xl:col-span-7 sticky top-20 ${mobileSubTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
            <CartSidebar onOpenCheckout={() => setIsPaymentOpen(true)} />
          </div>

        </div>
      </>
    )}

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={(tx) => {
          setIsPaymentOpen(false);
          setCompletedTransaction(tx);
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        transaction={completedTransaction}
        onClose={() => setCompletedTransaction(null)}
      />

      {/* Add Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setIsAddExpenseModalOpen(false)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingDown className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-stone-100">تسجيل مصروف جديد</h2>
              <p className="text-xs text-stone-400 mt-1">يرجى ملء بيانات المصروف لخصمه من الخزينة اليومية</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLocalAddExpense} className="space-y-4">
              {expenseError && (
                <div className="bg-rose-950/40 border border-rose-900/50 rounded-xl p-3 text-xs font-bold text-rose-400">
                  {expenseError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">المبلغ (ج.م) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="مثال: 150"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none font-bold font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">فئة المصروف</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
                >
                  {expenseCategoriesList.map((cat, idx) => (
                    <option key={`exp_cat2_${cat}_${idx}`} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {expenseCategory === 'دفعة لمورد' && (
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">المورد المستلم *</label>
                  <select
                    required
                    value={linkedSupplierId}
                    onChange={(e) => setLinkedSupplierId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
                  >
                    <option value="">-- اختر المورد لخصم المبلغ من مديونيته --</option>
                    {suppliers.map((s, idx) => (
                      <option key={s.id ? `supp1_${s.id}_${idx}` : `supp1_${idx}`} value={s.id}>
                        {s.name} (الرصيد الدائن الحالي: {s.currentBalance.toLocaleString('ar-EG')} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {expenseCategory === 'سلفة لموظف' && (
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">الموظف المستلم *</label>
                  <select
                    required
                    value={linkedAssociateId}
                    onChange={(e) => setLinkedAssociateId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
                  >
                    <option value="">-- اختر الموظف لتسجيل السلفة عليه --</option>
                    {associates.map((a, idx) => (
                      <option key={a.id ? `assoc1_${a.id}_${idx}` : `assoc1_${idx}`} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">البيان / تفاصيل المصروف</label>
                <textarea
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="اكتب هنا تفاصيل إضافية عن المصروف..."
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>تسجيل المصروف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="py-2 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Details & Editing Modal */}
      {selectedTxForDetail && (
        <InvoiceDetailModal
          transaction={selectedTxForDetail}
          onClose={() => setSelectedTxForDetail(null)}
        />
      )}
    </div>
  );
};

export default RegisterView;

const ExpensesSubView: React.FC = () => {
  const { expenses, addExpense, deleteExpense, suppliers, associates } = usePOS();
  
  // Local state for adding expense
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('رواتب وأجور');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [subLinkedSupplierId, setSubLinkedSupplierId] = useState('');
  const [subLinkedAssociateId, setSubLinkedAssociateId] = useState('');

  // Filtering state
  const [expenseFilter, setExpenseFilter] = useState('all');
  
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === subLinkedSupplierId);
    const selectedAssociate = associates.find((a) => a.id === subLinkedAssociateId);

    addExpense({
      amount: parsedAmount,
      category,
      description,
      linkedSupplierId: category === 'دفعة لمورد' ? subLinkedSupplierId : undefined,
      linkedSupplierName: category === 'دفعة لمورد' ? selectedSupplier?.name : undefined,
      linkedAssociateId: category === 'سلفة لموظف' ? subLinkedAssociateId : undefined,
      linkedAssociateName: category === 'سلفة لموظف' ? selectedAssociate?.name : undefined,
    });

    // Reset fields
    setAmount('');
    setDescription('');
    setSubLinkedSupplierId('');
    setSubLinkedAssociateId('');
  };

  const filteredExpenses = expenses.filter(exp => {
    if (expenseFilter === 'all') return true;
    return exp.category === expenseFilter;
  });

  const totalSum = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const categoriesList = [
    'رواتب وأجور',
    'سلفة لموظف',
    'دفعة لمورد',
    'إيجار',
    'مرافق (كهرباء / مياه)',
    'بضاعة ومستلزمات',
    'بوفيه وضيافة',
    'مصاريف نقل وشحن',
    'أخرى'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Add Expense Form */}
      <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md h-fit">
        <h2 className="text-sm font-black text-stone-100 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" />
          <span>تسجيل مصروف جديد</span>
        </h2>
        
        <form onSubmit={handleAddExpense} className="space-y-4">
          {error && (
            <div className="bg-rose-950/40 border border-rose-900/50 rounded-xl p-3 text-xs font-bold text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">المبلغ (ج.م) *</label>
            <input
              type="number"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 1500"
              className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none font-bold font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">فئة المصروف</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
            >
              {categoriesList.map((cat, idx) => (
                <option key={`exp_cat3_${cat}_${idx}`} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {category === 'دفعة لمورد' && (
            <div>
              <label className="block text-[11px] font-bold text-stone-400 mb-1">المورد المستلم *</label>
              <select
                required
                value={subLinkedSupplierId}
                onChange={(e) => setSubLinkedSupplierId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
              >
                <option value="">-- اختر المورد لخصم المبلغ من مديونيته --</option>
                {suppliers.map((s, idx) => (
                  <option key={s.id ? `supp2_${s.id}_${idx}` : `supp2_${idx}`} value={s.id}>
                    {s.name} (الرصيد الدائن الحالي: {s.currentBalance.toLocaleString('ar-EG')} ج.م)
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'سلفة لموظف' && (
            <div>
              <label className="block text-[11px] font-bold text-stone-400 mb-1">الموظف المستلم *</label>
              <select
                required
                value={subLinkedAssociateId}
                onChange={(e) => setSubLinkedAssociateId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none"
              >
                <option value="">-- اختر الموظف لتسجيل السلفة عليه --</option>
                {associates.map((a, idx) => (
                  <option key={a.id ? `assoc2_${a.id}_${idx}` : `assoc2_${idx}`} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">البيان / تفاصيل المصروف</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب هنا تفاصيل إضافية عن المصروف..."
              rows={3}
              className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 space-x-reverse transition-all active:scale-95 shadow-md"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>تسجيل المصروف</span>
          </button>
        </form>
      </div>

      {/* Expenses History List */}
      <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-stone-100">سجل حركة المصروفات</h2>
            <p className="text-[10px] text-stone-500 mt-0.5">عرض وتصفية جميع المبالغ المصروفة من الخزينة</p>
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value)}
              className="bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-300 focus:outline-none w-full sm:w-auto"
            >
              <option value="all">كل الفئات</option>
              {categoriesList.map((cat, idx) => (
                <option key={`exp_cat4_${cat}_${idx}`} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Highlight Stats Widget */}
        <div className="bg-stone-950 border border-stone-800/60 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-stone-500 font-bold block">إجمالي المصروفات المصادق عليها</span>
              <span className="text-xs font-extrabold text-stone-300 mt-0.5 block">المصروفة للفئة المحددة</span>
            </div>
          </div>
          <div className="text-left">
            <span className="text-lg font-black text-amber-500 font-mono">{totalSum.toLocaleString()}</span>
            <span className="text-[10px] text-stone-400 font-bold mr-1 font-mono">ج.م</span>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="border border-stone-800/80 rounded-xl overflow-hidden bg-stone-950/40">
          {filteredExpenses.length === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <Wallet className="w-9 h-9 text-stone-600 mx-auto mb-2 stroke-[1.25]" />
              <p className="text-xs font-bold text-stone-400">لا يوجد مصروفات مسجلة حالياً</p>
              <p className="text-[10px] text-stone-600 mt-1">سجل مصروفاً جديداً من خلال النموذج الجانبي</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-stone-950 text-[10px] font-black text-stone-400 border-b border-stone-800/80">
                    <th className="py-2.5 px-3">التاريخ والوقت</th>
                    <th className="py-2.5 px-3">الفئة</th>
                    <th className="py-2.5 px-3">البيان</th>
                    <th className="py-2.5 px-3 text-center font-bold">بواسطة</th>
                    <th className="py-2.5 px-3 text-center font-bold">القيمة</th>
                    <th className="py-2.5 px-3 text-left pl-4 font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 text-xs text-stone-300">
                  {filteredExpenses.map((exp, idx) => (
                    <tr key={exp.id ? `exp2_${exp.id}_${idx}` : `exp2_${idx}`} className="hover:bg-stone-900/40">
                      <td className="py-2 px-3 whitespace-nowrap text-stone-400 text-[11px] font-mono">
                        {new Date(exp.timestamp).toLocaleString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-200 border border-stone-700/60 font-bold text-[10px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-stone-100 max-w-xs truncate" title={exp.description}>
                        <div>{exp.description || 'بلا بيان إضافي'}</div>
                        {exp.linkedSupplierName && (
                          <div className="text-[9px] text-emerald-400 font-bold mt-0.5">
                            المورد: {exp.linkedSupplierName} (تم الخصم من الحساب)
                          </div>
                        )}
                        {exp.linkedAssociateName && (
                          <div className="text-[9px] text-sky-400 font-bold mt-0.5">
                            الموظف: {exp.linkedAssociateName} (سلفة مسجلة عليه)
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-[11px] font-bold text-stone-400">
                        {exp.associateName || 'النظام'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-black text-amber-500 text-[11px]">
                        {exp.amount.toLocaleString()} ج.م
                      </td>
                      <td className="py-2 px-3 text-left pl-4">
                        <button
                          onClick={() => {
                            if (confirm('هل تريد حذف قيد هذا المصروف نهائياً؟')) {
                              deleteExpense(exp.id);
                            }
                          }}
                          className="p-1 text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/30"
                          title="حذف المصروف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
