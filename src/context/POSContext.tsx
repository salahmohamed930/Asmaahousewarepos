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
  activeTab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'database';
  globalPriceTier: PriceTier; // 'cash' | 'installment' | 'wholesale'
  
  setActiveTab: (tab: 'register' | 'associates' | 'catalog' | 'analytics' | 'customers' | 'database') => void;
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
    notes?: string
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
  const [activeTab, setActiveTab] = useState<
    'register' | 'associates' | 'catalog' | 'analytics' | 'customers'
  >('register');

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_associates`, JSON.stringify(associates));
  }, [associates]);

  // Sync initial data from Supabase if available
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data: assocData } = await supabase.from('associates').select('*');
        if (assocData && assocData.length > 0) {
          const mapped: Associate[] = assocData.map((a: any) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            password: a.password || a.pin || '1234',
            pin: a.pin || '1234',
            role: a.role || 'مسؤول مبيعات',
            avatar: a.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            email: a.email || '',
            phone: a.phone || '',
            commissionRate: a.commission_rate || 0.05,
            dailyGoal: a.daily_goal || 5000,
            hourlyRate: a.hourly_rate || 25,
            isClockedIn: false,
          }));
          setAssociates(mapped);
        }
      } catch (err) {
        console.warn('Supabase initial fetch skipped or table pending:', err);
      }
    }
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
    if (item.overridePrice !== undefined) return item.overridePrice;
    if (item.selectedPriceTier === 'cash') return item.product.priceCash;
    if (item.selectedPriceTier === 'installment') return item.product.priceInstallment;
    if (item.selectedPriceTier === 'wholesale') return item.product.priceWholesale;
    return item.product.priceCash;
  };

  const completeTransaction = (
    paymentMethod: PaymentMethod,
    discountTotalOverride = 0,
    paymentDetails = '',
    notes = ''
  ): Transaction => {
    if (!currentAssociate) {
      throw new Error('رجاءً اختر البائع المسؤول قبل إتمام البيع.');
    }

    if (cart.length === 0) {
      throw new Error('سلة الشراء فارغة.');
    }

    let subtotal = 0;
    let discountTotal = discountTotalOverride;

    const transactionItems = cart.map((item) => {
      const unitPrice = getItemUnitPrice(item);
      const lineOriginalTotal = unitPrice * item.quantity;
      const lineDiscount = (lineOriginalTotal * item.discountPercent) / 100;
      const lineNetTotal = lineOriginalTotal - lineDiscount;

      subtotal += lineOriginalTotal;
      discountTotal += lineDiscount;

      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        priceTier: item.selectedPriceTier,
        unitPrice,
        totalPrice: lineNetTotal,
        assignedAssociateId: item.assignedAssociateId,
      };
    });

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

    if (generalNetSubtotal > 0) {
      if (splitAssociates.length > 0) {
        const totalSplitPercent = splitAssociates.reduce((acc, s) => acc + s.sharePercentage, 0);
        const primarySharePercent = Math.max(0, 100 - totalSplitPercent);

        if (primarySharePercent > 0) {
          associateSalesMap[currentAssociate.id] =
            (associateSalesMap[currentAssociate.id] || 0) +
            (generalNetSubtotal * primarySharePercent) / 100;
        }

        splitAssociates.forEach((split) => {
          associateSalesMap[split.associateId] =
            (associateSalesMap[split.associateId] || 0) +
            (generalNetSubtotal * split.sharePercentage) / 100;
        });
      } else {
        associateSalesMap[currentAssociate.id] =
          (associateSalesMap[currentAssociate.id] || 0) + generalNetSubtotal;
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
      primaryAssociateId: currentAssociate.id,
      primaryAssociateName: currentAssociate.name,
      splitAssociates: splitAssociates.length > 0 ? splitAssociates : undefined,
      commissions,
      notes,
      status: 'مكتملة',
    };

    setProducts((prev) =>
      prev.map((p) => {
        const cartItem = cart.find((ci) => ci.product.id === p.id);
        if (cartItem) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      })
    );

    if (selectedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomer.id) {
            const addedPoints = Math.floor(grandTotal / 10);
            return {
              ...c,
              totalSpent: c.totalSpent + grandTotal,
              loyaltyPoints: c.loyaltyPoints + addedPoints,
            };
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
      id: `prod_${Date.now()}`,
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
