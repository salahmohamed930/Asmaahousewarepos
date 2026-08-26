import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Associate,
  Product,
  Customer,
  Transaction,
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
import { DEFAULT_ADMIN_ASSOCIATE } from '../data/initialData';
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
  voidTransaction: (transactionId: string) => void;
  holdCart: (notes?: string) => Promise<void>;
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
  payCustomerDebt: (customerId: string, amount: number, paymentMethod: PaymentMethod, notes?: string) => Promise<void>;

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
    };
  });

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
  const loadFromSupabase = async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    console.log('[POSContext] Loading fresh data from Supabase...');

    const errorList: string[] = [];

    // 1. Products
    const prodRes = await fetchProductsFromSupabase();
    if (!prodRes.error) {
      setProducts(prodRes.data);
    } else {
      errorList.push(`المنتجات: ${prodRes.error.message || String(prodRes.error)}`);
    }

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
  };

  useEffect(() => {
    loadFromSupabase();
  }, []);

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
    const newCustomer: Customer = {
      ...custData,
      id: `cust_${Date.now()}`,
      totalSpent: 0,
      loyaltyPoints: 50,
    };
    const res = await insertCustomerToSupabase(newCustomer);
    if (!res.success) {
      const msg = res.error?.message || 'فشلت إضافة العميل في قاعدة البيانات Supabase';
      alert(`خطأ: ${msg}`);
      throw new Error(msg);
    }
    setSelectedCustomer(newCustomer);
    await loadFromSupabase();
    return newCustomer;
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

  const completeTransaction = async (
    paymentMethod: PaymentMethod,
    discountTotalOverride = 0,
    paymentDetails = '',
    notes = '',
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ): Promise<Transaction> => {
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
    if (!selectedCustomer) {
      throw new Error('يجب اختيار عميل أولاً لتعليق الفاتورة.');
    }
    if (cart.length === 0) {
      throw new Error('سلة الشراء فارغة لا يمكن تعليقها.');
    }
    if (!currentAssociate) {
      throw new Error('يجب اختيار البائع/الكاشير المسؤول قبل تعليق الفاتورة.');
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
    const primaryAssocId = currentAssociate?.id || 'system';
    const primaryAssocName = currentAssociate?.name || 'النظام';

    const targetTxId = activeHeldTransactionId || `tx_held_${Date.now()}`;
    const receiptNumber = activeHeldTransactionId
      ? transactions.find((t) => t.id === activeHeldTransactionId)?.receiptNumber || `HLD-${Math.floor(1000 + Math.random() * 9000)}`
      : `HLD-${Math.floor(1000 + Math.random() * 9000)}`;

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
      customerName: selectedCustomer?.name,
      primaryAssociateId: primaryAssocId,
      primaryAssociateName: primaryAssocName,
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      commissions: [],
      notes: notes || 'فاتورة معلقة للعميل',
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

  const voidTransaction = async (transactionId: string) => {
    const targetTx = transactions.find((t) => t.id === transactionId);
    if (targetTx) {
      const voided = { ...targetTx, status: 'ملغاة' as const };
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
    notes?: string
  ) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      const updatedCust = {
        ...cust,
        currentDebt: Math.max(0, (cust.currentDebt || 0) - amount),
      };
      await updateCustomerInSupabase(updatedCust);
    }

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
          unitPrice: -amount,
          totalPrice: -amount,
        },
      ],
      subtotal: -amount,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: -amount,
      paymentMethod,
      paymentDetails: `سداد جزء من مديونية الآجل: ${amount.toLocaleString()} ج.م`,
      customerId,
      customerName: cust?.name || 'عميل',
      primaryAssociateId: currentAssociate?.id || 'system',
      primaryAssociateName: currentAssociate?.name || 'النظام',
      commissions: [],
      notes: notes || 'سداد مديونية',
      status: 'مكتملة',
      amountPaid: amount,
      amountDeferred: -amount,
    };

    await insertTransactionToSupabase(newTransaction);
    await loadFromSupabase();
  };

  const hasPermission = useCallback((perm: Permission): boolean => {
    if (!currentAssociate) return true;
    if (currentAssociate.role === 'مدير الفرع') return true;

    const perms = currentAssociate.permissions || [];
    if (perms.includes(perm)) return true;

    // Fallbacks for legacy permissions
    if ((perm === 'add_products' || perm === 'edit_products' || perm === 'delete_products') && perms.includes('manage_catalog')) {
      return true;
    }
    if ((perm === 'view_cash_price' || perm === 'view_installment_price' || perm === 'view_wholesale_price') && (perms.includes('create_invoice') || perms.includes('manage_catalog'))) {
      return true;
    }
    if (perm === 'return_invoice' && (perms.includes('void_invoice') || perms.includes('create_invoice'))) {
      return true;
    }
    if (perm === 'view_cost_price' && (perms.includes('view_analytics') || perms.includes('manage_catalog'))) {
      return true;
    }
    if (perm === 'manage_expenses' && (perms.includes('manage_safe') || perms.includes('view_analytics'))) {
      return true;
    }

    return false;
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
        voidTransaction,
        holdCart,
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
