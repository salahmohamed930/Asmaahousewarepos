export type PriceTier = 'cash' | 'installment' | 'wholesale';

export type Role = 'مسؤول مبيعات' | 'بائع أول' | 'مشرف قسم' | 'مدير الفرع';

export type Permission =
  | 'create_invoice'      // إنشاء فواتير
  | 'view_analytics'      // التقارير والإحصائيات
  | 'manage_catalog'      // كتالوج الأصناف والأسعار
  | 'manage_customers'    // حسابات العملاء
  | 'manage_associates'   // إدارة الموظفين والصلاحيات
  | 'apply_discount'      // تطبيق الخصم
  | 'void_invoice';       // إلغاء الفواتير

export interface Associate {
  id: string;
  name: string;
  username: string;
  password?: string;
  pin: string;
  role: Role;
  permissions?: Permission[];
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
  barcodes?: string[];      // أكواد / باركودات إضافية للمنتج
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

export interface Supplier {
  id: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string;
  currentBalance: number; // الرصيد الدائن / مستحقات المورد له لدينا
  notes?: string;
  taxNumber?: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  supplierName: string;
  type: 'supply_invoice' | 'payment' | 'return';
  amount: number;
  date: string;
  referenceNumber?: string;
  paymentMethod?: string;
  notes?: string;
  associateName?: string;
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
  isCreditEligible?: boolean; // مؤهل للشراء الآجل
  creditLimit?: number;       // حد الائتمان / سقف المديونية
  currentDebt?: number;       // المديونية الحالية
  notes?: string;             // ملاحظات حول العميل
  address?: string;           // عنوان العميل
}

export type PaymentMethod = 'كاش' | 'فيزا / كارت' | 'تقسيط شهري' | 'آجل / حساب جملة' | 'محفظة إلكترونية' | 'دفع متعدد' | 'نقاط ولاء';

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

export interface SplitPaymentItem {
  method: PaymentMethod;
  amount: number;
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
  status: 'مكتملة' | 'ملغاة' | 'مسترجعة' | 'معلقة';
  amountPaid?: number;        // المبلغ المدفوع كاش أو إلكترونياً
  amountDeferred?: number;    // المبلغ المرحل لمديونية الآجل
  originalCart?: CartItem[];  // سلة المشتريات الأصلية المستعادة
  splitPayments?: SplitPaymentItem[]; // تفاصيل طرق الدفع المجزأة
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

export interface ClosedShift {
  id: string;
  associateId: string;
  associateName: string;
  startTime: string;
  endTime: string;
  expectedCash: number;
  actualCash: number;
  discrepancy: number; // actual - expected
  salesCount: number;
  totalSales: number;
  totalCard: number;
  totalInstallment: number;
  totalDebtCollected: number;
  notes?: string;
  openingBalance?: number;    // الرصيد الافتتاحي المستلم من الوردية السابقة
  leftoverBalance?: number;   // الرصيد المستبقى بالخزنة للوردية القادمة
}

export interface ProfitMargin {
  cash: number;
  wholesale: number;
  installment: number;
}

export interface PrintSettings {
  headerText: string;
  footerText: string;
  showSellerCode: boolean;
  showQRCode: boolean;
  showLogo: boolean;
  receiptType: 'thermal' | 'a4';
}

export interface AppSettings {
  theme: 'dark' | 'light';
  profitMargins: {
    default: ProfitMargin;
    categories: Record<string, ProfitMargin>;
  };
  printSettings: PrintSettings;
  categories: string[];
  loyaltyPointsRatio?: number; // كم جنيه ينفقه العميل ليحصل على نقطة واحدة
  loyaltyPointValue?: number;  // القيمة المالية للنقطة الواحدة بالجنيه
}

export interface ProductDiscount {
  productId: string;
  type: 'percentage' | 'amount';
  value: number;
  isActive: boolean;
  applyTo?: 'cash' | 'installment' | 'both';
}

export interface POSExpense {
  id: string;
  amount: number;
  category: string; // e.g., 'رواتب', 'إيجار', 'مرافق', 'بضاعة', 'أخرى'
  description: string;
  timestamp: string;
  associateId?: string;
  associateName?: string;
}

