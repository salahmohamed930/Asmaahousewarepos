export type PriceTier = 'cash' | 'installment' | 'wholesale';

export type Role = 'مسؤول مبيعات' | 'بائع أول' | 'مشرف قسم' | 'مدير الفرع';

export type Permission =
  // رؤية الأسعار
  | 'view_cash_price'        // رؤية سعر الكاش / القطاعي
  | 'view_installment_price' // رؤية سعر التقسيط
  | 'view_wholesale_price'   // رؤية سعر الجملة
  | 'view_cost_price'        // رؤية سعر التكلفة والأرباح
  // المبيعات والكاشير
  | 'create_invoice'         // إنشاء فواتير المبيعات
  | 'apply_discount'         // تطبيق خصم على الفاتورة
  | 'override_cart_price'    // تعديل سعر الصنف بالسلة
  | 'return_invoice'         // عمل مرتجع واسترداد فواتير
  | 'void_invoice'           // إلغاء الفواتير نهائياً
  | 'edit_invoice'           // تعديل الفواتير القديمة (الكميات والأسعار والدفعات)
  // المنتجات والأصناف
  | 'add_products'           // إضافة أصناف منتجات جديدة
  | 'edit_products'          // تعديل أصناف وأسعار المنتجات
  | 'delete_products'        // حذف أصناف منتجات
  | 'manage_catalog'         // إدارة الأقسام والكتالوج الشامل
  // الخزينة والمصروفات
  | 'manage_expenses'        // تسجيل وصرف المصروفات والمسحوبات
  | 'manage_safe'            // فتح وإغلاق وتسليم الخزنة والورديات
  // الإدارة والتقارير
  | 'view_analytics'         // عرض التقارير والإحصائيات والأرباح
  | 'manage_customers'       // حسابات والديون الخاصة بالعملاء
  | 'manage_suppliers'       // حسابات ومستحقات الموردين
  | 'manage_associates';     // إدارة الموظفين والصلاحيات وتراخيص الحسابات

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
  advancesBalance?: number; // إجمالي السلف المستحقة على الموظف
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
  tier?: string;
  avatar?: string;
  isCreditEligible?: boolean; // مؤهل للشراء الآجل
  creditLimit?: number;       // حد الائتمان / سقف المديونية
  currentDebt?: number;       // المديونية الحالية
  notes?: string;             // ملاحظات حول العميل
  address?: string;           // عنوان العميل
  monthlyInstallmentAmount?: number; // المبلغ المفترض تسديده شهرياً (الأقساط)
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
  discountAmount?: number;
  discountPercent?: number;
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
  isSynced?: boolean;         // تم المزامنة مع قاعدة البيانات السحابية أم لا
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
  isSynced?: boolean;         // تم المزامنة مع قاعدة البيانات السحابية أم لا
}

export interface ProfitMargin {
  cash: number;
  wholesale: number;
  installment: number;
}

export interface PrintSettings {
  headerText: string;
  address?: string;
  phoneNumbers?: string;
  footerText: string;
  footerSubText?: string;
  showSellerCode: boolean;
  showQRCode: boolean;
  showLogo: boolean;
  receiptType: 'thermal' | 'a4';
  facebookUrl?: string;
}

export type ShortcutActionId =
  | 'none'
  | 'open_register'
  | 'checkout_payment'
  | 'print_last_receipt'
  | 'pay_installment'
  | 'add_expense'
  | 'open_catalog'
  | 'open_customers'
  | 'open_suppliers'
  | 'open_analytics'
  | 'open_discounts'
  | 'open_associates'
  | 'open_settings'
  | 'focus_search'
  | 'clear_cart'
  | 'quick_lock';

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
  shortcutKeys?: Record<string, ShortcutActionId>; // تخصيص أزرار الاختصارات (F1 - F12)
  supabaseUrl?: string;        // عنوان قاعدة بيانات Supabase مخصص
  supabaseAnonKey?: string;    // مفتاح anon لقاعدة بيانات Supabase مخصص
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
  linkedSupplierId?: string;
  linkedSupplierName?: string;
  linkedAssociateId?: string;
  linkedAssociateName?: string;
}

