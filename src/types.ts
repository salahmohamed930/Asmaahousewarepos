export type PriceTier = 'cash' | 'installment' | 'wholesale';

export type Role = 'مسؤول مبيعات' | 'بائع أول' | 'مشرف قسم' | 'مدير الفرع';

export interface Associate {
  id: string;
  name: string;
  username: string;
  password?: string;
  pin: string;
  role: Role;
  avatar: string;
  email: string;
  phone: string;
  commissionRate: number; // e.g. 0.05 for 5%
  dailyGoal: number; // target in EGP (ج.م)
  hourlyRate: number;
  isClockedIn: boolean;
  clockInTime?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  priceCash: number;        // سعر الكاش
  priceInstallment: number; // سعر التقسيط
  priceWholesale: number;   // سعر الجملة
  cost: number;             // سعر التكلفة
  stock: number;
  image: string;
  description?: string;
}

export interface SplitAssociate {
  associateId: string;
  sharePercentage: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedPriceTier: PriceTier;
  discountPercent: number;
  overridePrice?: number;
  assignedAssociateId?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredAssociateId?: string;
  loyaltyPoints: number;
  totalSpent: number;
  avatar?: string;
}

export type PaymentMethod = 'كاش' | 'فيزا / كارت' | 'تقسيط شهري' | 'آجل / حساب جملة' | 'محفظة إلكترونية';

export interface TransactionCommission {
  associateId: string;
  associateName: string;
  saleAmount: number;
  commissionAmount: number;
  sharePercentage: number;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  priceTier: PriceTier;
  unitPrice: number;
  totalPrice: number;
  assignedAssociateId?: string;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: TransactionItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentDetails?: string;
  customerId?: string;
  customerName?: string;
  primaryAssociateId: string;
  primaryAssociateName: string;
  splitAssociates?: SplitAssociate[];
  commissions: TransactionCommission[];
  notes?: string;
  status: 'مكتملة' | 'ملغاة' | 'مسترجعة';
}

export interface ShiftRecord {
  id: string;
  associateId: string;
  associateName: string;
  clockIn: string;
  clockOut?: string;
  salesCount: number;
  totalSalesAmount: number;
}
