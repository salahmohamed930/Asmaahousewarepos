import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types';
import {
  INITIAL_ASSOCIATES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_TRANSACTIONS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_TRANSACTIONS,
} from '../data/initialData';
import {
  syncProductToSupabase,
  syncTransactionToSupabase,
  syncCustomerToSupabase,
  syncAssociateToSupabase,
  syncClosedShiftToSupabase,
  syncSupplierToSupabase,
  syncSupplierTransactionToSupabase,
  syncExpenseToSupabase,
  checkSupabaseConnection,
} from '../lib/supabaseSync';
import { supabase, updateSupabaseClient, getSupabaseKeys } from '../lib/supabase';


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
  activeTab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'suppliers' | 'settings' | 'discounts';
  globalPriceTier: PriceTier; // 'cash' | 'installment' | 'wholesale'
  taxRate: number;
  settings: AppSettings;
  discounts: ProductDiscount[];
  
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
  addDiscount: (discount: ProductDiscount) => void;
  removeDiscount: (productId: string) => void;
  
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
  ) => Transaction;
  voidTransaction: (transactionId: string) => void;
  holdCart: (notes?: string) => void;
  restoreHeldTransaction: (transactionId: string) => void;
  deleteTransaction: (transactionId: string) => void;
  
  // Staff & Shift Management
  clockInAssociate: (associateId: string) => void;
  clockOutAssociate: (associateId: string) => void;
  addAssociate: (assoc: Omit<Associate, 'id' | 'isClockedIn'>) => void;
  updateAssociate: (assoc: Associate) => void;
  
  // Catalog & Customer Management
  addProduct: (prod: Omit<Product, 'id'>) => void;
  updateProduct: (prod: Product) => void;
  bulkUpdateProducts: (productIds: string[], updates: Partial<Product>) => void;
  addCustomer: (cust: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>) => Customer;
  updateCustomer: (cust: Customer) => void;
  payCustomerDebt: (customerId: string, amount: number, paymentMethod: PaymentMethod, notes?: string) => void;
  
  // Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (supplierId: string) => void;
  recordSupplierTransaction: (tx: Omit<SupplierTransaction, 'id' | 'date'>) => void;

  // Shift Closure Actions
  closedShifts: ClosedShift[];
  closeShift: (shift: Omit<ClosedShift, 'id'>) => void;
  
  // Expenses & Return Invoice Actions
  expenses: POSExpense[];
  addExpense: (expense: Omit<POSExpense, 'id' | 'timestamp'>) => void;
  deleteExpense: (id: string) => void;
  returnTransaction: (transactionId: string) => void;
  
  refreshDataFromSupabase: () => Promise<void>;
  syncUnsyncedItems: () => Promise<void>;
  resetDemoData: () => void;
  dbStatus: { isConnected: boolean; isChecking: boolean; errorMessage?: string; isCustom: boolean };
  testDbConnection: () => Promise<{ success: boolean; errorMessage?: string }>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'asmaa_pos_state_ar_v3';

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [associates, setAssociates] = useState<Associate[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_associates`);
    return saved ? JSON.parse(saved) : INITIAL_ASSOCIATES;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_products`);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_customers`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [closedShifts, setClosedShifts] = useState<ClosedShift[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_closed_shifts`);
    return saved ? JSON.parse(saved) : [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_suppliers`);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_supplier_txs`);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIER_TRANSACTIONS;
  });

  const [currentAssociate, setCurrentAssociateState] = useState<Associate | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [splitAssociates, setSplitAssociates] = useState<SplitAssociate[]>([]);
  const [globalPriceTier, setGlobalPriceTierState] = useState<PriceTier>('cash');
  const [taxRate] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'suppliers' | 'settings' | 'discounts'
  >('register');

  const [discounts, setDiscounts] = useState<ProductDiscount[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_discounts`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_discounts`, JSON.stringify(discounts));
  }, [discounts]);

  const [expenses, setExpenses] = useState<POSExpense[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_expenses`, JSON.stringify(expenses));
  }, [expenses]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    const defaultCats = [
      'أطقم طهي وحلل',
      'أدوات مائدة وتوزيع',
      'أجهزة كهربائية منزلية',
      'بلاستيكيات ومنظمات',
      'زجاجيات وبورسلين',
      'أدوات تنظيف ومستلزمات'
    ];
    const defaultMargins = {
      default: { cash: 20, wholesale: 10, installment: 30 },
      categories: {
        'أطقم طهي وحلل': { cash: 25, wholesale: 15, installment: 35 },
        'أجهزة كهربائية منزلية': { cash: 15, wholesale: 8, installment: 25 }
      }
    };
    const defaultPrint = {
      headerText: 'محلات أسماء للأدوات المنزلية',
      footerText: 'شكراً لزيارتكم! الفاتورة قابلة للاستبدال خلال 14 يوماً من تاريخ الشراء بوجود أصل الفاتورة.',
      showSellerCode: true,
      showQRCode: true,
      showLogo: true,
      receiptType: 'thermal' as const
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

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_associates`, JSON.stringify(associates));
  }, [associates]);

  const [dbStatus, setDbStatus] = useState<{
    isConnected: boolean;
    isChecking: boolean;
    errorMessage?: string;
    isCustom: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
      const parsed = saved ? JSON.parse(saved) : null;
      return {
        isConnected: false,
        isChecking: true,
        isCustom: !!(parsed?.supabaseUrl && parsed?.supabaseAnonKey),
      };
    } catch {
      return { isConnected: false, isChecking: true, isCustom: false };
    }
  });

  const testDbConnection = async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    const result = await checkSupabaseConnection();
    setDbStatus((p) => ({
      ...p,
      isConnected: result.success,
      isChecking: false,
      errorMessage: result.errorMessage,
    }));
    return result;
  };

  const updateSettings = (newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettings((prev) => {
      const resolved = typeof newSettings === 'function' ? newSettings(prev) : { ...prev, ...newSettings };
      
      // If custom Supabase settings were changed, update the client
      if (resolved.supabaseUrl !== prev.supabaseUrl || resolved.supabaseAnonKey !== prev.supabaseAnonKey) {
        if (resolved.supabaseUrl && resolved.supabaseAnonKey) {
          updateSupabaseClient(resolved.supabaseUrl, resolved.supabaseAnonKey);
          setDbStatus((p) => ({ ...p, isCustom: true }));
          setTimeout(() => {
            testDbConnection();
            loadFromSupabase();
          }, 100);
        } else if (!resolved.supabaseUrl && !resolved.supabaseAnonKey) {
          // Revert to default keys
          const keys = getSupabaseKeys();
          updateSupabaseClient(keys.url, keys.anonKey);
          setDbStatus((p) => ({ ...p, isCustom: false }));
          setTimeout(() => {
            testDbConnection();
            loadFromSupabase();
          }, 100);
        }
      }
      
      return resolved;
    });
  };

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_associates`, JSON.stringify(associates));
  }, [associates]);

  // Sync initial data from Supabase if available
  const loadFromSupabase = async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    try {
      // 1. Fetch products from Supabase
      const { data: prodData, error: prodErr } = await supabase.from('products').select('*');
      if (prodErr) {
        setDbStatus((p) => ({
          ...p,
          isConnected: false,
          isChecking: false,
          errorMessage: prodErr.message,
        }));
        return;
      }

      setDbStatus((p) => ({
        ...p,
        isConnected: true,
        isChecking: false,
        errorMessage: undefined,
      }));

      if (prodData && prodData.length > 0) {
        const mappedProducts: Product[] = prodData.map((p: any) => ({
          id: String(p.id ?? p.sku ?? p.barcode ?? `prod_${Date.now()}_${Math.random()}`),
          name: p.name || 'منتج',
          sku: String(p.sku ?? p.id ?? 'SKU-000'),
          barcode: String(p.barcode || p.sku || p.id || '000000'),
          category: p.category || 'عام',
          priceCash: Number(p.priceCash ?? p.cash_price ?? p.price_cash ?? p.price ?? p.sale_price ?? 0),
          priceInstallment: Number(p.priceInstallment ?? p.installment_price ?? p.price_installment ?? p.installmentPrice ?? 0),
          priceWholesale: Number(p.priceWholesale ?? p.wholesale_price ?? p.price_wholesale ?? p.wholesalePrice ?? 0),
          cost: Number(p.cost ?? p.cost_price ?? p.cost_cash ?? p.purchase_price ?? p.buy_price ?? 0),
          stock: Number(
            p.stock_quantity ??
            p.quantity ??
            p.qty ??
            p.stock ??
            p.stock_qty ??
            p.quantity_in_stock ??
            p.inventory ??
            p.count ??
            p.amount ??
            0
          ),
          image: p.image_url || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
          description: p.description || '',
          barcodes: Array.isArray(p.barcodes) 
            ? p.barcodes.map(String) 
            : typeof p.barcodes === 'string' 
              ? p.barcodes.split(',').map((s: string) => s.trim()).filter(Boolean)
              : typeof p.alternative_barcodes === 'string'
                ? p.alternative_barcodes.split(',').map((s: string) => s.trim()).filter(Boolean)
                : Array.isArray(p.alternative_barcodes)
                  ? p.alternative_barcodes.map(String)
                  : [],
        }));
        setProducts(mappedProducts);
      }

      // 2. Fetch associates from Supabase
      const { data: assocData } = await supabase.from('associates').select('*');
      if (assocData && assocData.length > 0) {
        const mappedFromDb: Associate[] = assocData.map((a: any) => ({
          id: String(a.id),
          name: a.name || 'موظف',
          username: a.username || a.user_name || (a.name ? String(a.name).toLowerCase() : '') || `user_${a.id}`,
          password: String(a.password || a.pin || a.pass || '1001'),
          pin: String(a.pin || a.password || a.pass || '1001'),
          role: a.role || 'مسؤول مبيعات',
          avatar: a.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          email: a.email || '',
          phone: a.phone || '',
          commissionRate: Number(a.commission_rate ?? a.commissionRate ?? 0.05),
          dailyGoal: Number(a.daily_goal ?? a.dailyGoal ?? 5000),
          hourlyRate: Number(a.hourly_rate ?? a.hourlyRate ?? 25),
          isClockedIn: false,
        }));

        setAssociates((prev) => {
          const map = new Map<string, Associate>();
          // Always include built-in initial associates
          INITIAL_ASSOCIATES.forEach((initAssoc) => map.set(initAssoc.id, initAssoc));
          // Add/override with DB associates
          mappedFromDb.forEach((dbAssoc) => map.set(dbAssoc.id, dbAssoc));
          return Array.from(map.values());
        });
      }

      // 3. Fetch customers from Supabase
      const { data: custData } = await supabase.from('customers').select('*');
      if (custData && custData.length > 0) {
        const mappedCustomers: Customer[] = custData.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          totalSpent: Number(c.total_spent ?? c.totalSpent ?? 0),
          loyaltyPoints: Number(c.loyalty_points ?? c.loyaltyPoints ?? 0),
          tier: c.tier || 'عادي',
          isCreditEligible: c.is_credit_eligible ?? c.isCreditEligible ?? (c.id === 'cust_1' || c.id === 'cust_3'),
          creditLimit: Number(c.credit_limit ?? c.creditLimit ?? (c.id === 'cust_1' ? 10000 : c.id === 'cust_3' ? 150000 : 0)),
          currentDebt: Number(c.current_debt ?? c.currentDebt ?? (c.id === 'cust_3' ? 25000 : 0)),
          notes: c.notes || '',
        }));
        setCustomers(mappedCustomers);
      }

      // 4. Fetch closed shifts from Supabase
      try {
        const { data: shiftData } = await supabase.from('closed_shifts').select('*');
        if (shiftData && shiftData.length > 0) {
          const mappedShifts: ClosedShift[] = shiftData.map((s: any) => ({
            id: s.id,
            associateId: s.associate_id,
            associateName: s.associate_name,
            startTime: s.start_time,
            endTime: s.end_time,
            expectedCash: Number(s.expected_cash ?? 0),
            actualCash: Number(s.actual_cash ?? 0),
            discrepancy: Number(s.discrepancy ?? 0),
            salesCount: Number(s.sales_count ?? 0),
            totalSales: Number(s.total_sales ?? 0),
            totalCard: Number(s.total_card ?? 0),
            totalInstallment: Number(s.total_installment ?? 0),
            totalDebtCollected: Number(s.total_debt_collected ?? 0),
            notes: s.notes || '',
            openingBalance: Number(s.opening_balance ?? s.openingBalance ?? 0),
            leftoverBalance: Number(s.leftover_balance ?? s.leftoverBalance ?? 0),
            isSynced: true,
          }));

          setClosedShifts((prev) => {
            const map = new Map<string, ClosedShift>();
            mappedShifts.forEach((s) => map.set(s.id, s));
            prev.forEach((s) => {
              if (!s.isSynced) {
                map.set(s.id, { ...s, isSynced: false });
              } else {
                map.set(s.id, { ...s, isSynced: true });
              }
            });
            return Array.from(map.values()).sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
          });
        }
      } catch (shiftErr) {
        console.warn('Closed shifts table might be missing or not created yet in Supabase:', shiftErr);
      }

      // 5. Fetch transactions from Supabase
      try {
        const { data: txData } = await supabase.from('transactions').select('*');
        if (txData && txData.length > 0) {
          const mappedTxs: Transaction[] = txData.map((t: any) => ({
            id: t.id,
            receiptNumber: t.receipt_number || t.receiptNumber || '0000',
            timestamp: t.created_at || t.timestamp || new Date().toISOString(),
            items: Array.isArray(t.items) ? t.items : JSON.parse(t.items || '[]'),
            subtotal: Number(t.subtotal ?? t.grand_total ?? 0),
            discountTotal: Number(t.discount_amount ?? t.discountTotal ?? 0),
            taxTotal: Number(t.tax_total ?? t.taxTotal ?? 0),
            grandTotal: Number(t.grand_total ?? 0),
            paymentMethod: t.payment_method || 'كاش',
            paymentDetails: t.payment_details || t.paymentDetails || '',
            customerId: t.customer_id || t.customerId || undefined,
            customerName: t.customerName || '',
            primaryAssociateId: t.associate_id || t.primaryAssociateId || 'system',
            primaryAssociateName: t.primaryAssociateName || 'موظف',
            commissions: Array.isArray(t.commissions) ? t.commissions : JSON.parse(t.commissions || '[]'),
            status: t.status || 'مكتملة',
            isSynced: true,
          }));

          setTransactions((prev) => {
            const map = new Map<string, Transaction>();
            mappedTxs.forEach((tx) => map.set(tx.id, tx));
            prev.forEach((tx) => {
              if (!tx.isSynced) {
                map.set(tx.id, { ...tx, isSynced: false });
              } else {
                map.set(tx.id, { ...tx, isSynced: true });
              }
            });
            return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          });
        }
      } catch (txErr) {
        console.warn('Transactions table might be missing or not created yet in Supabase:', txErr);
      }
    } catch (err: any) {
      console.warn('Supabase initial fetch skipped or table pending:', err);
      setDbStatus((p) => ({
        ...p,
        isConnected: false,
        isChecking: false,
        errorMessage: err?.message || String(err),
      }));
    }
  };

  const syncTransactionWithStatus = (tx: Transaction) => {
    syncTransactionToSupabase(tx).then((res) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, isSynced: res.success } : t))
      );
    });
  };

  const syncClosedShiftWithStatus = (shift: ClosedShift) => {
    syncClosedShiftToSupabase(shift).then((res) => {
      setClosedShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, isSynced: res.success } : s))
      );
    });
  };

  const syncUnsyncedItems = async () => {
    setDbStatus((p) => ({ ...p, isChecking: true }));
    let hasError = false;
    let lastErrorMsg = '';

    // 1. Sync unsynced transactions
    const unsyncedTxs = transactions.filter((t) => !t.isSynced);
    for (const tx of unsyncedTxs) {
      const res = await syncTransactionToSupabase(tx);
      if (res.success) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === tx.id ? { ...t, isSynced: true } : t))
        );
      } else {
        hasError = true;
        lastErrorMsg = res.error?.message || String(res.error || 'خطأ في مزامنة الفاتورة');
      }
    }

    // 2. Sync unsynced closed shifts
    const unsyncedShifts = closedShifts.filter((s) => !s.isSynced);
    for (const shift of unsyncedShifts) {
      const res = await syncClosedShiftToSupabase(shift);
      if (res.success) {
        setClosedShifts((prev) =>
          prev.map((s) => (s.id === shift.id ? { ...s, isSynced: true } : s))
        );
      } else {
        hasError = true;
        lastErrorMsg = res.error?.message || String(res.error || 'خطأ في مزامنة الوردية');
      }
    }

    setDbStatus((p) => ({
      ...p,
      isConnected: !hasError,
      isChecking: false,
      errorMessage: hasError ? lastErrorMsg : undefined,
    }));
  };

  useEffect(() => {
    loadFromSupabase();
  }, []);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_products`, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_customers`, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_closed_shifts`, JSON.stringify(closedShifts));
  }, [closedShifts]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_suppliers`, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_supplier_txs`, JSON.stringify(supplierTransactions));
  }, [supplierTransactions]);

  const setCurrentAssociate = (assoc: Associate | null) => {
    setCurrentAssociateState(assoc);
  };

  const setGlobalPriceTier = (tier: PriceTier) => {
    setGlobalPriceTierState(tier);
    setCart((prevCart) =>
      prevCart.map((item) => ({ ...item, selectedPriceTier: tier }))
    );
  };

  const quickSwitchByPin = (pin: string): boolean => {
    const found = associates.find((a) => a.pin === pin);
    if (found) {
      setCurrentAssociateState(found);
      if (!found.isClockedIn) {
        clockInAssociate(found.id);
      }
      return true;
    }
    return false;
  };

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
      alert(`خطأ: لا يمكن بيع أكثر من الكمية المتاحة في المخزن للمنتج (${product.name}). المتاح حالياً: ${product.stock} قطعة.`);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const updateCartItemPriceTier = (productId: string, priceTier: PriceTier) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, selectedPriceTier: priceTier } : item
      )
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
      prev.map((item) =>
        item.product.id === productId ? { ...item, assignedAssociateId: associateId } : item
      )
    );
  };

  const getCartItemDiscountAmount = (item: CartItem): number => {
    const unitPrice = getItemUnitPrice(item);
    
    // Check if there is an active admin discount for this product
    const adminDiscount = discounts.find((d) => d.productId === item.product.id && d.isActive !== false);
    let adminDiscountAmt = 0;
    if (adminDiscount) {
      const tier = item.selectedPriceTier || globalPriceTier;
      const appliesToCash = !adminDiscount.applyTo || adminDiscount.applyTo === 'cash' || adminDiscount.applyTo === 'both';
      const appliesToInstallment = !adminDiscount.applyTo || adminDiscount.applyTo === 'installment' || adminDiscount.applyTo === 'both';
      
      let isApplicable = false;
      if (tier === 'cash' && appliesToCash) {
        isApplicable = true;
      } else if (tier === 'installment' && appliesToInstallment) {
        isApplicable = true;
      } else if (tier === 'wholesale' && appliesToCash) {
        isApplicable = true;
      } else if (tier !== 'cash' && tier !== 'installment' && appliesToCash) {
        isApplicable = true;
      }

      if (isApplicable) {
        if (adminDiscount.type === 'percentage') {
          adminDiscountAmt = (unitPrice * adminDiscount.value) / 100;
        } else {
          adminDiscountAmt = adminDiscount.value;
        }
      }
    }

    // Add manual discount percent if any
    const manualDiscountAmt = (unitPrice * (item.discountPercent || 0)) / 100;

    // Total discount amount per unit
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

  const addDiscount = (discount: ProductDiscount) => {
    setDiscounts((prev) => {
      const filtered = prev.filter((d) => d.productId !== discount.productId);
      return [...filtered, discount];
    });
  };

  const removeDiscount = (productId: string) => {
    setDiscounts((prev) => prev.filter((d) => d.productId !== productId));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSplitAssociates([]);
  };

  const getItemUnitPrice = (item: CartItem): number => {
    if (item.overridePrice !== undefined && item.overridePrice > 0) return item.overridePrice;
    const tier = item.selectedPriceTier || globalPriceTier;
    if (tier === 'cash') return item.product.priceCash || 0;
    if (tier === 'installment') return item.product.priceInstallment || 0;
    if (tier === 'wholesale') return item.product.priceWholesale || 0;
    return item.product.priceCash || 0;
  };

  const completeTransaction = (
    paymentMethod: PaymentMethod,
    discountTotalOverride = 0,
    paymentDetails = '',
    notes = '',
    amountPaid?: number,
    amountDeferred?: number,
    splitPayments?: SplitPaymentItem[]
  ): Transaction => {
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
        assignedAssociateId: item.assignedAssociateId,
      };
    });

    if (discountTotalOverride > 0) {
      discountTotal += discountTotalOverride;
    }

    const grandTotal = isReturn ? (subtotal - discountTotal) : Math.max(0, subtotal - discountTotal);

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
            (associateSalesMap[primaryAssocId] || 0) +
            (generalNetSubtotal * primarySharePercent) / 100;
        }

        splitAssociates.forEach((split) => {
          associateSalesMap[split.associateId] =
            (associateSalesMap[split.associateId] || 0) +
            (generalNetSubtotal * split.sharePercentage) / 100;
        });
      } else {
        associateSalesMap[primaryAssocId] =
          (associateSalesMap[primaryAssocId] || 0) + generalNetSubtotal;
      }
    }

    const commissions: TransactionCommission[] = Object.entries(associateSalesMap).map(
      ([assocId, saleAmt]) => {
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
      }
    );

    const receiptNumber = `RCP-ASM-${Math.floor(10000 + Math.random() * 90000)}`;

    const newTransaction: Transaction = {
      id: `tx_${Date.now()}`,
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

    setProducts((prev) =>
      prev.map((p) => {
        const cartItem = cart.find((ci) => ci.product.id === p.id);
        if (cartItem) {
          const updatedProd = { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
          syncProductToSupabase(updatedProd);
          return updatedProd;
        }
        return p;
      })
    );

    if (selectedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomer.id) {
            const ratio = settings.loyaltyPointsRatio || 10;
            const addedPoints = Math.floor(grandTotal / ratio);

            // Calculate points used
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

            const currentDebtVal = c.currentDebt || 0;
            const newDebt = currentDebtVal + (amountDeferred || 0);
            const updated = {
              ...c,
              totalSpent: c.totalSpent + grandTotal,
              loyaltyPoints: Math.max(0, c.loyaltyPoints + addedPoints - pointsUsed),
              currentDebt: newDebt,
            };
            syncCustomerToSupabase(updated);
            return updated;
          }
          return c;
        })
      );
    }

    setTransactions((prev) => [newTransaction, ...prev]);
    syncTransactionWithStatus(newTransaction);
    clearCart();

    return newTransaction;
  };

  const voidTransaction = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'ملغاة' as const } : t))
    );
  };

  const holdCart = (notes = '') => {
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
        assignedAssociateId: item.assignedAssociateId,
      };
    });

    const grandTotal = Math.max(0, subtotal - discountTotal);
    const primaryAssocId = currentAssociate?.id || 'system';
    const primaryAssocName = currentAssociate?.name || 'النظام';

    const receiptNumber = `HLD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newHeldTransaction: Transaction = {
      id: `tx_held_${Date.now()}`,
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
      originalCart: JSON.parse(JSON.stringify(cart)), // deep copy to avoid reference sharing
    };

    setTransactions((prev) => [newHeldTransaction, ...prev]);
    try {
      syncTransactionWithStatus(newHeldTransaction);
    } catch (e) {
      console.error(e);
    }

    setCart([]);
    setSelectedCustomer(null);
    setSplitAssociates([]);
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

    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    setActiveTab('register');
  };

  const deleteTransaction = (transactionId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
  };

  const returnTransaction = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId && t.status === 'مكتملة') {
          // 1. Revert product stock
          setProducts((prevProducts) =>
            prevProducts.map((p) => {
              const returnedItem = t.items.find((item) => item.productId === p.id);
              if (returnedItem) {
                const updatedProd = { ...p, stock: p.stock + returnedItem.quantity };
                syncProductToSupabase(updatedProd);
                return updatedProd;
              }
              return p;
            })
          );

          // 2. Revert customer balance
          if (t.customerId) {
            setCustomers((prevCusts) =>
              prevCusts.map((c) => {
                if (c.id === t.customerId) {
                  const ratio = settings.loyaltyPointsRatio || 10;
                  const addedPoints = Math.floor(t.grandTotal / ratio);
                  
                  // Revert loyalty points and spent total, also decrease currentDebt if amountDeferred exists
                  const newDebt = Math.max(0, (c.currentDebt || 0) - (t.amountDeferred || 0));
                  const newSpent = Math.max(0, (c.totalSpent || 0) - t.grandTotal);
                  const newPoints = Math.max(0, (c.loyaltyPoints || 0) - addedPoints);

                  const updatedCust = {
                    ...c,
                    totalSpent: newSpent,
                    loyaltyPoints: newPoints,
                    currentDebt: newDebt,
                  };
                  syncCustomerToSupabase(updatedCust);
                  return updatedCust;
                }
                return c;
              })
            );
          }

          // 3. Mark transaction as returned
          const updatedTx: Transaction = { ...t, status: 'مسترجعة' };
          syncTransactionWithStatus(updatedTx);
          return updatedTx;
        }
        return t;
      })
    );
  };

  const addExpense = (expenseData: Omit<POSExpense, 'id' | 'timestamp'>) => {
    const newExpense: POSExpense = {
      ...expenseData,
      id: `expense_${Date.now()}`,
      timestamp: new Date().toISOString(),
      associateId: currentAssociate?.id || undefined,
      associateName: currentAssociate?.name || undefined,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    syncExpenseToSupabase(newExpense);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const clockInAssociate = (associateId: string) => {
    setAssociates((prev) =>
      prev.map((a) => {
        if (a.id === associateId) {
          const updated = { ...a, isClockedIn: true, clockInTime: new Date().toISOString() };
          syncAssociateToSupabase(updated);
          return updated;
        }
        return a;
      })
    );
  };

  const clockOutAssociate = (associateId: string) => {
    setAssociates((prev) =>
      prev.map((a) => {
        if (a.id === associateId) {
          const updated = { ...a, isClockedIn: false, clockInTime: undefined };
          syncAssociateToSupabase(updated);
          return updated;
        }
        return a;
      })
    );
  };

  const addAssociate = (assocData: Omit<Associate, 'id' | 'isClockedIn'>) => {
    const newAssoc: Associate = {
      ...assocData,
      id: `assoc_${Date.now()}`,
      isClockedIn: true,
      clockInTime: new Date().toISOString(),
    };
    setAssociates((prev) => [...prev, newAssoc]);
    syncAssociateToSupabase(newAssoc);
    if (!currentAssociate) {
      setCurrentAssociateState(newAssoc);
    }
  };

  const updateAssociate = (assoc: Associate) => {
    setAssociates((prev) => prev.map((a) => (a.id === assoc.id ? assoc : a)));
    syncAssociateToSupabase(assoc);
    if (currentAssociate?.id === assoc.id) {
      setCurrentAssociateState(assoc);
    }
  };

  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...prodData,
      id: prodData.sku || prodData.barcode || `prod_${Date.now()}`,
    };
    setProducts((prev) => [newProduct, ...prev]);
    syncProductToSupabase(newProduct);
  };

  const updateProduct = (prod: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
    syncProductToSupabase(prod);
  };

  const bulkUpdateProducts = (productIds: string[], updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (productIds.includes(p.id)) {
          const updated = { ...p, ...updates };
          syncProductToSupabase(updated);
          return updated;
        }
        return p;
      })
    );
  };

  const addCustomer = (
    custData: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>
  ): Customer => {
    const newCustomer: Customer = {
      ...custData,
      id: `cust_${Date.now()}`,
      totalSpent: 0,
      loyaltyPoints: 50,
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    syncCustomerToSupabase(newCustomer);
    setSelectedCustomer(newCustomer);
    return newCustomer;
  };

  const updateCustomer = (cust: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === cust.id ? cust : c)));
    syncCustomerToSupabase(cust);
    if (selectedCustomer?.id === cust.id) {
      setSelectedCustomer(cust);
    }
  };

  const payCustomerDebt = (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updated = {
            ...c,
            currentDebt: Math.max(0, (c.currentDebt || 0) - amount),
          };
          syncCustomerToSupabase(updated);
          return updated;
        }
        return c;
      })
    );

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
        }
      ],
      subtotal: -amount,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: -amount,
      paymentMethod,
      paymentDetails: `سداد جزء من مديونية الآجل: ${amount.toLocaleString()} ج.م`,
      customerId,
      customerName: customers.find((c) => c.id === customerId)?.name || 'عميل',
      primaryAssociateId: currentAssociate?.id || 'system',
      primaryAssociateName: currentAssociate?.name || 'النظام',
      commissions: [],
      notes: notes || 'سداد مديونية',
      status: 'مكتملة',
      amountPaid: amount,
      amountDeferred: -amount,
    };

    setTransactions((prev) => [newTransaction, ...prev]);
    syncTransactionWithStatus(newTransaction);
  };

  const addSupplier = (supplierData: Omit<Supplier, 'id'>): Supplier => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `supp_${Date.now()}`,
      currentBalance: supplierData.currentBalance || 0,
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    syncSupplierToSupabase(newSupplier);
    return newSupplier;
  };

  const updateSupplier = (updated: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    syncSupplierToSupabase(updated);
  };

  const deleteSupplier = (supplierId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
  };

  const recordSupplierTransaction = (txData: Omit<SupplierTransaction, 'id' | 'date'>) => {
    const newTx: SupplierTransaction = {
      ...txData,
      id: `stx_${Date.now()}`,
      date: new Date().toISOString(),
    };

    setSupplierTransactions((prev) => [newTx, ...prev]);
    syncSupplierTransactionToSupabase(newTx);

    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === txData.supplierId) {
          let delta = 0;
          if (txData.type === 'supply_invoice') delta = txData.amount;
          else if (txData.type === 'payment' || txData.type === 'return') delta = -txData.amount;

          const updated = {
            ...s,
            currentBalance: Math.max(0, (s.currentBalance || 0) + delta),
          };
          syncSupplierToSupabase(updated);
          return updated;
        }
        return s;
      })
    );
  };

  const resetDemoData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_associates`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_products`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_customers`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_transactions`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_suppliers`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_supplier_txs`);

    setAssociates(INITIAL_ASSOCIATES);
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setTransactions(INITIAL_TRANSACTIONS);
    setSuppliers(INITIAL_SUPPLIERS);
    setSupplierTransactions(INITIAL_SUPPLIER_TRANSACTIONS);
    setCurrentAssociateState(INITIAL_ASSOCIATES[0]);
    clearCart();
  };

  const closeShift = (shiftData: Omit<ClosedShift, 'id'>) => {
    const newShift: ClosedShift = {
      ...shiftData,
      id: `shift_${Date.now()}`,
    };
    setClosedShifts((prev) => [newShift, ...prev]);
    syncClosedShiftWithStatus(newShift);
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
        activeTab,
        globalPriceTier,
        taxRate,
        settings,
        discounts,
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
        addProduct,
        updateProduct,
        bulkUpdateProducts,
        addCustomer,
        updateCustomer,
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
