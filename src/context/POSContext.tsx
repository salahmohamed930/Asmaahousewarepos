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
  checkSupabaseConnection,
  fetchProductsFromSupabase,
  insertProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  bulkDeleteProductsFromSupabase,
  clearAllProductsFromSupabase,
  fetchCustomersFromSupabase,
  insertCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  fetchSuppliersFromSupabase,
  insertSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  fetchSupplierTransactionsFromSupabase,
  insertSupplierTransactionToSupabase,
  fetchTransactionsFromSupabase,
  insertTransactionToSupabase,
  deleteTransactionFromSupabase,
  fetchAssociatesFromSupabase,
  insertAssociateToSupabase,
  updateAssociateInSupabase,
  deleteAssociateFromSupabase,
  fetchClosedShiftsFromSupabase,
  insertClosedShiftToSupabase,
  fetchExpensesFromSupabase,
  insertExpenseToSupabase,
  deleteExpenseFromSupabase,
  fetchDiscountsFromSupabase,
  insertDiscountToSupabase,
  deleteDiscountFromSupabase,
  syncProductToSupabase,
  syncCustomerToSupabase,
  syncSupplierToSupabase,
  syncAssociateToSupabase,
  syncSupplierTransactionToSupabase,
  syncExpenseToSupabase,
  syncClosedShiftToSupabase,
  syncTransactionToSupabase,
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

  refreshDataFromSupabase: () => Promise<void>;
  syncUnsyncedItems: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  dbStatus: { isConnected: boolean; isChecking: boolean; errorMessage?: string; isCustom: boolean };
  testDbConnection: () => Promise<{ success: boolean; errorMessage?: string }>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'asmaa_pos_state_ar_v3';

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pure Supabase State - Initialized empty without localStorage caches
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closedShifts, setClosedShifts] = useState<ClosedShift[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [expenses, setExpenses] = useState<POSExpense[]>([]);
  const [discounts, setDiscounts] = useState<ProductDiscount[]>([]);

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
    isConnected: false,
    isChecking: true,
    isCustom: false,
  });

  // Local Settings (Theme, Printer, Margins)
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
      } catch (e) {
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

  // Global Function Key Shortcuts Listener (F1 - F12)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Intercept Function Keys F1 through F12
      if (!e.key || !/^F(1[0-2]|[1-9])$/.test(e.key)) return;

      const activeShortcuts = { ...DEFAULT_SHORTCUT_KEYS, ...(settings.shortcutKeys || {}) };
      const actionId = activeShortcuts[e.key];

      if (!actionId || actionId === 'none') return;

      // Stop browser default action (F1 help, F3 find, F5 reload, F11 fullscreen, F12 devtools)
      e.preventDefault();
      e.stopPropagation();

      console.log(`[POS Shortcuts] Key ${e.key} triggered action: ${actionId}`);

      // Handle Direct Navigation and State actions
      if (actionId === 'open_new_invoice') {
        startNewInvoice('فتح فاتورة جديدة عبر اختصار لوحة المفاتيح').then(() => {
          window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
        }).catch((err) => {
          console.error('Error starting new invoice shortcut:', err);
        });
      } else if (actionId === 'open_register') {
        setActiveTab('register');
      } else if (actionId === 'open_catalog') {
        setActiveTab('catalog');
      } else if (actionId === 'open_customers') {
        setActiveTab('customers');
      } else if (actionId === 'open_suppliers') {
        setActiveTab('suppliers');
      } else if (actionId === 'open_analytics') {
        setActiveTab('analytics');
      } else if (actionId === 'open_discounts') {
        setActiveTab('discounts');
      } else if (actionId === 'open_associates') {
        setActiveTab('associates');
      } else if (actionId === 'open_settings') {
        setActiveTab('settings');
      } else if (actionId === 'clear_cart') {
        if (cart.length > 0) {
          if (window.confirm('هل أنت متأكد من تفريغ سلة المبيعات بالكامل؟')) {
            setCart([]);
          }
        }
      } else if (actionId === 'checkout_payment') {
        setActiveTab('register');
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      } else if (actionId === 'add_expense') {
        setActiveTab('register');
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      } else if (actionId === 'pay_installment') {
        setActiveTab('customers');
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      } else if (actionId === 'focus_search') {
        setActiveTab('register');
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      } else {
        window.dispatchEvent(new CustomEvent('pos-shortcut-action', { detail: { action: actionId, key: e.key } }));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [settings.shortcutKeys, cart.length, setActiveTab, setCart]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_settings`, JSON.stringify(settings));
    if (settings.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [settings]);

  // Clear legacy business data from localStorage to prevent any stale cache pollution
  useEffect(() => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_products`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_customers`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_transactions`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_suppliers`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_supplier_txs`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_closed_shifts`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_expenses`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_associates`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_discounts`);
  }, []);

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
    setSettings((prev) => {
      const resolved = typeof newSettings === 'function' ? newSettings(prev) : { ...prev, ...newSettings };
      return resolved;
    });
  };

  // --- REFRESH DATA FROM SUPABASE (SSOT) ---
  const loadFromSupabase = useCallback(async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    console.log('[POSContext] Loading fresh data from Supabase...');

    const errorList: string[] = [];

    // 1. Products (Lazy server-side queries on demand via products.service.ts)
    // No bulk fetching of all products into memory on app startup

    // 2. Customers
    const custRes = await fetchCustomersFromSupabase();
    if (!custRes.error) {
      setCustomers(custRes.data);
    } else {
      errorList.push(`العملاء: ${custRes.error.message || String(custRes.error)}`);
    }

    // 3. Suppliers
    const suppRes = await fetchSuppliersFromSupabase();
    if (!suppRes.error) {
      setSuppliers(suppRes.data);
    } else {
      errorList.push(`الموردين: ${suppRes.error.message || String(suppRes.error)}`);
    }

    // 4. Supplier Transactions
    const stxRes = await fetchSupplierTransactionsFromSupabase();
    if (!stxRes.error) {
      setSupplierTransactions(stxRes.data);
    } else {
      errorList.push(`حركات الموردين: ${stxRes.error.message || String(stxRes.error)}`);
    }

    // 5. Transactions
    const txRes = await fetchTransactionsFromSupabase();
    if (!txRes.error) {
      setTransactions(txRes.data);
    } else {
      errorList.push(`المبيعات: ${txRes.error.message || String(txRes.error)}`);
    }

    // 6. Closed Shifts
    const shiftRes = await fetchClosedShiftsFromSupabase();
    if (!shiftRes.error) {
      setClosedShifts(shiftRes.data);
    } else {
      errorList.push(`الورديات المغلقة: ${shiftRes.error.message || String(shiftRes.error)}`);
    }

    // 7. Expenses
    const expRes = await fetchExpensesFromSupabase();
    if (!expRes.error) {
      setExpenses(expRes.data);
    } else {
      errorList.push(`المصروفات: ${expRes.error.message || String(expRes.error)}`);
    }

    // 8. Discounts
    const discRes = await fetchDiscountsFromSupabase();
    if (!discRes.error) {
      setDiscounts(discRes.data);
    } else {
      errorList.push(`الخصومات: ${discRes.error.message || String(discRes.error)}`);
    }

    // 9. Associates
    const assocRes = await fetchAssociatesFromSupabase();
    if (!assocRes.error) {
      let fetchedAssociates = assocRes.data;

      // Seed default admin in Supabase ONLY IF query succeeded AND table has 0 rows
      if (fetchedAssociates.length === 0) {
        console.log('[POSContext] Associates table is empty in Supabase. Seeding default admin...');
        const insertRes = await insertAssociateToSupabase(DEFAULT_ADMIN_ASSOCIATE);
        if (insertRes.success) {
          const reFetchAssoc = await fetchAssociatesFromSupabase();
          if (!reFetchAssoc.error) {
            fetchedAssociates = reFetchAssoc.data;
          }
        }
      }

      setAssociates(fetchedAssociates);

      // Maintain current logged-in associate reference if still exists
      if (currentAssociate) {
        const updatedMatch = fetchedAssociates.find((a) => a.id === currentAssociate.id);
        if (updatedMatch) {
          setCurrentAssociateState(updatedMatch);
        }
      }
    } else {
      errorList.push(`الموظفين: ${assocRes.error.message || String(assocRes.error)}`);
    }

    const hasErrors = errorList.length > 0;

    setDbStatus({
      isConnected: !hasErrors,
      isChecking: false,
      errorMessage: hasErrors ? errorList.join(' | ') : undefined,
      isCustom: getSupabaseKeys().isCustom,
    });
  }, [currentAssociate]);

  // Re-fetch data automatically whenever the active tab / page changes
  useEffect(() => {
    loadFromSupabase();
  }, [activeTab, loadFromSupabase]);

  // Auto-refresh when window or browser tab gains focus / visibility
  useEffect(() => {
    let lastFetched = Date.now();

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetched > 3000) {
        lastFetched = Date.now();
        console.log('[POSContext] Auto refreshing data on window focus / tab visibility...');
        loadFromSupabase();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [loadFromSupabase]);

  const syncUnsyncedItems = async () => {
    await loadFromSupabase();
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
          alert(
            `خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`
          );
          return prevCart;
        }
        updated[existingIndex].quantity = newQty;
        updated[existingIndex].selectedPriceTier = tier;
        return updated;
      }
      if (quantity > product.stock) {
        alert(
          `خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`
        );
        return prevCart;
      }
      return [
        ...prevCart,
        {
          product,
          quantity,
          selectedPriceTier: tier,
          discountPercent: 0,
        },
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
      alert(
        `خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`
      );
      return;
    }
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)));
  };

  const updateCartItemPriceTier = (productId: string, priceTier: PriceTier) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, selectedPriceTier: priceTier } : item))
    );
  };

  const updateCartItemDiscount = (productId: string, discountPercent: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discountPercent: Math.min(100, Math.max(0, discountPercent)) }
          : item
      )
    );
  };

  const updateCartItemAssociate = (productId: string, associateId?: string) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, assignedAssociateId: associateId } : item))
    );
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
      const appliesToInstallment =
        !adminDiscount.applyTo || adminDiscount.applyTo === 'installment' || adminDiscount.applyTo === 'both';

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
    const res = await insertDiscountToSupabase(discount);
    if (!res.success) {
      alert(`خطأ في حفظ الخصم: ${res.error?.message || ''}`);
    }
    await loadFromSupabase();
  };

  const removeDiscount = async (productId: string) => {
    const res = await deleteDiscountFromSupabase(productId);
    if (!res.success) {
      alert(`خطأ في حذف الخصم: ${res.error?.message || ''}`);
    }
    await loadFromSupabase();
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

  // --- CRUD OPERATIONS WITH SUPABASE (SSOT) ---

  const addProduct = async (prodData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...prodData,
      id: prodData.sku || prodData.barcode || `prod_${Date.now()}`,
    };
    const res = await insertProductToSupabase(newProduct);
    if (!res.success) {
      const msg = res.error?.message || 'فشلت إضافة الصنف في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const updateProduct = async (prod: Product) => {
    const res = await updateProductInSupabase(prod);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تحديث بيانات الصنف في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const deleteProduct = async (productId: string) => {
    const res = await deleteProductFromSupabase(productId);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف الصنف من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const bulkDeleteProducts = async (productIds: string[]) => {
    const res = await bulkDeleteProductsFromSupabase(productIds);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف الاصناف المحددة من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const clearAllProducts = async () => {
    const res = await clearAllProductsFromSupabase();
    if (!res.success) {
      const msg = res.error?.message || 'فشل تفريغ الاصناف من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const bulkUpdateProducts = async (productIds: string[], updates: Partial<Product>) => {
    for (const id of productIds) {
      const p = products.find((prod) => prod.id === id);
      if (p) {
        await updateProductInSupabase({ ...p, ...updates });
      }
    }
    await loadFromSupabase();
  };

  const addCustomer = async (custData: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>): Promise<Customer> => {
    const numId = String(Math.floor(Date.now() % 1000000000) + Math.floor(Math.random() * 1000));
    const newCustomer: Customer = {
      ...custData,
      id: numId,
      totalSpent: 0,
      loyaltyPoints: 50,
    };
    const res = await insertCustomerToSupabase(newCustomer);
    if (!res.success) {
      const msg = res.error?.message || 'فشلت إضافة العميل في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    const savedCustomer = res.data || newCustomer;
    setSelectedCustomer(savedCustomer);
    await loadFromSupabase();
    return savedCustomer;
  };

  const updateCustomer = async (cust: Customer) => {
    const res = await updateCustomerInSupabase(cust);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تحديث بيانات العميل في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (selectedCustomer?.id === cust.id) {
      setSelectedCustomer(cust);
    }
    await loadFromSupabase();
  };

  const deleteCustomer = async (customerId: string) => {
    const res = await deleteCustomerFromSupabase(customerId);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف العميل من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(null);
    }
    await loadFromSupabase();
  };

  const addSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `supp_${Date.now()}`,
      currentBalance: supplierData.currentBalance || 0,
    };
    const res = await insertSupplierToSupabase(newSupplier);
    if (!res.success) {
      const msg = res.error?.message || 'فشلت إضافة المورد في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
    return newSupplier;
  };

  const updateSupplier = async (supplier: Supplier) => {
    const res = await updateSupplierInSupabase(supplier);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تحديث بيانات المورد في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const deleteSupplier = async (supplierId: string) => {
    const res = await deleteSupplierFromSupabase(supplierId);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف المورد من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const recordSupplierTransaction = async (txData: Omit<SupplierTransaction, 'id' | 'date'>) => {
    const newTx: SupplierTransaction = {
      ...txData,
      id: `stx_${Date.now()}`,
      date: new Date().toISOString(),
    };
    const res = await insertSupplierTransactionToSupabase(newTx);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تسجيل معاملة المورد في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }

    const targetSupplier = suppliers.find((s) => s.id === txData.supplierId);
    if (targetSupplier) {
      let delta = 0;
      if (txData.type === 'supply_invoice') delta = txData.amount;
      else if (txData.type === 'payment' || txData.type === 'return') delta = -txData.amount;

      const updatedSupplier = {
        ...targetSupplier,
        currentBalance: Math.max(0, (targetSupplier.currentBalance || 0) + delta),
      };
      await updateSupplierInSupabase(updatedSupplier);
    }

    await loadFromSupabase();
  };

  const addExpense = async (expenseData: Omit<POSExpense, 'id' | 'timestamp'>) => {
    const newExpense: POSExpense = {
      ...expenseData,
      id: `expense_${Date.now()}`,
      timestamp: new Date().toISOString(),
      associateId: currentAssociate?.id || undefined,
      associateName: currentAssociate?.name || undefined,
    };
    const res = await insertExpenseToSupabase(newExpense);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تسجيل المصروف في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }

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
        await updateAssociateInSupabase({
          ...targetAssoc,
          advancesBalance: (targetAssoc.advancesBalance || 0) + expenseData.amount,
        });
      }
    }

    await loadFromSupabase();
  };

  const deleteExpense = async (id: string) => {
    const res = await deleteExpenseFromSupabase(id);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف المصروف من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
  };

  const clockInAssociate = async (associateId: string) => {
    const target = associates.find((a) => a.id === associateId);
    if (target) {
      const updated = { ...target, isClockedIn: true, clockInTime: new Date().toISOString() };
      await updateAssociateInSupabase(updated);
      await loadFromSupabase();
    }
  };

  const clockOutAssociate = async (associateId: string) => {
    const target = associates.find((a) => a.id === associateId);
    if (target) {
      const updated = { ...target, isClockedIn: false, clockInTime: undefined };
      await updateAssociateInSupabase(updated);
      await loadFromSupabase();
    }
  };

  const addAssociate = async (assocData: Omit<Associate, 'id' | 'isClockedIn'>) => {
    const newAssoc: Associate = {
      ...assocData,
      id: `assoc_${Date.now()}`,
      isClockedIn: true,
      clockInTime: new Date().toISOString(),
    };
    const res = await insertAssociateToSupabase(newAssoc);
    if (!res.success) {
      const msg = res.error?.message || 'فشلت إضافة الموظف في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (!currentAssociate) {
      setCurrentAssociateState(newAssoc);
    }
    await loadFromSupabase();
  };

  const updateAssociate = async (assoc: Associate) => {
    const res = await updateAssociateInSupabase(assoc);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تحديث بيانات الموظف في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (currentAssociate?.id === assoc.id) {
      setCurrentAssociateState(assoc);
    }
    await loadFromSupabase();
  };

  const deleteAssociate = async (associateId: string) => {
    const res = await deleteAssociateFromSupabase(associateId);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف الموظف من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (currentAssociate?.id === associateId) {
      setCurrentAssociateState(null);
    }
    await loadFromSupabase();
  };

  const closeShift = async (shiftData: Omit<ClosedShift, 'id'>) => {
    const newShift: ClosedShift = {
      ...shiftData,
      id: `shift_${Date.now()}`,
    };
    const res = await insertClosedShiftToSupabase(newShift);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تسجيل إغلاق الوردية في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    await loadFromSupabase();
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

    if (tx.splitAssociates) {
      setSplitAssociates(tx.splitAssociates);
    } else {
      setSplitAssociates([]);
    }

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

    if (discountTotalOverride > 0) {
      discountTotal = discountTotalOverride;
    }

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
    if (editingTransaction) {
      return await saveEditedTransaction(
        paymentMethod,
        discountTotalOverride,
        paymentDetails,
        notes,
        amountPaid,
        amountDeferred,
        splitPayments
      );
    }

    if (!currentAssociate) {
      throw new Error('رجاءً اختر البائع المسؤول قبل إتمام البيع.');
    }

    if (cart.length === 0) {
      throw new Error('سلة الشراء فارغة.');
    }

    let subtotal = 0;
    let discountTotal = 0;
    const isReturn = cart.some((item) => item.quantity < 0);

    const transactionItems = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = getCartItemDiscountAmount(item);
      const lineNetTotal = item.quantity < 0 ? lineOriginalTotal : Math.max(0, lineOriginalTotal - lineDiscount);

      subtotal += lineOriginalTotal;
      discountTotal += lineDiscount;

      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        priceTier: item.selectedPriceTier || globalPriceTier,
        unitPrice,
        totalPrice: lineNetTotal,
        discountAmount: lineDiscount,
        discountPercent: item.discountPercent || 0,
        assignedAssociateId: item.assignedAssociateId,
      };
    });

    if (discountTotalOverride > 0) {
      discountTotal += discountTotalOverride;
    }

    const grandTotal = isReturn ? subtotal - discountTotal : Math.max(0, subtotal - discountTotal);

    let generalNetSubtotal = 0;
    const associateSalesMap: Record<string, number> = {};

    cart.forEach((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = getCartItemDiscountAmount(item);
      const lineNetTotal = item.quantity < 0 ? lineOriginalTotal : Math.max(0, lineOriginalTotal - lineDiscount);

      if (item.assignedAssociateId) {
        associateSalesMap[item.assignedAssociateId] =
          (associateSalesMap[item.assignedAssociateId] || 0) + lineNetTotal;
      } else {
        generalNetSubtotal += lineNetTotal;
      }
    });

    const primaryAssocId = currentAssociate?.id || 'system';
    const primaryAssocName = currentAssociate?.name || 'النظام';

    if (generalNetSubtotal !== 0) {
      if (splitAssociates.length > 0) {
        const totalSplitPercent = splitAssociates.reduce((acc, s) => acc + s.sharePercentage, 0);
        const primarySharePercent = Math.max(0, 100 - totalSplitPercent);

        if (primarySharePercent > 0) {
          associateSalesMap[primaryAssocId] =
            (associateSalesMap[primaryAssocId] || 0) + (generalNetSubtotal * primarySharePercent) / 100;
        }

        splitAssociates.forEach((split) => {
          associateSalesMap[split.associateId] =
            (associateSalesMap[split.associateId] || 0) + (generalNetSubtotal * split.sharePercentage) / 100;
        });
      } else {
        associateSalesMap[primaryAssocId] = (associateSalesMap[primaryAssocId] || 0) + generalNetSubtotal;
      }
    }

    const commissions: TransactionCommission[] = Object.entries(associateSalesMap).map(([assocId, saleAmt]) => {
      const assoc = associates.find((a) => a.id === assocId);
      const rate = assoc ? assoc.commissionRate : 0.05;
      const commissionAmount = Math.round(saleAmt * rate * 100) / 100;
      const sharePercent = Math.abs(grandTotal) > 0 ? Math.round((saleAmt / grandTotal) * 100) : 0;

      return {
        associateId: assocId,
        associateName: assoc ? assoc.name : 'بائع',
        saleAmount: Math.round(saleAmt * 100) / 100,
        commissionAmount,
        sharePercentage: sharePercent,
      };
    });

    const targetTxId = activeHeldTransactionId || `tx_${Date.now()}`;
    let receiptNumber = `RCP-ASM-${Math.floor(10000 + Math.random() * 90000)}`;

    if (activeHeldTransactionId) {
      const existingHeld = transactions.find((t) => t.id === activeHeldTransactionId);
      if (existingHeld?.receiptNumber) {
        if (existingHeld.receiptNumber.startsWith('HLD-')) {
          receiptNumber = existingHeld.receiptNumber.replace('HLD-', 'RCP-ASM-');
        } else {
          receiptNumber = existingHeld.receiptNumber;
        }
      }
    }

    const newTransaction: Transaction = {
      id: targetTxId,
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
      status: isReturn ? 'مسترجعة' : 'مكتملة',
      amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
      amountDeferred: amountDeferred !== undefined ? amountDeferred : 0,
      splitPayments: splitPayments && splitPayments.length > 0 ? splitPayments : undefined,
    };

    // 1. Insert transaction into Supabase
    const txRes = await insertTransactionToSupabase(newTransaction);
    if (!txRes.success) {
      const msg = txRes.error?.message || 'فشل حفظ الفاتورة في قاعدة البيانات Supabase';
      alert(`خطأ في حفظ البيع: ${msg}`);
      throw new Error(msg);
    }

    // 2. Update product stock in Supabase
    for (const ci of cart) {
      const p = products.find((prod) => prod.id === ci.product.id);
      if (p) {
        const updatedStock = Math.max(0, p.stock - ci.quantity);
        await updateProductInSupabase({ ...p, stock: updatedStock });
      }
    }

    // 3. Update customer stats in Supabase
    if (selectedCustomer) {
      const ratio = settings.loyaltyPointsRatio || 10;
      const addedPoints = Math.floor(grandTotal / ratio);
      let pointsUsed = 0;
      const pointVal = settings.loyaltyPointValue || 0.1;
      if (paymentMethod === 'نقاط ولاء') {
        pointsUsed = Math.ceil(grandTotal / pointVal);
      } else if (paymentMethod === 'دفع متعدد' && splitPayments) {
        const ptsPay = splitPayments.find((sp) => sp.method === 'نقاط ولاء');
        if (ptsPay) {
          pointsUsed = Math.ceil(ptsPay.amount / pointVal);
        }
      }
      const currentDebtVal = selectedCustomer.currentDebt || 0;
      const newDebt = currentDebtVal + (amountDeferred || 0);
      const updatedCust = {
        ...selectedCustomer,
        totalSpent: selectedCustomer.totalSpent + grandTotal,
        loyaltyPoints: Math.max(0, selectedCustomer.loyaltyPoints + addedPoints - pointsUsed),
        currentDebt: newDebt,
      };
      await updateCustomerInSupabase(updatedCust);
    }

    clearCart();
    await loadFromSupabase();
    return newTransaction;
  };

  const holdCart = async (notes = '') => {
    if (cart.length === 0) {
      throw new Error('سلة الشراء فارغة لا يمكن تعليقها.');
    }

    let subtotal = 0;
    let discountTotal = 0;

    const transactionItems = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = getCartItemDiscountAmount(item);
      const lineNetTotal = Math.max(0, lineOriginalTotal - lineDiscount);

      subtotal += lineOriginalTotal;
      discountTotal += lineDiscount;

      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        priceTier: item.selectedPriceTier || globalPriceTier,
        unitPrice,
        totalPrice: lineNetTotal,
        discountAmount: lineDiscount,
        discountPercent: item.discountPercent || 0,
        assignedAssociateId: item.assignedAssociateId,
      };
    });

    const grandTotal = Math.max(0, subtotal - discountTotal);
    const primaryAssocId = currentAssociate?.id || associates[0]?.id || 'system';
    const primaryAssocName = currentAssociate?.name || associates[0]?.name || 'النظام';

    const targetTxId = activeHeldTransactionId || `tx_held_${Date.now()}`;
    const receiptNumber = activeHeldTransactionId
      ? transactions.find((t) => t.id === activeHeldTransactionId)?.receiptNumber || `HLD-${Math.floor(1000 + Math.random() * 9000)}`
      : `HLD-${Math.floor(1000 + Math.random() * 9000)}`;

    const custName = selectedCustomer?.name || 'عميل نقدي';

    const heldTx: Transaction = {
      id: targetTxId,
      receiptNumber,
      timestamp: new Date().toISOString(),
      items: transactionItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paymentMethod: 'كاش',
      customerId: selectedCustomer?.id,
      customerName: custName,
      primaryAssociateId: primaryAssocId,
      primaryAssociateName: primaryAssocName,
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      commissions: [],
      notes: notes || `فاتورة معلقة لـ ${custName}`,
      status: 'معلقة',
      originalCart: JSON.parse(JSON.stringify(cart)),
    };

    const res = await insertTransactionToSupabase(heldTx);
    if (!res.success) {
      const msg = res.error?.message || 'فشل تعليق الفاتورة في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }

    clearCart();
    await loadFromSupabase();
    return heldTx;
  };

  const startNewInvoice = async (notes = '') => {
    if (cart.length > 0) {
      const custName = selectedCustomer?.name || 'عميل نقدي';
      await holdCart(notes || `فاتورة معلقة تلقائياً (فتح فاتورة جديدة لـ ${custName})`);
    } else {
      clearCart();
    }
    setActiveTab('register');
  };

  const restoreHeldTransaction = (transactionId: string) => {
    const foundTx = transactions.find((t) => t.id === transactionId && t.status === 'معلقة');
    if (!foundTx) {
      throw new Error('لم يتم العثور على الفاتورة المعلقة المطلوبة.');
    }

    if (foundTx.originalCart && foundTx.originalCart.length > 0) {
      setCart(foundTx.originalCart);
    } else {
      const reconstructed: CartItem[] = foundTx.items.map((item) => {
        const prod = products.find((p) => p.id === item.productId) || {
          id: item.productId,
          name: item.productName,
          sku: item.sku,
          barcode: '',
          category: 'عام',
          priceCash: item.unitPrice,
          priceInstallment: item.unitPrice,
          priceWholesale: item.unitPrice,
          cost: item.unitPrice,
          stock: 99,
          image: '',
        };
        return {
          product: prod,
          quantity: item.quantity,
          selectedPriceTier: item.priceTier,
          discountPercent: 0,
          assignedAssociateId: item.assignedAssociateId,
        };
      });
      setCart(reconstructed);
    }

    if (foundTx.customerId) {
      const cust = customers.find((c) => c.id === foundTx.customerId);
      if (cust) {
        setSelectedCustomer(cust);
      } else {
        setSelectedCustomer({
          id: foundTx.customerId,
          name: foundTx.customerName || 'عميل معلق',
          phone: '',
          email: '',
          loyaltyPoints: 0,
          totalSpent: 0,
        });
      }
    } else if (foundTx.customerName) {
      setSelectedCustomer({
        id: `temp_${Date.now()}`,
        name: foundTx.customerName,
        phone: '',
        email: '',
        loyaltyPoints: 0,
        totalSpent: 0,
      });
    }

    if (foundTx.splitAssociates) {
      setSplitAssociates(foundTx.splitAssociates);
    } else {
      setSplitAssociates([]);
    }

    setActiveHeldTransactionId(transactionId);
    setActiveTab('register');
  };

  const deleteTransaction = async (transactionId: string) => {
    const res = await deleteTransactionFromSupabase(transactionId);
    if (!res.success) {
      const msg = res.error?.message || 'فشل حذف الفاتورة من قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    if (activeHeldTransactionId === transactionId) {
      setActiveHeldTransactionId(null);
    }
    await loadFromSupabase();
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    // Immediately update local state in React memory
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));

    // Adjust product stock and customer balance if applicable
    const existingTx = transactions.find((t) => t.id === updatedTx.id);
    if (existingTx && existingTx.status === 'مكتملة' && updatedTx.status === 'مكتملة') {
      // Revert stock from old items
      for (const item of existingTx.items) {
        const p = products.find((prod) => prod.id === item.productId);
        if (p) {
          await updateProductInSupabase({ ...p, stock: p.stock + item.quantity });
        }
      }
      // Apply stock from new items
      for (const item of updatedTx.items) {
        const p = products.find((prod) => prod.id === item.productId);
        if (p) {
          const baseStock = p.stock + (existingTx.items.find((i) => i.productId === item.productId)?.quantity || 0);
          await updateProductInSupabase({ ...p, stock: Math.max(0, baseStock - item.quantity) });
        }
      }

      // Customer debt adjustment
      if (existingTx.customerId || updatedTx.customerId) {
        if (existingTx.customerId) {
          const oldCust = customers.find((c) => c.id === existingTx.customerId);
          if (oldCust) {
            const revertedDebt = Math.max(0, (oldCust.currentDebt || 0) - (existingTx.amountDeferred || 0));
            const revertedSpent = Math.max(0, (oldCust.totalSpent || 0) - existingTx.grandTotal);
            await updateCustomerInSupabase({ ...oldCust, currentDebt: revertedDebt, totalSpent: revertedSpent });
          }
        }
        if (updatedTx.customerId) {
          const newCust = customers.find((c) => c.id === updatedTx.customerId);
          if (newCust) {
            const addedDebt = (newCust.currentDebt || 0) + (updatedTx.amountDeferred || 0);
            const addedSpent = (newCust.totalSpent || 0) + updatedTx.grandTotal;
            await updateCustomerInSupabase({ ...newCust, currentDebt: addedDebt, totalSpent: addedSpent });
          }
        }
      }
    }

    const res = await insertTransactionToSupabase(updatedTx);
    if (!res.success) {
      console.error('[POSContext] insertTransactionToSupabase error:', res.error);
      throw new Error(res.error?.message || 'فشل حفظ التعديلات في قاعدة البيانات');
    }
    await loadFromSupabase();
  };

  const voidTransaction = async (transactionId: string) => {
    const targetTx = transactions.find((t) => t.id === transactionId);
    if (targetTx) {
      if (targetTx.status === 'مكتملة') {
        for (const item of targetTx.items) {
          const p = products.find((prod) => prod.id === item.productId);
          if (p) {
            await updateProductInSupabase({ ...p, stock: p.stock + item.quantity });
          }
        }
        if (targetTx.customerId) {
          const cust = customers.find((c) => c.id === targetTx.customerId);
          if (cust) {
            const newDebt = Math.max(0, (cust.currentDebt || 0) - (targetTx.amountDeferred || 0));
            const newSpent = Math.max(0, (cust.totalSpent || 0) - targetTx.grandTotal);
            await updateCustomerInSupabase({ ...cust, currentDebt: newDebt, totalSpent: newSpent });
          }
        }
      }
      const voided = { ...targetTx, status: 'ملغاة' as const };
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? voided : t)));
      await insertTransactionToSupabase(voided);
      await loadFromSupabase();
    }
  };

  const returnTransaction = async (transactionId: string) => {
    const targetTx = transactions.find((t) => t.id === transactionId && t.status === 'مكتملة');
    if (!targetTx) return;

    // 1. Revert product stock in Supabase
    for (const item of targetTx.items) {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        await updateProductInSupabase({ ...p, stock: p.stock + item.quantity });
      }
    }

    // 2. Revert customer balance in Supabase
    if (targetTx.customerId) {
      const cust = customers.find((c) => c.id === targetTx.customerId);
      if (cust) {
        const ratio = settings.loyaltyPointsRatio || 10;
        const addedPoints = Math.floor(targetTx.grandTotal / ratio);
        const newDebt = Math.max(0, (cust.currentDebt || 0) - (targetTx.amountDeferred || 0));
        const newSpent = Math.max(0, (cust.totalSpent || 0) - targetTx.grandTotal);
        const newPoints = Math.max(0, (cust.loyaltyPoints || 0) - addedPoints);
        await updateCustomerInSupabase({
          ...cust,
          totalSpent: newSpent,
          loyaltyPoints: newPoints,
          currentDebt: newDebt,
        });
      }
    }

    // 3. Update transaction status
    const updatedTx: Transaction = { ...targetTx, status: 'مسترجعة' };
    await insertTransactionToSupabase(updatedTx);
    await loadFromSupabase();
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
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
      await updateCustomerInSupabase(updatedCust);
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

    await insertTransactionToSupabase(newTransaction);
    await loadFromSupabase();
    return newTransaction;
  };

  const hasPermission = useCallback((perm: Permission): boolean => {
    if (!currentAssociate) return true;
    if (currentAssociate.role === 'مدير الفرع') return true;

    if (Array.isArray(currentAssociate.permissions)) {
      return currentAssociate.permissions.includes(perm);
    }

    // Role-based defaults if permissions array is uninitialized
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
    await loadFromSupabase();
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
        refreshDataFromSupabase: loadFromSupabase,
        syncUnsyncedItems,
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
