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
