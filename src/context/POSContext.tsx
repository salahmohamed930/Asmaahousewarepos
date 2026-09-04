import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Associate,
  Product,
  Customer,
  Transaction,
  TransactionItem,
  CartItem,
  SplitAssociate,
  PaymentMethod,
  PriceTier,
  TransactionCommission,
  ClosedShift,
  AppSettings,
  SplitPaymentItem,
  Supplier,
  SupplierTransaction,
  ProductDiscount,
  POSExpense,
  Permission,
} from '../types';
import { DEFAULT_ADMIN_ASSOCIATE, DEFAULT_SHORTCUT_KEYS } from '../data/initialData';
import {
  db,
  addToPendingQueue,
  getPendingSyncCount,
  getFailedSyncCount,
  getLastPushTime,
  getLastPullTime,
  getLastSyncError,
  retryPendingItem,
  retryAllFailedItems as dbRetryAllFailedItems,
} from '../lib/db';
import {
  checkSupabaseConnection,
  performDeltaSync,
  processPendingSyncQueue,
  runFullSyncCycle,
  resolveTransactionTimestamp,
} from '../lib/supabaseSync';
import { getSupabaseKeys } from '../lib/supabase';

interface POSContextType {
  associates: Associate[];
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  currentAssociate: Associate | null;
  cart: CartItem[];
  selectedCustomer: Customer | null;
  splitAssociates: SplitAssociate[];
  activeHeldTransactionId: string | null;
  activeTab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'suppliers' | 'settings' | 'discounts';
  globalPriceTier: PriceTier;
  taxRate: number;
  settings: AppSettings;
  discounts: ProductDiscount[];
  hasPermission: (perm: Permission) => boolean;

  setActiveTab: (tab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'suppliers' | 'settings' | 'discounts') => void;
  updateSettings: (settings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  setCurrentAssociate: (associate: Associate | null) => void;
  setGlobalPriceTier: (tier: PriceTier) => void;
  quickSwitchByPin: (pin: string) => boolean;

  // Cart Actions
  addToCart: (product: Product, quantity?: number, priceTier?: PriceTier) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemPriceTier: (productId: string, priceTier: PriceTier) => void;
  updateCartItemDiscount: (productId: string, discountPercent: number) => void;
  updateCartItemAssociate: (productId: string, associateId?: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getCartItemDiscountAmount: (item: CartItem) => number;
  getCartItemDiscountPercent: (item: CartItem) => number;
  addDiscount: (discount: ProductDiscount) => Promise<void>;
  removeDiscount: (productId: string) => Promise<void>;

  // Split & Customer Actions
  setSplitAssociates: (splits: SplitAssociate[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;

  editingTransaction: Transaction | null;
  startEditingTransaction: (tx: Transaction) => boolean;
  cancelEditingTransaction: () => void;
  saveEditedTransaction: (
    paymentMethod: PaymentMethod,
    discountTotalOverride?: number,
    paymentDetails?: string,
    notes?: string,
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ) => Promise<Transaction>;

  // Transaction Actions
  completeTransaction: (
    paymentMethod: PaymentMethod,
    discountTotalOverride?: number,
    paymentDetails?: string,
    notes?: string,
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ) => Promise<Transaction>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  voidTransaction: (transactionId: string) => void;
  holdCart: (notes?: string) => Promise<Transaction>;
  startNewInvoice: (notes?: string) => Promise<void>;
  restoreHeldTransaction: (transactionId: string) => void;
  deleteTransaction: (transactionId: string) => Promise<void>;
  discardHeldCart: () => Promise<void>;
  clearAllHeldTransactions: () => Promise<void>;

  // Staff & Shift Management
  clockInAssociate: (associateId: string) => Promise<void>;
  clockOutAssociate: (associateId: string) => Promise<void>;
  addAssociate: (assoc: Omit<Associate, 'id' | 'isClockedIn'>) => Promise<void>;
  updateAssociate: (assoc: Associate) => Promise<void>;
  deleteAssociate: (associateId: string) => Promise<void>;

  // Catalog & Customer Management
  addProduct: (prod: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (prod: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  bulkDeleteProducts: (productIds: string[]) => Promise<void>;
  clearAllProducts: () => Promise<void>;
  bulkUpdateProducts: (productIds: string[], updates: Partial<Product>) => Promise<void>;
  addCustomer: (cust: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>) => Promise<Customer>;
  updateCustomer: (cust: Customer) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  payCustomerDebt: (customerId: string, amount: number, paymentMethod: PaymentMethod, notes?: string, associateId?: string) => Promise<Transaction>;

  // Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  recordSupplierTransaction: (tx: Omit<SupplierTransaction, 'id' | 'date'>) => Promise<void>;

  // Shift Closure Actions
  closedShifts: ClosedShift[];
  closeShift: (shift: Omit<ClosedShift, 'id'>) => Promise<void>;

  // Expenses & Return Invoice Actions
  expenses: POSExpense[];
  addExpense: (expense: Omit<POSExpense, 'id' | 'timestamp'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  returnTransaction: (transactionId: string) => Promise<void>;

  // Sync Engine State & Controls
  syncStatus: 'synced' | 'syncing' | 'pending' | 'failed' | 'offline';
  lastPushTime: string | null;
  lastPullTime: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  lastSyncError: string | null;
  isSyncDetailsOpen: boolean;
  setIsSyncDetailsOpen: (open: boolean) => void;
  syncSummaryResult: { uploadedCount: number; downloadedCount: number; failedCount: number; completedAt: string } | null;
  setSyncSummaryResult: (res: any) => void;
  syncNow: () => Promise<void>;
  retryFailedItem: (id: number) => Promise<void>;
  retryAllFailedItems: () => Promise<void>;

  refreshDataFromSupabase: () => Promise<void>;
  syncUnsyncedItems: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  dbStatus: { isConnected: boolean; isChecking: boolean; errorMessage?: string; isCustom: boolean };
  testDbConnection: () => Promise<{ success: boolean; errorMessage?: string }>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'asmaa_pos_state_ar_v3';

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local-First Dexie State
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closedShifts, setClosedShifts] = useState<ClosedShift[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [expenses, setExpenses] = useState<POSExpense[]>([]);
  const [discounts, setDiscounts] = useState<ProductDiscount[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Sync Engine State
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'failed' | 'offline'>('synced');
  const [lastPushTime, setLastPushTimeState] = useState<string | null>(null);
  const [lastPullTime, setLastPullTimeState] = useState<string | null>(null);
  const [failedSyncCount, setFailedSyncCount] = useState<number>(0);
  const [lastSyncError, setLastSyncErrorState] = useState<string | null>(null);
  const [isSyncDetailsOpen, setIsSyncDetailsOpen] = useState<boolean>(false);
  const [syncSummaryResult, setSyncSummaryResult] = useState<{
    uploadedCount: number;
    downloadedCount: number;
    failedCount: number;
    completedAt: string;
  } | null>(null);

  // Local UI State
  const [currentAssociate, setCurrentAssociateState] = useState<Associate | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [splitAssociates, setSplitAssociates] = useState<SplitAssociate[]>([]);
  const [activeHeldTransactionId, setActiveHeldTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [globalPriceTier, setGlobalPriceTierState] = useState<PriceTier>('cash');
  const [taxRate] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'suppliers' | 'settings' | 'discounts'
  >('register');

  const [dbStatus, setDbStatus] = useState<{
    isConnected: boolean;
    isChecking: boolean;
    errorMessage?: string;
    isCustom: boolean;
  }>({
    isConnected: true,
    isChecking: false,
    isCustom: false,
  });

  // Local Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    const defaultCats = [
      'أطقم طهي وحلل',
      'أدوات مائدة وتوزيع',
      'أجهزة كهربائية منزلية',
      'بلاستيكيات ومنظمات',
      'زجاجيات وبورسلين',
      'أدوات تنظيف ومستلزمات',
    ];
    const defaultMargins = {
      default: { cash: 20, wholesale: 10, installment: 30 },
      categories: {
        'أطقم طهي وحلل': { cash: 25, wholesale: 15, installment: 35 },
        'أجهزة كهربائية منزلية': { cash: 15, wholesale: 8, installment: 25 },
      },
    };
    const defaultPrint: AppSettings['printSettings'] = {
      headerText: 'أسماء للأدوات المنزليه',
      address: 'اخر شارع المدارس امام دار المناسبات حى الصفا',
      phoneNumbers: '01229028133 - 01222334884',
      footerText: 'شكرا و دائما فى خدمتكم',
      footerSubText: 'visit us again',
      facebookUrl: 'https://facebook.com',
      showSellerCode: true,
      showQRCode: true,
      showLogo: false,
      receiptType: 'thermal' as const,
      directPrintEnabled: true,
      invoicePrinterName: '',
      barcodePrinterName: '',
      invoiceCopies: 1,
      barcodeCopies: 1,
      invoicePaperSize: '80mm',
      barcodePaperSize: '38x25mm',
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          theme: parsed.theme || 'dark',
          profitMargins: parsed.profitMargins || defaultMargins,
          printSettings: parsed.printSettings || defaultPrint,
          categories: parsed.categories || defaultCats,
          loyaltyPointsRatio: parsed.loyaltyPointsRatio !== undefined ? parsed.loyaltyPointsRatio : 10,
          loyaltyPointValue: parsed.loyaltyPointValue !== undefined ? parsed.loyaltyPointValue : 0.1,
          shortcutKeys: parsed.shortcutKeys ? { ...DEFAULT_SHORTCUT_KEYS, ...parsed.shortcutKeys } : DEFAULT_SHORTCUT_KEYS,
        };
      } catch {
        // ignore
      }
    }
    return {
      theme: 'dark',
      profitMargins: defaultMargins,
      printSettings: defaultPrint,
      categories: defaultCats,
      loyaltyPointsRatio: 10,
      loyaltyPointValue: 0.1,
      shortcutKeys: DEFAULT_SHORTCUT_KEYS,
    };
  });

  // Global Function Key Shortcuts Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!e.key || !/^F(1[0-2]|[1-9])$/.test(e.key)) return;

      const activeShortcuts = { ...DEFAULT_SHORTCUT_KEYS, ...(settings.shortcutKeys || {}) };
      const actionId = activeShortcuts[e.key];

      if (!actionId || actionId === 'none') return;

      e.preventDefault();
      e.stopPropagation();

      if (actionId === 'open_new_invoice') {
        startNewInvoice().then(() => {
          window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
        });
      } else if (actionId === 'open_register') setActiveTab('register');
      else if (actionId === 'open_catalog') setActiveTab('catalog');
      else if (actionId === 'open_customers') setActiveTab('customers');
      else if (actionId === 'open_suppliers') setActiveTab('suppliers');
      else if (actionId === 'open_analytics') setActiveTab('analytics');
      else if (actionId === 'open_discounts') setActiveTab('discounts');
      else if (actionId === 'open_associates') setActiveTab('associates');
      else if (actionId === 'open_settings') setActiveTab('settings');
      else if (actionId === 'clear_cart') {
        if (cart.length > 0 && window.confirm('هل أنت متأكد من تفريغ سلة المبيعات بالكامل؟')) {
          setCart([]);
        }
      } else {
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [settings.shortcutKeys, cart.length]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_settings`, JSON.stringify(settings));
    if (settings.theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
  }, [settings]);

  // --- LOCAL READ ENGINE (Reads directly from Dexie.js) ---
  const loadFromLocal = useCallback(async () => {
    try {
      const [
        localProds,
        localCusts,
        localSupps,
        localStxs,
        localTxs,
        localAssocs,
        localShifts,
        localExps,
        localDiscs,
        queueCount,
        failedCount,
        pTime,
        pullTime,
        syncErr,
      ] = await Promise.all([
        db.products.toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
        db.supplierTransactions.toArray(),
        db.transactions.toArray(),
        db.associates.toArray(),
        db.closedShifts.toArray(),
        db.expenses.toArray(),
        db.discounts.toArray(),
        getPendingSyncCount(),
        getFailedSyncCount(),
        getLastPushTime(),
        getLastPullTime(),
        getLastSyncError(),
      ]);

      setProducts(localProds);
      setCustomers(localCusts);
      setSuppliers(localSupps);
      setSupplierTransactions(localStxs);

      // Self-heal any locally cached transactions where timestamps were previously overwritten
      let txsNeedRepair = false;
      const verifiedTxs = localTxs.map((tx) => {
        const correctTime = resolveTransactionTimestamp(tx);
        if (tx.timestamp !== correctTime) {
          txsNeedRepair = true;
          return { ...tx, timestamp: correctTime };
        }
        return tx;
      });
      if (txsNeedRepair) {
        db.transactions.bulkPut(verifiedTxs).catch((e) => console.warn('[POSContext] bulkPut repair error:', e));
      }
      setTransactions(verifiedTxs);
      setClosedShifts(localShifts);
      setExpenses(localExps);
      setDiscounts(localDiscs);
      setPendingSyncCount(queueCount);
      setFailedSyncCount(failedCount);
      setLastPushTimeState(pTime);
      setLastPullTimeState(pullTime);
      setLastSyncErrorState(syncErr);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
      } else if (failedCount > 0) {
        setSyncStatus('failed');
      } else if (queueCount > 0) {
        setSyncStatus('pending');
      } else {
        setSyncStatus('synced');
      }

      if (localAssocs.length === 0) {
        await db.associates.put(DEFAULT_ADMIN_ASSOCIATE);
        await addToPendingQueue('associates', 'INSERT', DEFAULT_ADMIN_ASSOCIATE);
        setAssociates([DEFAULT_ADMIN_ASSOCIATE]);
      } else {
        setAssociates(localAssocs);
      }
    } catch (err) {
      console.error('[POSContext] Error reading from Dexie.js:', err);
    }
  }, []);

  // --- BACKGROUND SYNC TRIGGER ---
  const triggerBackgroundSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      const syncResult = await runFullSyncCycle();
      await loadFromLocal();
    } catch (err: any) {
      console.warn('[POSContext] Background sync warning:', err);
      await loadFromLocal();
    }
  }, [loadFromLocal]);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      const syncResult = await runFullSyncCycle();
      await loadFromLocal();
      if (syncResult) {
        setSyncSummaryResult({
          uploadedCount: syncResult.outboxResult.processedCount,
          downloadedCount: syncResult.deltaSyncResult.downloadedCount,
          failedCount: syncResult.outboxResult.failedCount + (syncResult.deltaSyncResult.success ? 0 : 1),
          completedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (error: any) {
      console.error('[POSContext] Manual sync error:', error);
      await loadFromLocal();
    }
  }, [loadFromLocal]);

  const retryFailedItem = useCallback(async (id: number) => {
    await retryPendingItem(id);
    await triggerBackgroundSync();
  }, [triggerBackgroundSync]);

  const retryAllFailedItems = useCallback(async () => {
    await dbRetryAllFailedItems();
    await triggerBackgroundSync();
  }, [triggerBackgroundSync]);

  // Initial load from Dexie + trigger background sync
  useEffect(() => {
    loadFromLocal().then(() => {
      triggerBackgroundSync();
    });
  }, [loadFromLocal, triggerBackgroundSync]);

  // Listen for 'online' status & periodic background sync (no tab focus triggers!)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[POSContext] Online status detected. Triggering outbox worker & delta sync...');
      triggerBackgroundSync();
    };

    window.addEventListener('online', handleOnline);
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        triggerBackgroundSync();
      }
    }, 600000); // 10 minutes background cycle for delta sync (only fetches new/updated records)

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
    };
  }, [triggerBackgroundSync]);

  const testDbConnection = async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    const result = await checkSupabaseConnection();
    setDbStatus({
      isConnected: result.success,
      isChecking: false,
      errorMessage: result.errorMessage,
      isCustom: getSupabaseKeys().isCustom,
    });
    return result;
  };

  const updateSettings = (newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettings((prev) => (typeof newSettings === 'function' ? newSettings(prev) : { ...prev, ...newSettings }));
  };

  const syncUnsyncedItems = async () => {
    await triggerBackgroundSync();
  };

  const setCurrentAssociate = (assoc: Associate | null) => {
    setCurrentAssociateState(assoc);
  };

  const setGlobalPriceTier = (tier: PriceTier) => {
    setGlobalPriceTierState(tier);
    setCart((prevCart) => prevCart.map((item) => ({ ...item, selectedPriceTier: tier })));
  };

  const quickSwitchByPin = (pin: string): boolean => {
    const found = associates.find((a) => a.pin === pin || a.password === pin);
    if (found) {
      setCurrentAssociateState(found);
      if (!found.isClockedIn) {
        clockInAssociate(found.id);
      }
      return true;
    }
    return false;
  };

  // --- CART OPERATIONS ---
  const addToCart = (product: Product, quantity = 1, priceTier?: PriceTier) => {
    const tier = priceTier || globalPriceTier;
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].quantity + quantity;
        if (newQty > product.stock) {
          alert(`خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`);
          return prevCart;
        }
        updated[existingIndex].quantity = newQty;
        updated[existingIndex].selectedPriceTier = tier;
        return updated;
      }
      if (quantity > product.stock) {
        alert(`خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`);
        return prevCart;
      }
      return [
        ...prevCart,
        { product, quantity, selectedPriceTier: tier, discountPercent: 0 },
      ];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && quantity > product.stock) {
      alert(`خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)));
  };

  const updateCartItemPriceTier = (productId: string, priceTier: PriceTier) => {
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, selectedPriceTier: priceTier } : item)));
  };

  const updateCartItemDiscount = (productId: string, discountPercent: number) => {
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, discountPercent: Math.min(100, Math.max(0, discountPercent)) } : item)));
  };

  const updateCartItemAssociate = (productId: string, associateId?: string) => {
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, assignedAssociateId: associateId } : item)));
  };

  const getItemUnitPrice = (item: CartItem): number => {
    if (item.overridePrice !== undefined && item.overridePrice > 0) return item.overridePrice;
    const tier = item.selectedPriceTier || globalPriceTier;
    if (tier === 'cash') return item.product.priceCash || 0;
    if (tier === 'installment') return item.product.priceInstallment || 0;
    if (tier === 'wholesale') return item.product.priceWholesale || 0;
    return item.product.priceCash || 0;
  };

  const getCartItemDiscountAmount = (item: CartItem): number => {
    const unitPrice = getItemUnitPrice(item);
    const adminDiscount = discounts.find((d) => d.productId === item.product.id && d.isActive !== false);
    let adminDiscountAmt = 0;
    if (adminDiscount) {
      const tier = item.selectedPriceTier || globalPriceTier;
      const appliesToCash = !adminDiscount.applyTo || adminDiscount.applyTo === 'cash' || adminDiscount.applyTo === 'both';
      const appliesToInstallment = !adminDiscount.applyTo || adminDiscount.applyTo === 'installment' || adminDiscount.applyTo === 'both';

      let isApplicable = false;
      if (tier === 'cash' && appliesToCash) isApplicable = true;
      else if (tier === 'installment' && appliesToInstallment) isApplicable = true;
      else if (tier === 'wholesale' && appliesToCash) isApplicable = true;
      else if (tier !== 'cash' && tier !== 'installment' && appliesToCash) isApplicable = true;

      if (isApplicable) {
        if (adminDiscount.type === 'percentage') {
          adminDiscountAmt = (unitPrice * adminDiscount.value) / 100;
        } else {
          adminDiscountAmt = adminDiscount.value;
        }
      }
    }

    const manualDiscountAmt = (unitPrice * (item.discountPercent || 0)) / 100;
    const totalDiscountPerUnit = Math.min(unitPrice, adminDiscountAmt + manualDiscountAmt);
    return Math.round(totalDiscountPerUnit * item.quantity * 100) / 100;
  };

  const getCartItemDiscountPercent = (item: CartItem): number => {
    const unitPrice = getItemUnitPrice(item);
    if (unitPrice <= 0) return 0;
    const discountAmt = getCartItemDiscountAmount(item);
    const originalTotal = unitPrice * item.quantity;
    return Math.round((discountAmt / originalTotal) * 100 * 100) / 100;
  };

  const addDiscount = async (discount: ProductDiscount) => {
    await db.discounts.put(discount);
    await addToPendingQueue('discounts', 'INSERT', discount);
    setDiscounts((prev) => [...prev.filter((d) => d.productId !== discount.productId), discount]);
    processPendingSyncQueue();
  };

  const removeDiscount = async (productId: string) => {
    await db.discounts.delete(productId);
    await addToPendingQueue('discounts', 'DELETE', { productId });
    setDiscounts((prev) => prev.filter((d) => d.productId !== productId));
    processPendingSyncQueue();
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSplitAssociates([]);
    setActiveHeldTransactionId(null);
    setEditingTransaction(null);
  };

  // --- LOCAL-FIRST WRITE OPERATIONS (Save to Dexie -> Queue in Outbox -> Update State -> Sync) ---

  const addProduct = async (prodData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...prodData,
      id: prodData.sku || prodData.barcode || `prod_${Date.now()}`,
    };
    await db.products.put(newProduct);
    await addToPendingQueue('products', 'INSERT', newProduct);
    setProducts((prev) => [newProduct, ...prev]);
    processPendingSyncQueue();
  };

  const updateProduct = async (prod: Product) => {
    await db.products.put(prod);
    await addToPendingQueue('products', 'UPDATE', prod);
    setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
    processPendingSyncQueue();
  };

  const deleteProduct = async (productId: string) => {
    await db.products.delete(productId);
    await addToPendingQueue('products', 'DELETE', { id: productId });
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    processPendingSyncQueue();
  };

  const bulkDeleteProducts = async (productIds: string[]) => {
    for (const id of productIds) {
      await db.products.delete(id);
      await addToPendingQueue('products', 'DELETE', { id });
    }
    setProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
    processPendingSyncQueue();
  };

  const clearAllProducts = async () => {
    const all = await db.products.toArray();
    for (const p of all) {
      await db.products.delete(p.id);
      await addToPendingQueue('products', 'DELETE', { id: p.id });
    }
    setProducts([]);
    processPendingSyncQueue();
  };

  const bulkUpdateProducts = async (productIds: string[], updates: Partial<Product>) => {
    for (const id of productIds) {
      const p = products.find((prod) => prod.id === id);
      if (p) {
        const updated = { ...p, ...updates };
        await db.products.put(updated);
        await addToPendingQueue('products', 'UPDATE', updated);
      }
    }
    await loadFromLocal();
    processPendingSyncQueue();
  };

  const addCustomer = async (custData: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>): Promise<Customer> => {
    const numId = String(Math.floor(Date.now() % 1000000000) + Math.floor(Math.random() * 1000));
    const newCustomer: Customer = {
      ...custData,
      id: numId,
      totalSpent: 0,
      loyaltyPoints: 50,
    };
    await db.customers.put(newCustomer);
    await addToPendingQueue('customers', 'INSERT', newCustomer);
    setCustomers((prev) => [newCustomer, ...prev]);
    setSelectedCustomer(newCustomer);
    processPendingSyncQueue();
    return newCustomer;
  };

  const updateCustomer = async (cust: Customer) => {
    await db.customers.put(cust);
    await addToPendingQueue('customers', 'UPDATE', cust);
    setCustomers((prev) => prev.map((c) => (c.id === cust.id ? cust : c)));
    if (selectedCustomer?.id === cust.id) setSelectedCustomer(cust);
    processPendingSyncQueue();
  };

  const deleteCustomer = async (customerId: string) => {
    await db.customers.delete(customerId);
    await addToPendingQueue('customers', 'DELETE', { id: customerId });
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    if (selectedCustomer?.id === customerId) setSelectedCustomer(null);
    processPendingSyncQueue();
  };

  const addSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `supp_${Date.now()}`,
      currentBalance: supplierData.currentBalance || 0,
    };
    await db.suppliers.put(newSupplier);
    await addToPendingQueue('suppliers', 'INSERT', newSupplier);
    setSuppliers((prev) => [newSupplier, ...prev]);
    processPendingSyncQueue();
    return newSupplier;
  };

  const updateSupplier = async (supplier: Supplier) => {
    await db.suppliers.put(supplier);
    await addToPendingQueue('suppliers', 'UPDATE', supplier);
    setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)));
    processPendingSyncQueue();
  };

  const deleteSupplier = async (supplierId: string) => {
    await db.suppliers.delete(supplierId);
    await addToPendingQueue('suppliers', 'DELETE', { id: supplierId });
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    processPendingSyncQueue();
  };

  const recordSupplierTransaction = async (txData: Omit<SupplierTransaction, 'id' | 'date'>) => {
    const newTx: SupplierTransaction = {
      ...txData,
      id: `stx_${Date.now()}`,
      date: new Date().toISOString(),
    };
    await db.supplierTransactions.put(newTx);
    await addToPendingQueue('supplier_transactions', 'INSERT', newTx);
    setSupplierTransactions((prev) => [newTx, ...prev]);

    const targetSupplier = suppliers.find((s) => s.id === txData.supplierId);
    if (targetSupplier) {
      let delta = 0;
      if (txData.type === 'supply_invoice') delta = txData.amount;
      else if (txData.type === 'payment' || txData.type === 'return') delta = -txData.amount;

      const updatedSupplier = {
        ...targetSupplier,
        currentBalance: Math.max(0, (targetSupplier.currentBalance || 0) + delta),
      };
      await updateSupplier(updatedSupplier);
    }
    processPendingSyncQueue();
  };

  const addExpense = async (expenseData: Omit<POSExpense, 'id' | 'timestamp'>) => {
    const newExpense: POSExpense = {
      ...expenseData,
      id: `expense_${Date.now()}`,
      timestamp: new Date().toISOString(),
      associateId: currentAssociate?.id || undefined,
      associateName: currentAssociate?.name || undefined,
    };
    await db.expenses.put(newExpense);
    await addToPendingQueue('expenses', 'INSERT', newExpense);
    setExpenses((prev) => [newExpense, ...prev]);

    if (expenseData.category === 'دفعة لمورد' && expenseData.linkedSupplierId) {
      await recordSupplierTransaction({
        supplierId: expenseData.linkedSupplierId,
        supplierName: expenseData.linkedSupplierName || '',
        type: 'payment',
        amount: expenseData.amount,
        referenceNumber: newExpense.id,
        notes: expenseData.description || 'دفعة مسجلة عبر المصروفات اليومية',
        associateName: currentAssociate?.name || 'النظام',
      });
    }

    if (expenseData.category === 'سلفة لموظف' && expenseData.linkedAssociateId) {
      const targetAssoc = associates.find((a) => a.id === expenseData.linkedAssociateId);
      if (targetAssoc) {
        await updateAssociate({
          ...targetAssoc,
          advancesBalance: (targetAssoc.advancesBalance || 0) + expenseData.amount,
        });
      }
    }
    processPendingSyncQueue();
  };

  const deleteExpense = async (id: string) => {
    await db.expenses.delete(id);
    await addToPendingQueue('expenses', 'DELETE', { id });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    processPendingSyncQueue();
  };

  const clockInAssociate = async (associateId: string) => {
    const target = associates.find((a) => a.id === associateId);
    if (target) {
      const updated = { ...target, isClockedIn: true, clockInTime: new Date().toISOString() };
      await updateAssociate(updated);
    }
  };

  const clockOutAssociate = async (associateId: string) => {
    const target = associates.find((a) => a.id === associateId);
    if (target) {
      const updated = { ...target, isClockedIn: false, clockInTime: undefined };
      await updateAssociate(updated);
    }
  };

  const addAssociate = async (assocData: Omit<Associate, 'id' | 'isClockedIn'>) => {
    const newAssoc: Associate = {
      ...assocData,
      id: `assoc_${Date.now()}`,
      isClockedIn: true,
      clockInTime: new Date().toISOString(),
    };
    await db.associates.put(newAssoc);
    await addToPendingQueue('associates', 'INSERT', newAssoc);
    setAssociates((prev) => [...prev, newAssoc]);
    if (!currentAssociate) setCurrentAssociateState(newAssoc);
    processPendingSyncQueue();
  };

  const updateAssociate = async (assoc: Associate) => {
    await db.associates.put(assoc);
    await addToPendingQueue('associates', 'UPDATE', assoc);
    setAssociates((prev) => prev.map((a) => (a.id === assoc.id ? assoc : a)));
    if (currentAssociate?.id === assoc.id) setCurrentAssociateState(assoc);
    processPendingSyncQueue();
  };

  const deleteAssociate = async (associateId: string) => {
    await db.associates.delete(associateId);
    await addToPendingQueue('associates', 'DELETE', { id: associateId });
    setAssociates((prev) => prev.filter((a) => a.id !== associateId));
    if (currentAssociate?.id === associateId) setCurrentAssociateState(null);
    processPendingSyncQueue();
  };

  const closeShift = async (shiftData: Omit<ClosedShift, 'id'>) => {
    const newShift: ClosedShift = {
      ...shiftData,
      id: `shift_${Date.now()}`,
    };
    await db.closedShifts.put(newShift);
    await addToPendingQueue('closed_shifts', 'INSERT', newShift);
    setClosedShifts((prev) => [newShift, ...prev]);
    processPendingSyncQueue();
  };

  const cancelEditingTransaction = () => {
    setEditingTransaction(null);
    setCart([]);
    setSelectedCustomer(null);
    setSplitAssociates([]);
    setActiveHeldTransactionId(null);
  };

  const startEditingTransaction = (tx: Transaction): boolean => {
    const canEdit = !currentAssociate || currentAssociate.role === 'مدير الفرع' || hasPermission('edit_invoice');
    if (!canEdit) {
      alert('عذراً، ليس لديك صلاحية لتعديل الفواتير. يمكنك فقط عرض تفاصيل الفاتورة.');
      return false;
    }

    // If this transaction is currently held ('معلقة'), restore it to the cart directly
    if (tx.status === 'معلقة') {
      restoreHeldTransaction(tx.id);
      return true;
    }

    setEditingTransaction(tx);

    const reconstructedCart: CartItem[] = tx.items.map((item) => {
      const foundProd = products.find((p) => p.id === item.productId);
      const prod: Product = foundProd || {
        id: item.productId,
        name: item.productName,
        sku: item.sku || '',
        barcode: item.productBarcode || '',
        category: 'عام',
        priceCash: item.unitPrice,
        priceInstallment: item.unitPrice,
        priceWholesale: item.unitPrice,
        cost: item.unitPrice,
        stock: 999,
        image: '',
      };
      return {
        product: prod,
        quantity: item.quantity,
        selectedPriceTier: item.priceTier || 'cash',
        discountPercent: item.discountPercent || 0,
        assignedAssociateId: item.assignedAssociateId,
        overridePrice: item.unitPrice,
      };
    });

    setCart(reconstructedCart);

    if (tx.customerId) {
      const cust = customers.find((c) => c.id === tx.customerId);
      if (cust) {
        setSelectedCustomer(cust);
      } else {
        setSelectedCustomer({
          id: tx.customerId,
          name: tx.customerName || 'عميل',
          phone: '',
          email: '',
          loyaltyPoints: 0,
          totalSpent: 0,
        });
      }
    } else if (tx.customerName) {
      setSelectedCustomer({
        id: `temp_${Date.now()}`,
        name: tx.customerName,
        phone: '',
        email: '',
        loyaltyPoints: 0,
        totalSpent: 0,
      });
    } else {
      setSelectedCustomer(null);
    }

    setSplitAssociates(tx.splitAssociates || []);
    setActiveTab('register');
    return true;
  };

  const saveEditedTransaction = async (
    paymentMethod: PaymentMethod,
    discountTotalOverride = 0,
    paymentDetails = '',
    notes = '',
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ): Promise<Transaction> => {
    if (!editingTransaction) {
      throw new Error('لا توجد فاتورة قيد التعديل حالياً');
    }

    let subtotal = 0;
    let discountTotal = 0;

    const transactionItems: TransactionItem[] = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = getCartItemDiscountAmount(item);
      const lineNetTotal = Math.max(0, lineOriginalTotal - lineDiscount);

      subtotal += lineOriginalTotal;
      discountTotal += lineDiscount;

      return {
        productId: item.product.id,
        productName: item.product.name,
        productBarcode: item.product.barcode,
        sku: item.product.sku,
        unitPrice,
        quantity: item.quantity,
        totalPrice: lineNetTotal,
        discountAmount: lineDiscount,
        discountPercent: item.discountPercent || 0,
        priceTier: item.selectedPriceTier || globalPriceTier,
        assignedAssociateId: item.assignedAssociateId,
        assignedAssociateName: associates.find((a) => a.id === item.assignedAssociateId)?.name,
      };
    });

    if (discountTotalOverride > 0) discountTotal = discountTotalOverride;

    const grandTotal = Math.max(0, subtotal - discountTotal);
    const primaryAssocId = currentAssociate?.id || editingTransaction.primaryAssociateId || 'system';
    const primaryAssocName = currentAssociate?.name || editingTransaction.primaryAssociateName || 'النظام';

    const updatedTx: Transaction = {
      ...editingTransaction,
      items: transactionItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paymentMethod,
      paymentDetails: paymentDetails || editingTransaction.paymentDetails,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      primaryAssociateId: primaryAssocId,
      primaryAssociateName: primaryAssocName,
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      notes: notes || editingTransaction.notes || 'تم تعديل الفاتورة بنجاح',
      amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
      amountDeferred: amountDeferred !== undefined ? amountDeferred : 0,
      splitPayments: splitPayments && splitPayments.length > 0 ? splitPayments : undefined,
    };

    await updateTransaction(updatedTx);
    setEditingTransaction(null);
    clearCart();

    return updatedTx;
  };

  const completeTransaction = async (
    paymentMethod: PaymentMethod,
    discountTotalOverride = 0,
    paymentDetails = '',
    notes = '',
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ): Promise<Transaction> => {
    if (cart.length === 0) {
      throw new Error('السلة فارغة. يرجى إضافة عناصر أولاً.');
    }

    let subtotal = 0;
    let discountTotal = 0;

    const transactionItems: TransactionItem[] = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = getCartItemDiscountAmount(item);
      const lineNetTotal = Math.max(0, lineOriginalTotal - lineDiscount);

      subtotal += lineOriginalTotal;
      discountTotal += lineDiscount;

      return {
        productId: item.product.id,
        productName: item.product.name,
        productBarcode: item.product.barcode,
        sku: item.product.sku,
        unitPrice,
        quantity: item.quantity,
        totalPrice: lineNetTotal,
        discountAmount: lineDiscount,
        discountPercent: item.discountPercent || 0,
        priceTier: item.selectedPriceTier || globalPriceTier,
        assignedAssociateId: item.assignedAssociateId,
        assignedAssociateName: associates.find((a) => a.id === item.assignedAssociateId)?.name,
      };
    });

    if (discountTotalOverride > 0) discountTotal = discountTotalOverride;

    const grandTotal = Math.max(0, subtotal - discountTotal);
    const primaryAssocId = currentAssociate?.id || 'system';
    const primaryAssocName = currentAssociate?.name || 'النظام';

    const commissions: TransactionCommission[] = [];
    if (splitAssociates.length > 0) {
      splitAssociates.forEach((sa) => {
        const assoc = associates.find((a) => a.id === sa.associateId);
        if (assoc) {
          const shareAmount = (grandTotal * sa.sharePercentage) / 100;
          const comm = shareAmount * (assoc.commissionRate || 0.05);
          commissions.push({
            associateId: assoc.id,
            associateName: assoc.name,
            saleAmount: shareAmount,
            commissionAmount: comm,
            sharePercentage: sa.sharePercentage,
          });
        }
      });
    } else if (currentAssociate) {
      const comm = grandTotal * (currentAssociate.commissionRate || 0.05);
      commissions.push({
        associateId: currentAssociate.id,
        associateName: currentAssociate.name,
        saleAmount: grandTotal,
        commissionAmount: comm,
        sharePercentage: 100,
      });
    }

    const receiptNumber = `RCP-ASM-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTransaction: Transaction = {
      id: activeHeldTransactionId || `tx_${Date.now()}`,
      receiptNumber,
      timestamp: new Date().toISOString(),
      items: transactionItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paymentMethod,
      paymentDetails,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      primaryAssociateId: primaryAssocId,
      primaryAssociateName: primaryAssocName,
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      commissions,
      notes,
      status: 'مكتملة',
      amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
      amountDeferred: amountDeferred !== undefined ? amountDeferred : 0,
      splitPayments: splitPayments && splitPayments.length > 0 ? splitPayments : undefined,
      isSynced: false,
    };

    // 1. Update product inventory locally & queue
    for (const item of cart) {
      const p = products.find((prod) => prod.id === item.product.id);
      if (p) {
        const updatedProd = { ...p, stock: Math.max(0, p.stock - item.quantity) };
        await db.products.put(updatedProd);
        await addToPendingQueue('products', 'UPDATE', updatedProd);
      }
    }

    // 2. Update customer metrics locally & queue
    if (selectedCustomer) {
      const ratio = settings.loyaltyPointsRatio || 10;
      const addedPoints = Math.floor(grandTotal / ratio);
      const updatedCust: Customer = {
        ...selectedCustomer,
        totalSpent: (selectedCustomer.totalSpent || 0) + grandTotal,
        loyaltyPoints: (selectedCustomer.loyaltyPoints || 0) + addedPoints,
        currentDebt: (selectedCustomer.currentDebt || 0) + (amountDeferred || 0),
      };
      await db.customers.put(updatedCust);
      await addToPendingQueue('customers', 'UPDATE', updatedCust);
      setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
    }

    // 3. Save transaction locally & queue
    await db.transactions.put(newTransaction);
    await addToPendingQueue('transactions', 'INSERT', newTransaction);

    // 4. Remove any active held transaction so it never persists after completion
    const toDeleteIds: string[] = [];
    if (activeHeldTransactionId && activeHeldTransactionId !== newTransaction.id) {
      toDeleteIds.push(activeHeldTransactionId);
    }
    if (editingTransaction && editingTransaction.status === 'معلقة' && editingTransaction.id !== newTransaction.id && !toDeleteIds.includes(editingTransaction.id)) {
      toDeleteIds.push(editingTransaction.id);
    }

    for (const delId of toDeleteIds) {
      await db.transactions.delete(delId);
      await addToPendingQueue('transactions', 'DELETE', { id: delId });
    }

    setTransactions((prev) => [
      newTransaction,
      ...prev.filter((t) => t.id !== newTransaction.id && !toDeleteIds.includes(t.id)),
    ]);
    clearCart();
    processPendingSyncQueue();

    return newTransaction;
  };

  const holdCart = async (notes = 'فاتورة معلقة'): Promise<Transaction> => {
    if (cart.length === 0) throw new Error('السلة فارغة. يرجى إضافة عناصر قبل التعليق.');

    const subtotal = cart.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0);
    const discountTotal = cart.reduce((sum, item) => sum + getCartItemDiscountAmount(item), 0);
    const grandTotal = Math.max(0, subtotal - discountTotal);

    const transactionItems: TransactionItem[] = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productBarcode: item.product.barcode,
      sku: item.product.sku,
      unitPrice: getItemUnitPrice(item),
      quantity: item.quantity,
      totalPrice: Math.max(0, getItemUnitPrice(item) * item.quantity - getCartItemDiscountAmount(item)),
      discountAmount: getCartItemDiscountAmount(item),
      discountPercent: item.discountPercent || 0,
      priceTier: item.selectedPriceTier || globalPriceTier,
      assignedAssociateId: item.assignedAssociateId,
    }));

    const txId = activeHeldTransactionId || `held_${Date.now()}`;
    const heldTx: Transaction = {
      id: txId,
      receiptNumber: `HLD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      items: transactionItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paymentMethod: 'كاش',
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      primaryAssociateId: currentAssociate?.id || 'system',
      primaryAssociateName: currentAssociate?.name || 'النظام',
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      commissions: [],
      notes,
      status: 'معلقة',
      originalCart: cart,
    };

    await db.transactions.put(heldTx);
    await addToPendingQueue('transactions', 'INSERT', heldTx);
    setTransactions((prev) => [heldTx, ...prev.filter((t) => t.id !== heldTx.id)]);
    clearCart();
    processPendingSyncQueue();

    return heldTx;
  };

  const startNewInvoice = async (): Promise<void> => {
    clearCart();
  };

  const restoreHeldTransaction = (transactionId: string) => {
    const foundTx = transactions.find((t) => t.id === transactionId);
    if (!foundTx) return;

    if (foundTx.originalCart && foundTx.originalCart.length > 0) {
      setCart(foundTx.originalCart);
    } else {
      const reconstructed: CartItem[] = foundTx.items.map((item) => {
        const prod = products.find((p) => p.id === item.productId) || {
          id: item.productId,
          name: item.productName,
          sku: item.sku || '',
          barcode: item.productBarcode || '',
          category: 'عام',
          priceCash: item.unitPrice,
          priceInstallment: item.unitPrice,
          priceWholesale: item.unitPrice,
          cost: item.unitPrice,
          stock: 999,
          image: '',
        };
        return {
          product: prod,
          quantity: item.quantity,
          selectedPriceTier: item.priceTier || 'cash',
          discountPercent: item.discountPercent || 0,
          assignedAssociateId: item.assignedAssociateId,
          overridePrice: item.unitPrice,
        };
      });
      setCart(reconstructed);
    }

    if (foundTx.customerId) {
      const cust = customers.find((c) => c.id === foundTx.customerId);
      setSelectedCustomer(cust || null);
    }

    setSplitAssociates(foundTx.splitAssociates || []);
    setActiveHeldTransactionId(transactionId);
    setEditingTransaction(null);
    setActiveTab('register');
  };

  const discardHeldCart = async (): Promise<void> => {
    if (activeHeldTransactionId) {
      const idToDelete = activeHeldTransactionId;
      await db.transactions.delete(idToDelete);
      await addToPendingQueue('transactions', 'DELETE', { id: idToDelete });
      setTransactions((prev) => prev.filter((t) => t.id !== idToDelete));
      processPendingSyncQueue();
    }
    clearCart();
  };

  const clearAllHeldTransactions = async (): Promise<void> => {
    const heldTxs = transactions.filter((t) => t.status === 'معلقة');
    for (const tx of heldTxs) {
      await db.transactions.delete(tx.id);
      await addToPendingQueue('transactions', 'DELETE', { id: tx.id });
    }
    setTransactions((prev) => prev.filter((t) => t.status !== 'معلقة'));
    if (activeHeldTransactionId) {
      setActiveHeldTransactionId(null);
      clearCart();
    }
    processPendingSyncQueue();
  };

  const deleteTransaction = async (transactionId: string) => {
    await db.transactions.delete(transactionId);
    await addToPendingQueue('transactions', 'DELETE', { id: transactionId });
    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    if (activeHeldTransactionId === transactionId) {
      setActiveHeldTransactionId(null);
      clearCart();
    }
    processPendingSyncQueue();
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    await db.transactions.put(updatedTx);
    await addToPendingQueue('transactions', 'UPDATE', updatedTx);
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
    processPendingSyncQueue();
  };

  const voidTransaction = async (transactionId: string) => {
    const targetTx = transactions.find((t) => t.id === transactionId);
    if (targetTx) {
      if (targetTx.status === 'مكتملة') {
        for (const item of targetTx.items) {
          const p = products.find((prod) => prod.id === item.productId);
          if (p) {
            const restoredProd = { ...p, stock: p.stock + item.quantity };
            await db.products.put(restoredProd);
            await addToPendingQueue('products', 'UPDATE', restoredProd);
          }
        }
        if (targetTx.customerId) {
          const cust = customers.find((c) => c.id === targetTx.customerId);
          if (cust) {
            const restoredCust = {
              ...cust,
              currentDebt: Math.max(0, (cust.currentDebt || 0) - (targetTx.amountDeferred || 0)),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - targetTx.grandTotal),
            };
            await db.customers.put(restoredCust);
            await addToPendingQueue('customers', 'UPDATE', restoredCust);
          }
        }
      }
      const voided = { ...targetTx, status: 'ملغاة' as const };
      await db.transactions.put(voided);
      await addToPendingQueue('transactions', 'UPDATE', voided);
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? voided : t)));
      processPendingSyncQueue();
    }
  };

  const returnTransaction = async (transactionId: string) => {
    const targetTx = transactions.find((t) => t.id === transactionId && t.status === 'مكتملة');
    if (!targetTx) return;

    for (const item of targetTx.items) {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        const restored = { ...p, stock: p.stock + item.quantity };
        await db.products.put(restored);
        await addToPendingQueue('products', 'UPDATE', restored);
      }
    }

    if (targetTx.customerId) {
      const cust = customers.find((c) => c.id === targetTx.customerId);
      if (cust) {
        const ratio = settings.loyaltyPointsRatio || 10;
        const addedPoints = Math.floor(targetTx.grandTotal / ratio);
        const restoredCust = {
          ...cust,
          totalSpent: Math.max(0, (cust.totalSpent || 0) - targetTx.grandTotal),
          loyaltyPoints: Math.max(0, (cust.loyaltyPoints || 0) - addedPoints),
          currentDebt: Math.max(0, (cust.currentDebt || 0) - (targetTx.amountDeferred || 0)),
        };
        await db.customers.put(restoredCust);
        await addToPendingQueue('customers', 'UPDATE', restoredCust);
      }
    }

    const updatedTx: Transaction = { ...targetTx, status: 'مسترجعة' };
    await db.transactions.put(updatedTx);
    await addToPendingQueue('transactions', 'UPDATE', updatedTx);
    setTransactions((prev) => prev.map((t) => (t.id === transactionId ? updatedTx : t)));
    processPendingSyncQueue();
  };

  const payCustomerDebt = async (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string,
    associateId?: string
  ): Promise<Transaction> => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      const updatedCust: Customer = {
        ...cust,
        currentDebt: Math.max(0, (cust.currentDebt || 0) - amount),
      };
      await db.customers.put(updatedCust);
      await addToPendingQueue('customers', 'UPDATE', updatedCust);
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust : c)));
      if (selectedCustomer?.id === customerId) setSelectedCustomer(updatedCust);
    }

    const selAssoc = associateId ? associates.find((a) => a.id === associateId) : currentAssociate;
    const primaryAssocId = selAssoc?.id || currentAssociate?.id || 'system';
    const primaryAssocName = selAssoc?.name || currentAssociate?.name || 'النظام';

    const receiptNumber = `PAY-ASM-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTransaction: Transaction = {
      id: `pay_${Date.now()}`,
      receiptNumber,
      timestamp: new Date().toISOString(),
      items: [
        {
          productId: 'debt_payment',
          productName: 'دفعة سداد مديونية (آجل)',
          sku: 'DEBT_PAY',
          quantity: 1,
          priceTier: 'cash',
          unitPrice: amount,
          totalPrice: amount,
          assignedAssociateId: primaryAssocId,
        },
      ],
      subtotal: amount,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: amount,
      paymentMethod,
      paymentDetails: `سداد جزء من مديونية الآجل: ${amount.toLocaleString()} ج.م`,
      customerId,
      customerName: cust?.name || 'عميل',
      primaryAssociateId: primaryAssocId,
      primaryAssociateName: primaryAssocName,
      commissions: [],
      notes: notes || 'سداد مديونية / قسط',
      status: 'مكتملة',
      amountPaid: amount,
      amountDeferred: 0,
    };

    await db.transactions.put(newTransaction);
    await addToPendingQueue('transactions', 'INSERT', newTransaction);
    setTransactions((prev) => [newTransaction, ...prev]);
    processPendingSyncQueue();

    return newTransaction;
  };

  const hasPermission = useCallback((perm: Permission): boolean => {
    if (!currentAssociate) return true;
    if (currentAssociate.role === 'مدير الفرع') return true;

    if (Array.isArray(currentAssociate.permissions)) {
      return currentAssociate.permissions.includes(perm);
    }

    const roleDefaults: Record<string, Permission[]> = {
      'مشرف قسم': [
        'view_cash_price', 'view_installment_price', 'view_wholesale_price', 'view_cost_price',
        'create_invoice', 'apply_discount', 'override_cart_price', 'return_invoice',
        'add_products', 'edit_products', 'manage_catalog',
        'manage_expenses', 'manage_customers', 'manage_suppliers',
      ],
      'بائع أول': [
        'view_cash_price', 'view_installment_price', 'view_wholesale_price',
        'create_invoice', 'apply_discount', 'return_invoice',
      ],
      'مسؤول مبيعات': [
        'view_cash_price', 'create_invoice',
      ],
    };

    const defaultPerms = roleDefaults[currentAssociate.role] || ['view_cash_price', 'create_invoice'];
    return defaultPerms.includes(perm);
  }, [currentAssociate]);

  const resetDemoData = async () => {
    clearCart();
    await triggerBackgroundSync();
  };

  return (
    <POSContext.Provider
      value={{
        associates,
        products,
        customers,
        transactions,
        suppliers,
        supplierTransactions,
        currentAssociate,
        cart,
        selectedCustomer,
        splitAssociates,
        activeHeldTransactionId,
        editingTransaction,
        startEditingTransaction,
        cancelEditingTransaction,
        saveEditedTransaction,
        activeTab,
        globalPriceTier,
        taxRate,
        settings,
        discounts,
        hasPermission,
        updateSettings,
        setActiveTab,
        setCurrentAssociate,
        setGlobalPriceTier,
        quickSwitchByPin,
        addToCart,
        updateCartQuantity,
        updateCartItemPriceTier,
        updateCartItemDiscount,
        updateCartItemAssociate,
        removeFromCart,
        clearCart,
        getCartItemDiscountAmount,
        getCartItemDiscountPercent,
        addDiscount,
        removeDiscount,
        setSplitAssociates,
        setSelectedCustomer,
        completeTransaction,
        updateTransaction,
        voidTransaction,
        holdCart,
        startNewInvoice,
        restoreHeldTransaction,
        deleteTransaction,
        discardHeldCart,
        clearAllHeldTransactions,
        clockInAssociate,
        clockOutAssociate,
        addAssociate,
        updateAssociate,
        deleteAssociate,
        addProduct,
        updateProduct,
        deleteProduct,
        bulkDeleteProducts,
        clearAllProducts,
        bulkUpdateProducts,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        payCustomerDebt,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        recordSupplierTransaction,
        closedShifts,
        closeShift,
        expenses,
        addExpense,
        deleteExpense,
        returnTransaction,
        syncStatus,
        lastPushTime,
        lastPullTime,
        pendingSyncCount,
        failedSyncCount,
        lastSyncError,
        isSyncDetailsOpen,
        setIsSyncDetailsOpen,
        syncSummaryResult,
        setSyncSummaryResult,
        syncNow,
        retryFailedItem,
        retryAllFailedItems,
        refreshDataFromSupabase: triggerBackgroundSync,
        syncUnsyncedItems: triggerBackgroundSync,
        resetDemoData,
        dbStatus,
        testDbConnection,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
