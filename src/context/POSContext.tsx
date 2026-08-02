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
} from '../types';
import {
  INITIAL_ASSOCIATES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';
import {
  syncProductToSupabase,
  syncTransactionToSupabase,
  syncCustomerToSupabase,
  syncAssociateToSupabase,
} from '../lib/supabaseSync';
import { supabase } from '../lib/supabase';


interface POSContextType {
  associates: Associate[];
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  currentAssociate: Associate | null;
  cart: CartItem[];
  selectedCustomer: Customer | null;
  splitAssociates: SplitAssociate[];
  activeTab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers';
  globalPriceTier: PriceTier; // 'cash' | 'installment' | 'wholesale'
  taxRate: number;
  
  setActiveTab: (tab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers') => void;
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
    amountDeferred?: number
  ) => Transaction;
  voidTransaction: (transactionId: string) => void;
  
  // Staff & Shift Management
  clockInAssociate: (associateId: string) => void;
  clockOutAssociate: (associateId: string) => void;
  addAssociate: (assoc: Omit<Associate, 'id' | 'isClockedIn'>) => void;
  updateAssociate: (assoc: Associate) => void;
  
  // Catalog & Customer Management
  addProduct: (prod: Omit<Product, 'id'>) => void;
  updateProduct: (prod: Product) => void;
  addCustomer: (cust: Omit<Customer, 'id' | 'totalSpent' | 'loyaltyPoints'>) => Customer;
  updateCustomer: (cust: Customer) => void;
  payCustomerDebt: (customerId: string, amount: number, paymentMethod: PaymentMethod, notes?: string) => void;
  
  refreshDataFromSupabase: () => Promise<void>;
  resetDemoData: () => void;
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

  const [currentAssociate, setCurrentAssociateState] = useState<Associate | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [splitAssociates, setSplitAssociates] = useState<SplitAssociate[]>([]);
  const [globalPriceTier, setGlobalPriceTierState] = useState<PriceTier>('cash');
  const [taxRate] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'register' | 'associates' | 'catalog' | 'analytics' | 'customers'
  >('register');

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_associates`, JSON.stringify(associates));
  }, [associates]);

  // Sync initial data from Supabase if available
  const loadFromSupabase = async () => {
    try {
      // 1. Fetch products from Supabase
      const { data: prodData } = await supabase.from('products').select('*');
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
        }));
        setCustomers(mappedCustomers);
      }
    } catch (err) {
      console.warn('Supabase initial fetch skipped or table pending:', err);
    }
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
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].selectedPriceTier = tier;
        return updated;
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
    if (quantity <= 0) {
      removeFromCart(productId);
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
    amountDeferred?: number
  ): Transaction => {
    if (!currentAssociate) {
      throw new Error('رجاءً اختر البائع المسؤول قبل إتمام البيع.');
    }

    if (cart.length === 0) {
      throw new Error('سلة الشراء فارغة.');
    }

    let subtotal = 0;
    let discountTotal = 0;

    const transactionItems = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = (lineOriginalTotal * (item.discountPercent || 0)) / 100;
      const lineNetTotal = lineOriginalTotal - lineDiscount;

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

    const grandTotal = Math.max(0, subtotal - discountTotal);

    let generalNetSubtotal = 0;
    const associateSalesMap: Record<string, number> = {};

    cart.forEach((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = (lineOriginalTotal * item.discountPercent) / 100;
      const lineNetTotal = lineOriginalTotal - lineDiscount;

      if (item.assignedAssociateId) {
        associateSalesMap[item.assignedAssociateId] =
          (associateSalesMap[item.assignedAssociateId] || 0) + lineNetTotal;
      } else {
        generalNetSubtotal += lineNetTotal;
      }
    });

    const primaryAssocId = currentAssociate?.id || 'system';
    const primaryAssocName = currentAssociate?.name || 'النظام';

    if (generalNetSubtotal > 0) {
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
        const sharePercent = grandTotal > 0 ? Math.round((saleAmt / grandTotal) * 100) : 0;

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
      status: 'مكتملة',
      amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
      amountDeferred: amountDeferred !== undefined ? amountDeferred : 0,
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
            const addedPoints = Math.floor(grandTotal / 10);
            const currentDebtVal = c.currentDebt || 0;
            const newDebt = currentDebtVal + (amountDeferred || 0);
            const updated = {
              ...c,
              totalSpent: c.totalSpent + grandTotal,
              loyaltyPoints: c.loyaltyPoints + addedPoints,
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
    syncTransactionToSupabase(newTransaction);
    clearCart();

    return newTransaction;
  };

  const voidTransaction = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'ملغاة' as const } : t))
    );
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
    syncTransactionToSupabase(newTransaction);
  };

  const resetDemoData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_associates`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_products`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_customers`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_transactions`);

    setAssociates(INITIAL_ASSOCIATES);
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCurrentAssociateState(INITIAL_ASSOCIATES[0]);
    clearCart();
  };

  return (
    <POSContext.Provider
      value={{
        associates,
        products,
        customers,
        transactions,
        currentAssociate,
        cart,
        selectedCustomer,
        splitAssociates,
        activeTab,
        globalPriceTier,
        taxRate,
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
        setSplitAssociates,
        setSelectedCustomer,
        completeTransaction,
        voidTransaction,
        clockInAssociate,
        clockOutAssociate,
        addAssociate,
        updateAssociate,
        addProduct,
        updateProduct,
        addCustomer,
        updateCustomer,
        payCustomerDebt,
        refreshDataFromSupabase: loadFromSupabase,
        resetDemoData,
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
