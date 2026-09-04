import { Associate, Product, Customer, Transaction, Supplier, SupplierTransaction } from '../types';

export const DEFAULT_ADMIN_ASSOCIATE: Associate = {
  id: 'admin_1',
  name: 'مدير النظام',
  username: 'admin',
  password: '1234',
  pin: '1234',
  role: 'مدير الفرع',
  permissions: [
    'view_cash_price',
    'view_installment_price',
    'view_wholesale_price',
    'view_cost_price',
    'create_invoice',
    'apply_discount',
    'override_cart_price',
    'return_invoice',
    'void_invoice',
    'add_products',
    'edit_products',
    'delete_products',
    'manage_catalog',
    'manage_expenses',
    'manage_safe',
    'view_analytics',
    'manage_customers',
    'manage_suppliers',
    'manage_associates',
  ],
  invoiceDaysAccess: 'all',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
  email: 'admin@asmaa.com',
  phone: '01000000000',
  commissionRate: 0.05,
  dailyGoal: 20000,
  hourlyRate: 40,
  isClockedIn: false,
};

// All mock collections are empty - System operates 100% on live Supabase database
export const INITIAL_ASSOCIATES: Associate[] = [DEFAULT_ADMIN_ASSOCIATE];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_SUPPLIER_TRANSACTIONS: SupplierTransaction[] = [];

export const FUNCTION_KEYS_LIST = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
] as const;

export const DEFAULT_SHORTCUT_KEYS: Record<string, import('../types').ShortcutActionId> = {
  F1: 'open_register',
  F2: 'checkout_payment',
  F3: 'print_last_receipt',
  F4: 'pay_installment',
  F5: 'add_expense',
  F6: 'focus_search',
  F7: 'open_catalog',
  F8: 'open_customers',
  F9: 'open_suppliers',
  F10: 'clear_cart',
  F11: 'open_analytics',
  F12: 'quick_lock',
};

export const SHORTCUT_ACTION_LABELS: Record<import('../types').ShortcutActionId, { label: string; description: string }> = {
  none: { label: 'غير مفعّل (بدون إجراء)', description: 'لا يتم تنفيذ أي إجراء عند الضغط' },
  open_register: { label: 'فتح شاشة الفواتير (الكاشير)', description: 'الانتقال فورا لنقطة البيع وتحرير فاتورة جديدة' },
  open_new_invoice: { label: 'فتح فاتورة جديدة (مع تعليق الحالية تلقائياً)', description: 'فتح فاتورة جديدة، وتلقائياً توضع الفاتورة الحالية على الانتظار إن وجدت (سواء يوجد اسم عميل أم لا)' },
  checkout_payment: { label: 'إنهاء الفاتورة والدفع السريع', description: 'فتح نافذة الدفع لاختيار طريقة السداد وتحصيل الفاتورة' },
  print_last_receipt: { label: 'طباعة أحدث فاتورة', description: 'فتح معاينة وطباعة آخر فاتورة تم إخراجها' },
  pay_installment: { label: 'تسديد قسط / سداد حساب عميل', description: 'الانتقال للعملاء أو فتح نافذة تسديد الديون والأقساط' },
  add_expense: { label: 'تسجيل مصروف جديد', description: 'فتح نافذة إضافة بند مصروفات جديد بالخزنة' },
  open_catalog: { label: 'شاشة الأصناف والمنتجات', description: 'الانتقال إلى كتالوج الأجهزة والمنتجات' },
  open_customers: { label: 'شاشة حسابات العملاء', description: 'الانتقال لدفتر ومستحقات العملاء' },
  open_suppliers: { label: 'شاشة حسابات الموردين', description: 'الانتقال لصفحة الموردين والشركات' },
  open_analytics: { label: 'شاشة التقارير واليومية', description: 'الانتقال للتقارير والأرباح واليوميات' },
  open_discounts: { label: 'شاشة العروض والخصومات', description: 'الانتقال لإدارة العروض والخصومات' },
  open_associates: { label: 'شاشة الموظفين والوردية', description: 'الانتقال لإدارة الموظفين وإغلاق الخزينة والوردية' },
  open_settings: { label: 'شاشة الإعدادات', description: 'الانتقال لضبط إعدادات النظام' },
  focus_search: { label: 'التركيز على بحث الأصناف والباركود', description: 'تحديد خانة البحث فوراً لكتابة الاسم أو مسح الباركود' },
  clear_cart: { label: 'تفريغ سلة المبيعات الحالية', description: 'حذف جميع المنتجات المضافة في السلة الكاشير' },
  quick_lock: { label: 'قفل الشاشة / تغيير الموظف السريع', description: 'فتح نافذة رمز البائع (PIN) للتبديل أو قفل الشاشة' },
};
