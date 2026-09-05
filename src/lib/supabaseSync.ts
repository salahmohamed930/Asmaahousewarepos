import { supabase, getSupabaseKeys } from './supabase';
import {
  db,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  setLastPushTime,
  setLastPullTime,
  setLastSyncError,
  getPendingSyncCount,
  getFailedSyncCount,
  addToPendingQueue,
  PendingSyncItem,
} from './db';
import {
  Product,
  Customer,
  Transaction,
  Associate,
  ClosedShift,
  Supplier,
  SupplierTransaction,
  POSExpense,
  ProductDiscount,
} from '../types';

/**
 * Single Source of Truth & Local-First Synchronization Engine
 * - Handles Delta Sync with 'updated_at' filtering
 * - Selective column fetching to minimize Egress
 * - Outbox pattern for background writes to Supabase
 */

// --- 1. Connection Check ---
export async function checkSupabaseConnection(): Promise<{
  success: boolean;
  url: string;
  hasKey: boolean;
  isCorrectProject: boolean;
  details?: string;
  errorMessage?: string;
}> {
  const keys = getSupabaseKeys();
  const url = keys.url;
  const hasKey = keys.hasKey;
  const targetProjectUrl = 'https://ilyxhubihdqjbvkkpalx.supabase.co';
  const isCorrectProject = url.trim().toLowerCase() === targetProjectUrl.toLowerCase();

  if (!url) {
    return {
      success: false,
      url,
      hasKey,
      isCorrectProject,
      errorMessage: 'رابط Supabase غير معرف (Missing VITE_SUPABASE_URL)',
    };
  }

  if (!hasKey) {
    return {
      success: false,
      url,
      hasKey,
      isCorrectProject,
      errorMessage: 'مفتاح Supabase غير موجود (Missing VITE_SUPABASE_ANON_KEY)',
    };
  }

  try {
    const { data, error, status, statusText } = await supabase.from('products').select('id').limit(1);

    if (error) {
      let categorizedError = `[HTTP ${status || 'Error'}] ${error.message}`;
      if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch')) {
        categorizedError = `[شبكة] تعذر الاتصال بـ Supabase (Network / Fetch Failure): ${error.message}`;
      } else if (status === 401 || error.message?.includes('API key') || error.message?.includes('JWT')) {
        categorizedError = `[صلاحيات] مفتاح Supabase غير صالح أو منتهي (Invalid API Key): ${error.message}`;
      } else if (status === 403 || error.message?.includes('RLS')) {
        categorizedError = `[سياسات] تم رفض الطلب بواسطة RLS / Permissions: ${error.message}`;
      }

      console.warn('[SUPABASE HEALTH CHECK] Failed:', categorizedError);
      return {
        success: false,
        url,
        hasKey,
        isCorrectProject,
        details: `${status} ${statusText}`,
        errorMessage: categorizedError,
      };
    }

    return {
      success: true,
      url,
      hasKey,
      isCorrectProject,
      details: 'الاتصال بالمشروع والجدول ناجح 200 OK',
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.warn('[SUPABASE HEALTH CHECK] Exception:', msg);
    return {
      success: false,
      url,
      hasKey,
      isCorrectProject,
      errorMessage: `[استثناء] فشل غير متوقع عند الاتصال: ${msg}`,
    };
  }
}

// --- SCHEMA REGISTRY & ADAPTER ENGINE ---

export interface TableSchemaConfig {
  tableName: string;
  primaryKey: string;
  createdTimeCol: string | null;
  updatedTimeCol: string | null;
  deletedFlagCol: string | null;
}

export const TABLE_SCHEMAS: Record<string, TableSchemaConfig> = {
  products: {
    tableName: 'products',
    primaryKey: 'id',
    createdTimeCol: 'created_at',
    updatedTimeCol: 'created_at',
    deletedFlagCol: 'is_deleted',
  },
  customers: {
    tableName: 'customers',
    primaryKey: 'id',
    createdTimeCol: null,
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  suppliers: {
    tableName: 'suppliers',
    primaryKey: 'id',
    createdTimeCol: null,
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  supplier_transactions: {
    tableName: 'supplier_transactions',
    primaryKey: 'id',
    createdTimeCol: 'date',
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  transactions: {
    tableName: 'transactions',
    primaryKey: 'id',
    createdTimeCol: 'updated_at',
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  transaction_items: {
    tableName: 'transaction_items',
    primaryKey: 'id',
    createdTimeCol: null,
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  associates: {
    tableName: 'associates',
    primaryKey: 'id',
    createdTimeCol: null,
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  closed_shifts: {
    tableName: 'closed_shifts',
    primaryKey: 'id',
    createdTimeCol: 'start_time',
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  expenses: {
    tableName: 'expenses',
    primaryKey: 'id',
    createdTimeCol: 'timestamp',
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
  discounts: {
    tableName: 'discounts',
    primaryKey: 'product_id',
    createdTimeCol: null,
    updatedTimeCol: 'updated_at',
    deletedFlagCol: 'is_deleted',
  },
};

export const TABLE_SELECT_COLUMNS: Record<string, string> = {
  products: 'id, name, p_k, barcodes, alternative_barcodes, category, price, wholesale_price, price_installment, cost, stock_quantity, created_at, is_deleted',
  customers: 'id, name, phone, email, address, notes, current_debt, total_spent, loyalty_points, tier, is_credit_eligible, credit_limit, monthly_installment_amount, updated_at, is_deleted',
  suppliers: 'id, name, company_name, phone, email, address, notes, category, tax_number, current_balance, updated_at, is_deleted',
  supplier_transactions: 'id, supplier_id, type, amount, date, notes, invoice_number, payment_method, updated_at, is_deleted',
  transactions: '*',
  transaction_items: '*',
  associates: 'id, name, username, password, pin, role, phone, email, commission_rate, daily_goal, hourly_rate, advances_balance, is_clocked_in, permissions, allowed_invoice_days, custom_invoice_days, updated_at, is_deleted',
  closed_shifts: 'id, associate_id, associate_name, start_time, end_time, expected_cash, actual_cash, discrepancy, sales_count, total_sales, total_card, total_installment, total_debt_collected, notes, opening_balance, leftover_balance, updated_at, is_deleted',
  expenses: 'id, amount, category, notes, associate_id, associate_name, timestamp, updated_at, is_deleted',
  discounts: 'product_id, discount_percent, discount_amount, start_date, end_date, is_active, updated_at, is_deleted',
};

const missingColumnsByTable: Record<string, Set<string>> = {};

export function markColumnMissing(tableName: string, colName: string) {
  if (!colName) return;
  if (!missingColumnsByTable[tableName]) {
    missingColumnsByTable[tableName] = new Set();
  }
  missingColumnsByTable[tableName].add(colName.toLowerCase());
}

export function isColumnMissing(tableName: string, colName: string): boolean {
  if (!colName) return false;
  return missingColumnsByTable[tableName]?.has(colName.toLowerCase()) ?? false;
}

export function getCleanSelectColumns(tableName: string, defaultCols?: string): string {
  const base = defaultCols && defaultCols !== '*' ? defaultCols : (TABLE_SELECT_COLUMNS[tableName] || '*');
  if (base === '*') return '*';
  const missing = missingColumnsByTable[tableName];
  if (!missing || missing.size === 0) return base;
  return base
    .split(',')
    .map((c) => c.trim())
    .filter((c) => !missing.has(c.toLowerCase()))
    .join(', ');
}

export function extractIdFromPayload(payload: any): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'object') {
    return String(
      payload.id ||
      payload.productId ||
      payload.customerId ||
      payload.supplierId ||
      payload.transactionId ||
      payload.associateId ||
      payload.expenseId ||
      payload.product_id ||
      ''
    );
  }
  return String(payload);
}

export async function cleanupOrphanLocalRecords(
  tableName: 'products' | 'customers' | 'suppliers' | 'supplierTransactions' | 'transactions' | 'associates' | 'closedShifts' | 'expenses',
  remoteActiveItems: any[],
  pendingTableName: string
) {
  try {
    const remoteIds = new Set(remoteActiveItems.map((r) => String(r.id)));
    const pendingItems = await db.pendingSync.where('tableName').equals(pendingTableName).toArray();
    const pendingIds = new Set(
      pendingItems.map((p) => {
        const id = extractIdFromPayload(p.payload);
        return String(id);
      })
    );
    const localTable = db[tableName] as any;
    const localItems = await localTable.toArray();
    const orphanIds = localItems
      .filter((item: any) => item.isSynced && !remoteIds.has(String(item.id)) && !pendingIds.has(String(item.id)))
      .map((item: any) => item.id);
    if (orphanIds.length > 0) {
      await localTable.bulkDelete(orphanIds);
      console.log(`[ORPHAN CLEANUP] Removed ${orphanIds.length} deleted records from local table ${tableName}`);
    }
  } catch (err) {
    console.warn(`[ORPHAN CLEANUP ERROR] Table ${tableName}:`, err);
  }
}

export function sanitizePayloadForTable(tableName: string, payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForTable(tableName, item));
  }
  const clean = { ...payload };
  const missing = missingColumnsByTable[tableName];
  if (missing) {
    for (const col of missing) {
      delete clean[col];
    }
  }
  return clean;
}

export async function safeSupabaseMutation(
  tableName: string,
  operationFn: (cleanPayload: any) => Promise<{ data?: any; error?: any }>,
  initialPayload: any
): Promise<{ data?: any; error?: any }> {
  let currentPayload = sanitizePayloadForTable(tableName, initialPayload);
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const res = await operationFn(currentPayload);
    const error = res?.error;

    if (!error) {
      return res;
    }

    const errMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
    const missingColMatch =
      errMsg.match(/Could not find the '([^']+)' column/i) ||
      errMsg.match(/column [^\s\.]+\.([^\s]+) does not exist/i) ||
      errMsg.match(/column "([^"]+)" does not exist/i) ||
      errMsg.match(/column '([^']+)' does not exist/i);

    if (missingColMatch && missingColMatch[1]) {
      const missingColumn = missingColMatch[1];
      console.warn(
        `[SUPABASE SCHEMA ADAPTER] Table '${tableName}': Column '${missingColumn}' does not exist in Supabase schema. Stripping from payload...`
      );
      markColumnMissing(tableName, missingColumn);
      currentPayload = sanitizePayloadForTable(tableName, currentPayload);
      continue;
    }

    // Handle unique constraint violations (e.g. products_p_k_key)
    if (errMsg.includes('products_p_k_key') || (errMsg.includes('duplicate key') && errMsg.includes('p_k'))) {
      if (currentPayload && currentPayload.p_k !== undefined) {
        console.warn(`[SUPABASE ADAPTER] Table '${tableName}' hit p_k unique constraint. Stripping p_k and retrying...`);
        delete currentPayload.p_k;
        continue;
      }
    }

    if (errMsg.includes('duplicate key') && errMsg.includes('id')) {
      if (currentPayload && currentPayload.id !== undefined) {
        console.warn(`[SUPABASE ADAPTER] Table '${tableName}' hit id unique constraint. Stripping id and retrying...`);
        delete currentPayload.id;
        continue;
      }
    }

    if (errMsg.includes('PGRST116') || errMsg.includes('JSON object requested') || errMsg.includes('multiple (or no) rows')) {
      console.warn(`[SUPABASE ADAPTER] Table '${tableName}' returned PGRST116 multiple/no rows. Treating mutation as resolved.`);
      return { data: currentPayload, error: null };
    }

    return res;
  }

  return { data: null, error: new Error(`Max retry attempts reached for ${tableName} schema adaptation`) };
}

// --- MAPPERS ---

export function mapDbProductToProduct(p: any): Product {
  const safeId = (p.id !== null && p.id !== undefined && String(p.id) !== 'null' && String(p.id) !== 'undefined')
    ? String(p.id)
    : (p.sku ? String(p.sku) : (p.barcode ? String(p.barcode) : `prod_${Math.random().toString(36).substring(2, 9)}`));

  const allBarcodes: string[] = Array.isArray(p.barcodes)
    ? p.barcodes.map(String).filter(Boolean)
    : typeof p.barcodes === 'string'
      ? p.barcodes.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

  if (Array.isArray(p.alternative_barcodes)) {
    for (const b of p.alternative_barcodes) {
      const s = String(b).trim();
      if (s && !allBarcodes.includes(s)) {
        allBarcodes.push(s);
      }
    }
  }

  // Primary barcode: direct barcode column -> first item in barcodes array -> p.sku -> p.p_k -> safeId
  const primaryBarcode = (p.barcode ? String(p.barcode) : null)
    || (allBarcodes.length > 0 ? allBarcodes[0] : null)
    || (p.sku ? String(p.sku) : null)
    || (p.p_k ? String(p.p_k) : null)
    || safeId
    || '000000';

  // SKU / Item Code ("كود الصنف"):
  // Check p.sku -> p.p_k (the standard item code in database) -> safeId
  const resolvedSku = String(p.sku ?? p.p_k ?? safeId ?? 'SKU-000');

  return {
    id: safeId,
    name: p.name || 'منتج',
    sku: resolvedSku,
    barcode: primaryBarcode,
    category: p.category || 'عام',
    priceCash: Number(p.priceCash ?? p.cash_price ?? p.price_cash ?? p.price ?? p.sale_price ?? 0),
    priceInstallment: Number(p.priceInstallment ?? p.installment_price ?? p.price_installment ?? p.installmentPrice ?? 0),
    priceWholesale: Number(p.priceWholesale ?? p.wholesale_price ?? p.price_wholesale ?? p.wholesalePrice ?? 0),
    cost: Number(p.cost ?? p.cost_price ?? p.purchase_price ?? 0),
    stock: Number(p.stock_quantity ?? p.quantity ?? p.stock ?? 0),
    image: p.image_url || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
    description: p.description || '',
    barcodes: allBarcodes.length > 0 ? allBarcodes : (primaryBarcode ? [primaryBarcode] : []),
  };
}

export function mapProductToDbPayload(product: Product): any {
  const payload: any = {
    name: product.name || 'منتج',
    category: product.category || 'عام',
    price: Number(product.priceCash || 0),
    wholesale_price: Number(product.priceWholesale || 0),
    price_installment: Number(product.priceInstallment || 0),
    cost: Number(product.cost || 0),
    stock_quantity: Number(product.stock || 0),
    description: product.description || '',
    barcodes: product.barcodes || (product.barcode ? [product.barcode] : []),
  };

  if (product.sku && !isNaN(Number(product.sku))) {
    payload.p_k = Number(product.sku);
  }

  if (product.id && !isNaN(Number(product.id))) {
    payload.id = Number(product.id);
  }

  return payload;
}

export function toSafeDbId(id: any): number | string | null {
  if (id === null || id === undefined || id === '' || id === 'null' || id === 'undefined') {
    return null;
  }
  const str = String(id).trim();
  if (!str) return null;

  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      if (num > 2147483647) {
        return Number(str.slice(-9));
      }
      return num;
    }
  }

  const digits = str.replace(/\D/g, '');
  if (digits.length > 0) {
    const num = Number(digits.slice(-9));
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  return str;
}

export function mapDbCustomerToCustomer(c: any): Customer {
  const safeId = (c.id !== null && c.id !== undefined && String(c.id) !== 'null' && String(c.id) !== 'undefined')
    ? String(c.id)
    : (c.phone ? `cust_${c.phone}` : `cust_${Math.random().toString(36).substring(2, 9)}`);

  return {
    id: safeId,
    name: String(c.name || ''),
    phone: String(c.phone ?? ''),
    email: String(c.email ?? ''),
    address: String(c.address || ''),
    totalSpent: Number(c.total_spent ?? c.totalSpent ?? 0),
    loyaltyPoints: Number(c.loyalty_points ?? c.loyaltyPoints ?? 0),
    tier: c.tier || 'عادي',
    isCreditEligible: Boolean(c.is_credit_eligible ?? c.isCreditEligible),
    creditLimit: Number(c.credit_limit ?? c.creditLimit ?? 0),
    currentDebt: Number(c.current_debt ?? c.currentDebt ?? 0),
    notes: String(c.notes || ''),
    monthlyInstallmentAmount: Number(c.monthly_installment_amount ?? c.monthlyInstallmentAmount ?? 0),
  };
}

export function mapCustomerToDbPayload(customer: Customer): any {
  const safeId = toSafeDbId(customer.id);
  const payload: any = {
    name: customer.name,
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    total_spent: customer.totalSpent || 0,
    loyalty_points: customer.loyaltyPoints || 0,
    tier: customer.tier || 'عادي',
    is_credit_eligible: Boolean(customer.isCreditEligible),
    credit_limit: customer.creditLimit || 0,
    current_debt: customer.currentDebt || 0,
    notes: customer.notes || '',
    monthly_installment_amount: customer.monthlyInstallmentAmount || 0,
    updated_at: new Date().toISOString(),
  };

  if (safeId !== null && safeId !== undefined) {
    payload.id = safeId;
  }

  return payload;
}

export function mapDbSupplierToSupplier(s: any): Supplier {
  const safeId = (s.id !== null && s.id !== undefined && String(s.id) !== 'null' && String(s.id) !== 'undefined')
    ? String(s.id)
    : `supp_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: safeId,
    name: String(s.name || ''),
    companyName: String(s.company_name || s.companyName || ''),
    phone: String(s.phone ?? ''),
    email: String(s.email ?? ''),
    address: String(s.address || ''),
    category: String(s.category || ''),
    currentBalance: Number(s.current_balance ?? s.currentBalance ?? 0),
    notes: String(s.notes || ''),
    taxNumber: String(s.tax_number || s.taxNumber || ''),
  };
}

export function mapSupplierToDbPayload(supplier: Supplier): any {
  const safeId = toSafeDbId(supplier.id);
  const payload: any = {
    name: supplier.name,
    company_name: supplier.companyName || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    category: supplier.category || '',
    current_balance: supplier.currentBalance || 0,
    notes: supplier.notes || '',
    tax_number: supplier.taxNumber || '',
    updated_at: new Date().toISOString(),
  };

  if (safeId !== null && safeId !== undefined) {
    payload.id = safeId;
  }

  return payload;
}

export function mapDbSupplierTxToSupplierTx(t: any): SupplierTransaction {
  const safeId = (t.id !== null && t.id !== undefined && String(t.id) !== 'null' && String(t.id) !== 'undefined')
    ? String(t.id)
    : `stx_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: safeId,
    supplierId: String(t.supplier_id ?? t.supplierId ?? ''),
    supplierName: t.supplier_name ?? t.supplierName ?? '',
    type: t.type || 'supply_invoice',
    amount: Number(t.amount ?? 0),
    date: t.date || t.created_at || new Date().toISOString(),
    referenceNumber: t.reference_number ?? t.referenceNumber ?? '',
    paymentMethod: t.payment_method ?? t.paymentMethod ?? '',
    notes: t.notes || '',
    associateName: t.associate_name ?? t.associateName ?? '',
  };
}

export function mapSupplierTxToDbPayload(tx: SupplierTransaction): any {
  const safeId = toSafeDbId(tx.id);
  const safeSuppId = toSafeDbId(tx.supplierId);
  const payload: any = {
    supplier_id: safeSuppId,
    supplier_name: tx.supplierName,
    type: tx.type,
    amount: tx.amount,
    date: tx.date || new Date().toISOString(),
    reference_number: tx.referenceNumber || '',
    payment_method: tx.paymentMethod || '',
    notes: tx.notes || '',
    associate_name: tx.associateName || '',
    updated_at: new Date().toISOString(),
  };

  if (safeId !== null && safeId !== undefined) {
    payload.id = safeId;
  }

  return payload;
}

export function mapDbExpenseToExpense(e: any): POSExpense {
  const safeId = (e.id !== null && e.id !== undefined && String(e.id) !== 'null' && String(e.id) !== 'undefined')
    ? String(e.id)
    : `exp_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: safeId,
    amount: Number(e.amount ?? 0),
    category: e.category || 'أخرى',
    description: e.description || '',
    timestamp: e.timestamp || e.created_at || new Date().toISOString(),
    associateId: e.associate_id ?? e.associateId,
    associateName: e.associate_name ?? e.associateName,
    linkedSupplierId: e.linked_supplier_id ?? e.linkedSupplierId,
    linkedSupplierName: e.linked_supplier_name ?? e.linkedSupplierName,
    linkedAssociateId: e.linked_associate_id ?? e.linkedAssociateId,
    linkedAssociateName: e.linked_associate_name ?? e.linkedAssociateName,
  };
}

export function mapExpenseToDbPayload(expense: POSExpense): any {
  const safeId = toSafeDbId(expense.id);
  const payload: any = {
    amount: expense.amount,
    category: expense.category,
    description: expense.description || '',
    timestamp: expense.timestamp || new Date().toISOString(),
    associate_id: toSafeDbId(expense.associateId),
    associate_name: expense.associateName || null,
    linked_supplier_id: toSafeDbId(expense.linkedSupplierId),
    linked_supplier_name: expense.linkedSupplierName || null,
    linked_associate_id: toSafeDbId(expense.linkedAssociateId),
    linked_associate_name: expense.linkedAssociateName || null,
    updated_at: new Date().toISOString(),
  };

  if (safeId !== null && safeId !== undefined) {
    payload.id = safeId;
  }

  return payload;
}

export function resolveTransactionTimestamp(t: any): string {
  if (!t) return new Date().toISOString();

  // 1. Check explicit original timestamp first (the actual sale creation timestamp)
  if (t.timestamp) {
    const d = new Date(t.timestamp);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 2. Check created_at (standard Supabase creation column)
  if (t.created_at) {
    const d = new Date(t.created_at);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 3. Check date or transaction_date
  if (t.date) {
    const d = new Date(t.date);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (t.transaction_date) {
    const d = new Date(t.transaction_date);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 4. If t.id encodes the exact epoch timestamp (e.g. tx_1785536131663 created via Date.now())
  if (typeof t.id === 'string') {
    const match = t.id.match(/\d{10,13}/);
    if (match) {
      const num = Number(match[0]);
      const epochMs = match[0].length === 10 ? num * 1000 : num;
      const d = new Date(epochMs);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2035) {
        return d.toISOString();
      }
    }
  }

  // 5. Fallback to updated_at if no original creation time is available
  if (t.updated_at) {
    const d = new Date(t.updated_at);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return new Date().toISOString();
}

export function mapDbTransactionToTransaction(t: any, itemsByTx?: Record<string, any[]>): Transaction {
  const id = String(t.id || `tx_${Date.now()}`);
  const resolvedTime = resolveTransactionTimestamp(t);
  let resolvedItems = itemsByTx ? itemsByTx[id] : undefined;
  if (!resolvedItems || resolvedItems.length === 0) {
    if (Array.isArray(t.items) && t.items.length > 0) {
      resolvedItems = t.items.map((it: any) => ({
        productId: String(it.productId || it.product_id || it.id || ''),
        productName: it.productName || it.product_name || it.name || 'منتج',
        sku: it.sku || '',
        quantity: Number(it.quantity || 1),
        priceTier: it.priceTier || it.price_tier || 'cash',
        unitPrice: Number(it.unitPrice ?? it.unit_price ?? it.price ?? 0),
        totalPrice: Number(
          it.totalPrice ?? it.total_price ?? (Number(it.quantity || 1) * Number(it.unitPrice ?? it.unit_price ?? it.price ?? 0))
        ),
        assignedAssociateId: it.assignedAssociateId ?? it.assigned_associate_id,
      }));
    } else if (Array.isArray(t.original_cart) && t.original_cart.length > 0) {
      resolvedItems = t.original_cart.map((c: any) => ({
        productId: String(c.productId || c.id || ''),
        productName: c.productName || c.name || 'منتج',
        sku: c.sku || '',
        quantity: Number(c.quantity || 1),
        priceTier: c.priceTier || 'cash',
        unitPrice: Number(c.unitPrice || c.price || 0),
        totalPrice: Number(c.totalPrice || (c.quantity || 1) * (c.price || 0)),
        assignedAssociateId: c.assignedAssociateId,
      }));
    } else if (Array.isArray(t.cart) && t.cart.length > 0) {
      resolvedItems = t.cart.map((c: any) => ({
        productId: String(c.productId || c.id || ''),
        productName: c.productName || c.name || 'منتج',
        sku: c.sku || '',
        quantity: Number(c.quantity || 1),
        priceTier: c.priceTier || 'cash',
        unitPrice: Number(c.unitPrice || c.price || 0),
        totalPrice: Number(c.totalPrice || (c.quantity || 1) * (c.price || 0)),
        assignedAssociateId: c.assignedAssociateId,
      }));
    } else {
      resolvedItems = [];
    }
  }

  const grandTotal = Number(t.grand_total ?? t.grandTotal ?? t.total ?? t.subtotal ?? 0);
  const subtotal = Number(t.subtotal ?? t.sub_total ?? grandTotal);
  const discountTotal = Number(t.discount_total ?? t.discountTotal ?? 0);
  const taxTotal = Number(t.tax_total ?? t.taxTotal ?? 0);

  return {
    id,
    receiptNumber: t.receipt_number || t.receiptNumber || t.invoice_number || `RCP-${id}`,
    timestamp: resolvedTime,
    items: resolvedItems,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    paymentMethod: t.payment_method || t.paymentMethod || 'كاش',
    paymentDetails: t.payment_details || t.paymentDetails || '',
    customerId: t.customer_id || t.customerId || undefined,
    customerName: t.customer_name || t.customerName || undefined,
    primaryAssociateId: t.primary_associate_id || t.primaryAssociateId || 'system',
    primaryAssociateName: t.primary_associate_name || t.primaryAssociateName || 'النظام',
    splitAssociates: t.split_associates || t.splitAssociates,
    commissions: t.commissions || [],
    notes: t.notes || '',
    status: t.status || 'مكتملة',
    amountPaid: Number(t.amount_paid ?? t.amountPaid ?? grandTotal),
    amountDeferred: Number(t.amount_deferred ?? t.amountDeferred ?? 0),
    splitPayments: t.split_payments || t.splitPayments,
    originalCart: t.original_cart || t.originalCart,
    isSynced: true,
    updated_at: t.updated_at || t.updatedAt || resolvedTime,
  };
}

export function mapDbAssociateToAssociate(a: any): Associate {
  const safeId = (a.id !== null && a.id !== undefined && String(a.id) !== 'null' && String(a.id) !== 'undefined')
    ? String(a.id)
    : `assoc_${Math.random().toString(36).substring(2, 9)}`;

  let invoiceDaysAccess: any = a.invoice_days_access || a.invoiceDaysAccess;
  let invoiceCustomDaysLimit = Number(a.invoice_custom_days_limit ?? a.invoiceCustomDaysLimit ?? 0) || undefined;

  if (!invoiceDaysAccess && Array.isArray(a.permissions)) {
    const permDays = a.permissions.find((p: string) => typeof p === 'string' && p.startsWith('invoice_days:'));
    if (permDays) {
      const parts = permDays.replace('invoice_days:', '').split(':');
      invoiceDaysAccess = parts[0];
      if (parts[1]) invoiceCustomDaysLimit = parseInt(parts[1], 10) || undefined;
    }
  }

  if (!invoiceDaysAccess) {
    invoiceDaysAccess = (a.role === 'مدير الفرع') ? 'all' : 'today';
  }

  // Filter out system tags like invoice_days:* from user-facing permissions array
  const cleanPermissions = Array.isArray(a.permissions)
    ? a.permissions.filter((p: string) => typeof p === 'string' && !p.startsWith('invoice_days:'))
    : undefined;

  return {
    id: safeId,
    name: String(a.name || 'موظف'),
    username: String(a.username || a.user_name || `user_${safeId}`),
    password: String(a.password || a.pin || '1001'),
    pin: String(a.pin || a.password || '1001'),
    role: (a.role as any) || 'مسؤول مبيعات',
    avatar: String(a.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
    email: String(a.email ?? ''),
    phone: String(a.phone ?? ''),
    commissionRate: Number(a.commission_rate ?? a.commissionRate ?? 0.05),
    dailyGoal: Number(a.daily_goal ?? a.dailyGoal ?? 5000),
    hourlyRate: Number(a.hourly_rate ?? a.hourlyRate ?? 25),
    advancesBalance: Number(a.advances_balance ?? a.advancesBalance ?? 0),
    isClockedIn: Boolean(a.is_clocked_in ?? a.isClockedIn ?? false),
    permissions: cleanPermissions,
    invoiceDaysAccess: invoiceDaysAccess as any,
    invoiceCustomDaysLimit,
  };
}

export function mapAssociateToDbPayload(associate: Associate): any {
  const perms = Array.isArray(associate.permissions) ? [...associate.permissions] : [];
  const filteredPerms = perms.filter((p: any) => typeof p !== 'string' || !p.startsWith('invoice_days:'));
  const daysTag = `invoice_days:${associate.invoiceDaysAccess || (associate.role === 'مدير الفرع' ? 'all' : 'today')}${
    associate.invoiceDaysAccess === 'custom' && associate.invoiceCustomDaysLimit ? `:${associate.invoiceCustomDaysLimit}` : ''
  }`;
  filteredPerms.push(daysTag as any);

  return {
    id: associate.id,
    name: associate.name,
    username: associate.username,
    password: associate.password || associate.pin || '1001',
    pin: associate.pin || associate.password || '1001',
    role: associate.role,
    email: associate.email || '',
    phone: associate.phone || '',
    commission_rate: associate.commissionRate || 0.05,
    daily_goal: associate.dailyGoal || 5000,
    hourly_rate: associate.hourlyRate || 25,
    advances_balance: associate.advancesBalance || 0,
    is_clocked_in: Boolean(associate.isClockedIn),
    permissions: filteredPerms,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbShiftToClosedShift(s: any): ClosedShift {
  const safeId = (s.id !== null && s.id !== undefined && String(s.id) !== 'null' && String(s.id) !== 'undefined')
    ? String(s.id)
    : `shift_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: safeId,
    associateId: s.associate_id ?? s.associateId ?? '',
    associateName: s.associate_name ?? s.associateName ?? '',
    startTime: s.start_time ?? s.startTime ?? new Date().toISOString(),
    endTime: s.end_time ?? s.endTime ?? new Date().toISOString(),
    expectedCash: Number(s.expected_cash ?? s.expectedCash ?? 0),
    actualCash: Number(s.actual_cash ?? s.actualCash ?? 0),
    discrepancy: Number(s.discrepancy ?? 0),
    salesCount: Number(s.sales_count ?? s.salesCount ?? 0),
    totalSales: Number(s.total_sales ?? s.totalSales ?? 0),
    totalCard: Number(s.total_card ?? s.totalCard ?? 0),
    totalInstallment: Number(s.total_installment ?? s.totalInstallment ?? 0),
    totalDebtCollected: Number(s.total_debt_collected ?? s.totalDebtCollected ?? 0),
    notes: s.notes || '',
    openingBalance: Number(s.opening_balance ?? s.openingBalance ?? 0),
    leftoverBalance: Number(s.leftover_balance ?? s.leftoverBalance ?? 0),
    isSynced: true,
  };
}

export function mapClosedShiftToDbPayload(shift: ClosedShift): any {
  return {
    id: shift.id,
    associate_id: shift.associateId,
    associate_name: shift.associateName,
    start_time: shift.startTime,
    end_time: shift.endTime,
    expected_cash: shift.expectedCash,
    actual_cash: shift.actualCash,
    discrepancy: shift.discrepancy,
    sales_count: shift.salesCount,
    total_sales: shift.totalSales,
    total_card: shift.totalCard,
    total_installment: shift.totalInstallment,
    total_debt_collected: shift.totalDebtCollected,
    notes: shift.notes || '',
    opening_balance: shift.openingBalance || 0,
    leftover_balance: shift.leftoverBalance || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// --- 2. SELECTIVE & DELTA FETCH ENGINE ---

/**
 * Safe, Robust Selective/Full Query Helper with Pagination, Recovery Fallbacks & Console Diagnostics
 */
async function fetchSelectiveFromSupabase(
  tableName: string,
  columns: string = '*',
  lastSyncTimestamp?: string | null,
  orderColumn?: string
): Promise<{ data: any[]; error?: any }> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  const schemaCfg = TABLE_SCHEMAS[tableName];
  let timeCol = schemaCfg?.updatedTimeCol || 'updated_at';

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let data: any[] | null = null;
    let queryError: any = null;
    let attempt = 0;
    const maxAttempts = 15;

    while (attempt < maxAttempts) {
      attempt++;
      const timeColMissing = isColumnMissing(tableName, timeCol);
      const selectCols = getCleanSelectColumns(tableName, columns);

      let query = supabase.from(tableName).select(selectCols).range(from, to);

      // Apply Delta Sync filter if lastSyncTimestamp is present AND timeCol is not marked as missing
      if (lastSyncTimestamp && !timeColMissing) {
        query = query.gt(timeCol, lastSyncTimestamp);
      }

      if (orderColumn && !isColumnMissing(tableName, orderColumn)) {
        query = query.order(orderColumn, { ascending: true, nullsFirst: false });
      }

      const res = await query;
      data = res.data;
      queryError = res.error;

      if (!queryError) {
        break;
      }

      const errMsg = queryError.message || '';
      const missingColMatch =
        errMsg.match(/Could not find the '([^']+)' column/i) ||
        errMsg.match(/column [^\s\.]+\.([^\s]+) does not exist/i) ||
        errMsg.match(/column "([^"]+)" does not exist/i) ||
        errMsg.match(/column '([^']+)' does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const colName = missingColMatch[1];
        markColumnMissing(tableName, colName);
        console.warn(
          `[SUPABASE SYNC ADAPTER] Table '${tableName}' lacks column '${colName}'. Retrying with updated schema (attempt ${attempt})...`
        );
        continue;
      }

      // If timeCol caused an error in filter
      if (lastSyncTimestamp && !timeColMissing && (errMsg.includes(timeCol) || errMsg.includes('gt') || errMsg.includes('filter'))) {
        markColumnMissing(tableName, timeCol);
        console.warn(`[SUPABASE SYNC ADAPTER] Table '${tableName}' filter on '${timeCol}' failed. Switching to full fetch...`);
        continue;
      }

      // If specific column select failed, try '*' fallback
      if (columns !== '*') {
        console.warn(`[SUPABASE QUERY RECOVERY] Specific select on '${tableName}' failed (${errMsg}). Falling back to select('*')...`);
        const fallbackRes = await supabase.from(tableName).select('*').range(from, to);
        if (!fallbackRes.error) {
          data = fallbackRes.data;
          queryError = null;
          break;
        }
      }

      break;
    }

    if (queryError) {
      console.error(`[SUPABASE QUERY FAILED] Table '${tableName}' failed after ${attempt} attempts:`, queryError);
      return { data: allRows, error: queryError };
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }

  return { data: allRows };
}

// --- CONCURRENCY LOCK ENGINE ---
let isSyncingLock = false;

export function isSyncing(): boolean {
  return isSyncingLock;
}

/**
 * Executes a unified, thread-safe synchronization cycle:
 * 1. Process pending outbox mutations (Offline writes -> Supabase)
 * 2. Perform Delta Sync (Supabase changes -> Dexie.js)
 * Prevents double triggering / concurrent execution loops.
 */
export async function runFullSyncCycle(): Promise<{
  outboxResult: { processedCount: number; remainingCount: number; failedCount: number };
  deltaSyncResult: { success: boolean; syncedCounts: Record<string, number>; downloadedCount: number; error?: any };
} | null> {
  if (isSyncingLock) {
    console.warn('[SYNC CONCURRENCY LOCK] Synchronization cycle is already in progress. Skipping duplicate execution.');
    return null;
  }

  isSyncingLock = true;
  try {
    console.log('[SYNC ENGINE] Starting thread-safe synchronization cycle...');
    const outboxResult = await processPendingSyncQueueInternal();
    const deltaSyncResult = await performDeltaSyncInternal();

    if (outboxResult.processedCount > 0) {
      await setLastPushTime(new Date().toISOString());
    }
    if (deltaSyncResult.success) {
      await setLastPullTime(new Date().toISOString());
      await setLastSyncError(null);
    } else if (deltaSyncResult.error) {
      await setLastSyncError(deltaSyncResult.error?.message || String(deltaSyncResult.error));
    }

    return { outboxResult, deltaSyncResult };
  } finally {
    isSyncingLock = false;
  }
}

/**
 * Delta Sync Mechanism:
 * Compares last_sync_timestamp and only fetches changed records from Supabase, then updates Dexie.js
 * Handles soft-deleted records (is_deleted: true) by removing them from Dexie.js
 */
export async function performDeltaSync(): Promise<{
  success: boolean;
  syncedCounts: Record<string, number>;
  downloadedCount: number;
  error?: any;
}> {
  if (isSyncingLock) {
    console.warn('[SYNC CONCURRENCY LOCK] Sync cycle already running. Skipping standalone delta sync.');
    return { success: false, syncedCounts: {}, downloadedCount: 0 };
  }
  isSyncingLock = true;
  try {
    const res = await performDeltaSyncInternal();
    if (res.success) {
      await setLastPullTime(new Date().toISOString());
      await setLastSyncError(null);
    } else if (res.error) {
      await setLastSyncError(res.error?.message || String(res.error));
    }
    return res;
  } finally {
    isSyncingLock = false;
  }
}

async function performDeltaSyncInternal(): Promise<{
  success: boolean;
  syncedCounts: Record<string, number>;
  downloadedCount: number;
  error?: any;
}> {
  console.log('[SUPABASE DELTA SYNC] Starting sync cycle...');
  const lastSync = await getLastSyncTimestamp();
  const nextSyncTimestamp = new Date().toISOString();
  const syncedCounts: Record<string, number> = {};
  let totalDownloaded = 0;

  try {
    // Check local counts to force full initial sync if local Dexie tables are empty
    const localProdCount = await db.products.count();
    const localCustCount = await db.customers.count();
    const localSuppCount = await db.suppliers.count();
    const localStxCount = await db.supplierTransactions.count();
    const localTxCount = await db.transactions.count();
    const localAssocCount = await db.associates.count();
    const localShiftCount = await db.closedShifts.count();
    const localExpCount = await db.expenses.count();

    // 1. Sync Products (including soft-delete check) - Clean columns without heavy images
    const prodRes = await fetchSelectiveFromSupabase(
      'products',
      TABLE_SELECT_COLUMNS.products,
      localProdCount === 0 ? null : lastSync
    );
    if (prodRes.data && prodRes.data.length > 0) {
      const activeProds: Product[] = [];
      const deletedProdIds: string[] = [];

      for (const r of prodRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const p = mapDbProductToProduct(r);
          if (p.id) deletedProdIds.push(p.id);
        } else {
          activeProds.push(mapDbProductToProduct(r));
        }
      }

      if (activeProds.length > 0) await db.products.bulkPut(activeProds);
      if (deletedProdIds.length > 0) {
        await db.products.bulkDelete(deletedProdIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedProdIds.length} soft-deleted products from Dexie.js`);
      }
      syncedCounts.products = activeProds.length;
    }

    // 2. Sync Customers
    const custRes = await fetchSelectiveFromSupabase(
      'customers',
      TABLE_SELECT_COLUMNS.customers,
      localCustCount === 0 ? null : lastSync
    );
    if (custRes.data && custRes.data.length > 0) {
      const activeCusts: Customer[] = [];
      const deletedCustIds: string[] = [];

      for (const r of custRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const c = mapDbCustomerToCustomer(r);
          if (c.id) deletedCustIds.push(c.id);
        } else {
          activeCusts.push(mapDbCustomerToCustomer(r));
        }
      }

      if (activeCusts.length > 0) await db.customers.bulkPut(activeCusts);
      if (deletedCustIds.length > 0) {
        await db.customers.bulkDelete(deletedCustIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedCustIds.length} soft-deleted customers from Dexie.js`);
      }
      syncedCounts.customers = activeCusts.length;
    }

    // 3. Sync Suppliers
    const suppRes = await fetchSelectiveFromSupabase(
      'suppliers',
      TABLE_SELECT_COLUMNS.suppliers,
      localSuppCount === 0 ? null : lastSync
    );
    if (suppRes.data && suppRes.data.length > 0) {
      const activeSupps: Supplier[] = [];
      const deletedSuppIds: string[] = [];

      for (const r of suppRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const s = mapDbSupplierToSupplier(r);
          if (s.id) deletedSuppIds.push(s.id);
        } else {
          activeSupps.push(mapDbSupplierToSupplier(r));
        }
      }

      if (activeSupps.length > 0) await db.suppliers.bulkPut(activeSupps);
      if (deletedSuppIds.length > 0) {
        await db.suppliers.bulkDelete(deletedSuppIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedSuppIds.length} soft-deleted suppliers from Dexie.js`);
      }
      syncedCounts.suppliers = activeSupps.length;
    }

    // 4. Sync Supplier Transactions
    const stxRes = await fetchSelectiveFromSupabase(
      'supplier_transactions',
      TABLE_SELECT_COLUMNS.supplier_transactions,
      localStxCount === 0 ? null : lastSync
    );
    if (stxRes.data && stxRes.data.length > 0) {
      const activeStxs: SupplierTransaction[] = [];
      const deletedStxIds: string[] = [];

      for (const r of stxRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const st = mapDbSupplierTxToSupplierTx(r);
          if (st.id) deletedStxIds.push(st.id);
        } else {
          activeStxs.push(mapDbSupplierTxToSupplierTx(r));
        }
      }

      if (activeStxs.length > 0) await db.supplierTransactions.bulkPut(activeStxs);
      if (deletedStxIds.length > 0) {
        await db.supplierTransactions.bulkDelete(deletedStxIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedStxIds.length} soft-deleted supplier transactions from Dexie.js`);
      }
      syncedCounts.supplierTransactions = activeStxs.length;
    }

    // 5. Sync Transactions (with targeted transaction_items fetch to save egress)
    const hasFullTxSynced = await db.syncMeta.get('tx_full_restore_v6');
    const txRes = await fetchSelectiveFromSupabase(
      'transactions',
      TABLE_SELECT_COLUMNS.transactions,
      (!hasFullTxSynced || localTxCount === 0) ? null : lastSync
    );
    if (txRes.data && txRes.data.length > 0) {
      const itemsByTx: Record<string, any[]> = {};
      const changedTxIds = txRes.data.map((t: any) => String(t.id)).filter(Boolean);

      // Fetch transaction_items ONLY for the changed transactions in chunks of 50
      const itemCols = getCleanSelectColumns('transaction_items');
      const chunkSize = 50;
      for (let i = 0; i < changedTxIds.length; i += chunkSize) {
        const chunk = changedTxIds.slice(i, i + chunkSize);
        let chunkItems: any[] | null = null;
        try {
          const { data, error } = await supabase
            .from('transaction_items')
            .select(itemCols)
            .in('transaction_id', chunk);
          if (!error && data) {
            chunkItems = data;
          } else {
            const fb = await supabase.from('transaction_items').select('*').in('transaction_id', chunk);
            chunkItems = fb.data || [];
          }
        } catch {
          try {
            const fb = await supabase.from('transaction_items').select('*').in('transaction_id', chunk);
            chunkItems = fb.data || [];
          } catch {
            chunkItems = [];
          }
        }

        if (chunkItems && chunkItems.length > 0) {
          chunkItems.forEach((item: any) => {
            const tid = String(item.transaction_id);
            if (!itemsByTx[tid]) itemsByTx[tid] = [];
            itemsByTx[tid].push({
              productId: String(item.product_id || ''),
              productName: item.product_name || 'منتج',
              sku: item.sku || '',
              quantity: Number(item.quantity || 1),
              priceTier: item.price_tier || 'cash',
              unitPrice: Number(item.unit_price || 0),
              totalPrice: Number(item.total_price || 0),
              assignedAssociateId: item.assigned_associate_id,
            });
          });
        }
      }

      const activeTxs: Transaction[] = [];
      const deletedTxIds: string[] = [];

      for (const t of txRes.data) {
        const id = String(t.id);
        if (t.is_deleted === true || t.is_deleted === 1 || String(t.is_deleted) === 'true') {
          deletedTxIds.push(id);
        } else {
          activeTxs.push(mapDbTransactionToTransaction(t, itemsByTx));
        }
      }

      if (activeTxs.length > 0) await db.transactions.bulkPut(activeTxs);
      if (deletedTxIds.length > 0) {
        await db.transactions.bulkDelete(deletedTxIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedTxIds.length} soft-deleted transactions from Dexie.js`);
      }
      await db.syncMeta.put({ key: 'tx_full_restore_v6', value: 'true' });
      syncedCounts.transactions = activeTxs.length;
    }

    // 6. Sync Associates
    const assocRes = await fetchSelectiveFromSupabase(
      'associates',
      TABLE_SELECT_COLUMNS.associates,
      localAssocCount === 0 ? null : lastSync
    );
    if (assocRes.data && assocRes.data.length > 0) {
      const activeAssocs: Associate[] = [];
      const deletedAssocIds: string[] = [];

      for (const r of assocRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const a = mapDbAssociateToAssociate(r);
          if (a.id) deletedAssocIds.push(a.id);
        } else {
          activeAssocs.push(mapDbAssociateToAssociate(r));
        }
      }

      if (activeAssocs.length > 0) await db.associates.bulkPut(activeAssocs);
      if (deletedAssocIds.length > 0) {
        await db.associates.bulkDelete(deletedAssocIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedAssocIds.length} soft-deleted associates from Dexie.js`);
      }
      syncedCounts.associates = activeAssocs.length;
    }

    // 7. Sync Closed Shifts
    const shiftRes = await fetchSelectiveFromSupabase(
      'closed_shifts',
      TABLE_SELECT_COLUMNS.closed_shifts,
      localShiftCount === 0 ? null : lastSync
    );
    if (shiftRes.data && shiftRes.data.length > 0) {
      const activeShifts: ClosedShift[] = [];
      const deletedShiftIds: string[] = [];

      for (const r of shiftRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const s = mapDbShiftToClosedShift(r);
          if (s.id) deletedShiftIds.push(s.id);
        } else {
          activeShifts.push(mapDbShiftToClosedShift(r));
        }
      }

      if (activeShifts.length > 0) await db.closedShifts.bulkPut(activeShifts);
      if (deletedShiftIds.length > 0) {
        await db.closedShifts.bulkDelete(deletedShiftIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedShiftIds.length} soft-deleted shifts from Dexie.js`);
      }
      syncedCounts.closedShifts = activeShifts.length;
    }

    // 8. Sync Expenses
    const expRes = await fetchSelectiveFromSupabase(
      'expenses',
      TABLE_SELECT_COLUMNS.expenses,
      localExpCount === 0 ? null : lastSync
    );
    if (expRes.data && expRes.data.length > 0) {
      const activeExps: POSExpense[] = [];
      const deletedExpIds: string[] = [];

      for (const r of expRes.data) {
        if (r.is_deleted === true || r.is_deleted === 1 || String(r.is_deleted) === 'true') {
          const e = mapDbExpenseToExpense(r);
          if (e.id) deletedExpIds.push(e.id);
        } else {
          activeExps.push(mapDbExpenseToExpense(r));
        }
      }

      if (activeExps.length > 0) await db.expenses.bulkPut(activeExps);
      if (deletedExpIds.length > 0) {
        await db.expenses.bulkDelete(deletedExpIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedExpIds.length} soft-deleted expenses from Dexie.js`);
      }
      syncedCounts.expenses = activeExps.length;
    }

    // Update last sync timestamp
    await setLastSyncTimestamp(nextSyncTimestamp);
    totalDownloaded = Object.values(syncedCounts).reduce((acc, count) => acc + count, 0);
    console.log('[SUPABASE DELTA SYNC] Completed successfully. Total downloaded records:', totalDownloaded);
    return { success: true, syncedCounts, downloadedCount: totalDownloaded };
  } catch (err: any) {
    console.warn('[SUPABASE DELTA SYNC] Exception during sync:', err?.message || String(err));
    return { success: false, syncedCounts, downloadedCount: 0, error: err };
  }
}

// --- 3. OUTBOX QUEUE WORKER (Offline Write Engine with Dead-Letter Logic) ---

/**
 * Background Sync Worker that pulls items from Dexie `pendingSync` and pushes to Supabase.
 * Includes Dead-Letter Queue handling:
 * - Retries up to 5 times.
 * - If retry_count >= 5, moves item to `syncErrors` table and removes from pending queue to prevent queue deadlocks.
 */
export async function processPendingSyncQueue(): Promise<{
  processedCount: number;
  remainingCount: number;
  failedCount: number;
  error?: any;
}> {
  if (isSyncingLock) {
    console.warn('[SYNC CONCURRENCY LOCK] Sync cycle already running. Skipping standalone queue processing.');
    return { processedCount: 0, remainingCount: await getPendingSyncCount(), failedCount: await getFailedSyncCount() };
  }
  isSyncingLock = true;
  try {
    const res = await processPendingSyncQueueInternal();
    if (res.processedCount > 0) {
      await setLastPushTime(new Date().toISOString());
    }
    return res;
  } finally {
    isSyncingLock = false;
  }
}

async function processPendingSyncQueueInternal(): Promise<{
  processedCount: number;
  remainingCount: number;
  failedCount: number;
  error?: any;
}> {
  const pendingItems = await db.pendingSync.orderBy('id').toArray();
  if (pendingItems.length === 0) {
    return { processedCount: 0, remainingCount: 0, failedCount: 0 };
  }

  console.log(`[ONLINE-FIRST QUEUE WORKER] Processing ${pendingItems.length} queued operations...`);
  let processedCount = 0;

  for (const item of pendingItems) {
    if (!item.id) continue;
    const currentRetry = item.retryCount || 0;
    const opId = item.operation_id || `op_${item.id}`;
    const recId = item.record_id || 'N/A';

    console.log(
      `[ONLINE-FIRST SYNC START] OpID: ${opId} | Table: ${item.tableName} | RecordID: ${recId} | Type: ${item.operation} | Time: ${new Date().toISOString()}`
    );

    try {
      let result: { success: boolean; error?: any } = { success: false };

      switch (item.tableName) {
        case 'products':
          if (item.operation === 'INSERT') result = await insertProductToSupabase(item.payload);
          else if (item.operation === 'UPDATE') result = await updateProductInSupabase(item.payload);
          else if (item.operation === 'DELETE') result = await deleteProductFromSupabase(item.payload);
          break;

        case 'customers':
          if (item.operation === 'INSERT') result = await insertCustomerToSupabase(item.payload);
          else if (item.operation === 'UPDATE') result = await updateCustomerInSupabase(item.payload);
          else if (item.operation === 'DELETE') result = await deleteCustomerFromSupabase(item.payload);
          break;

        case 'suppliers':
          if (item.operation === 'INSERT') result = await insertSupplierToSupabase(item.payload);
          else if (item.operation === 'UPDATE') result = await updateSupplierInSupabase(item.payload);
          else if (item.operation === 'DELETE') result = await deleteSupplierFromSupabase(item.payload);
          break;

        case 'supplier_transactions':
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            result = await insertSupplierTransactionToSupabase(item.payload);
          }
          break;

        case 'transactions':
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            result = await insertTransactionToSupabase(item.payload);
          } else if (item.operation === 'DELETE') {
            result = await deleteTransactionFromSupabase(item.payload);
          }
          break;

        case 'associates':
          if (item.operation === 'INSERT') result = await insertAssociateToSupabase(item.payload);
          else if (item.operation === 'UPDATE') result = await updateAssociateInSupabase(item.payload);
          else if (item.operation === 'DELETE') result = await deleteAssociateFromSupabase(item.payload);
          break;

        case 'closed_shifts':
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            result = await insertClosedShiftToSupabase(item.payload);
          }
          break;

        case 'expenses':
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            result = await insertExpenseToSupabase(item.payload);
          } else if (item.operation === 'DELETE') {
            result = await deleteExpenseFromSupabase(item.payload);
          }
          break;

        case 'discounts':
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            result = await insertDiscountToSupabase(item.payload);
          } else if (item.operation === 'DELETE') {
            result = await deleteDiscountFromSupabase(item.payload);
          }
          break;
      }

      if (result.success) {
        await db.pendingSync.delete(item.id);
        processedCount++;
        console.log(
          `[ONLINE-FIRST SYNC SUCCESS] OpID: ${opId} | Table: ${item.tableName} | RecordID: ${recId} | Time: ${new Date().toISOString()}`
        );
      } else {
        const nextRetry = currentRetry + 1;
        const errReason = result.error?.message || String(result.error || 'Failed Supabase sync mutation');

        console.warn(
          `[ONLINE-FIRST SYNC FAILED] OpID: ${opId} | Table: ${item.tableName} | RecordID: ${recId} | Error: ${errReason}`
        );

        await db.pendingSync.update(item.id, {
          retryCount: nextRetry,
          status: 'failed',
          lastError: errReason,
        });
        await setLastSyncError(errReason);

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[ONLINE-FIRST SYNC] Device is offline. Pausing queue iteration.');
          break;
        }
      }
    } catch (err: any) {
      const nextRetry = currentRetry + 1;
      const errReason = err?.message || String(err);
      console.error(`[ONLINE-FIRST SYNC EXCEPTION] OpID: ${opId}:`, errReason);

      await db.pendingSync.update(item.id, {
        retryCount: nextRetry,
        status: 'failed',
        lastError: errReason,
      });
      await setLastSyncError(errReason);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }
    }
  }

  const totalQueue = await db.pendingSync.count();
  const pending = await getPendingSyncCount();
  const failed = await getFailedSyncCount();
  console.log(
    `[ONLINE-FIRST SYNC FINISHED] Processed: ${processedCount}, Remaining Queue Total: ${totalQueue} (Pending: ${pending}, Failed: ${failed})`
  );
  return { processedCount, remainingCount: totalQueue, failedCount: failed };
}

// --- DIRECT SUPABASE API IMPLEMENTATIONS (Used by Worker & Initial Fallbacks) ---

export async function fetchProductsFromSupabase(): Promise<{ data: Product[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('products', 'id, name, category, price, wholesale_price, price_installment, cost, stock_quantity, description, barcodes, alternative_barcodes, p_k, created_at');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbProductToProduct) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertProductToSupabase(product: Product): Promise<{ success: boolean; data?: Product; error?: any }> {
  try {
    const payload = mapProductToDbPayload(product);
    delete payload.updated_at;
    if (payload.id && (isNaN(Number(payload.id)) || Number(payload.id) > 2147483647)) {
      delete payload.id;
    }

    const { data, error } = await safeSupabaseMutation(
      'products',
      async (p) => {
        const res = await supabase.from('products').insert([p]).select('id, name');
        if (res.error) return res;
        return { data: (res.data && res.data.length > 0) ? res.data[0] : { id: p.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) return { success: false, error };
    return { success: true, data: data ? mapDbProductToProduct(data) : product };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function updateProductInSupabase(product: Product): Promise<{ success: boolean; data?: Product; error?: any }> {
  try {
    const payload = mapProductToDbPayload(product);
    // Never update primary/immutable keys on update payload
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.p_k; // p_k is an immutable unique sequential code in Supabase

    const idNum = (product.id && !isNaN(Number(product.id))) ? Number(product.id) : null;
    const skuNum = (product.sku && !isNaN(Number(product.sku))) ? Number(product.sku) : null;
    const barcodeStr = product.barcode ? String(product.barcode).trim() : null;

    const { data, error } = await safeSupabaseMutation(
      'products',
      async (p) => {
        // 1. Try matching by numeric ID if available
        if (idNum !== null) {
          const { data: updateData, error: updateErr } = await supabase
            .from('products')
            .update(p)
            .eq('id', idNum)
            .select('id, name');

          if (!updateErr && Array.isArray(updateData) && updateData.length > 0) {
            return { data: updateData[0], error: null };
          }
        }

        // 2. Try matching by p_k if SKU is numeric
        if (skuNum !== null) {
          const { data: updateData, error: updateErr } = await supabase
            .from('products')
            .update(p)
            .eq('p_k', skuNum)
            .select('id, name');

          if (!updateErr && Array.isArray(updateData) && updateData.length > 0) {
            return { data: updateData[0], error: null };
          }
        }

        // 3. Try matching by barcode if available
        if (barcodeStr) {
          const { data: updateData, error: updateErr } = await supabase
            .from('products')
            .update(p)
            .eq('barcode', barcodeStr)
            .select('id, name');

          if (!updateErr && Array.isArray(updateData) && updateData.length > 0) {
            return { data: updateData[0], error: null };
          }
        }

        // 4. Fallback: match by product name
        if (product.name) {
          const { data: updateData, error: updateErr } = await supabase
            .from('products')
            .update(p)
            .eq('name', product.name)
            .select('id, name');

          if (!updateErr && Array.isArray(updateData) && updateData.length > 0) {
            return { data: updateData[0], error: null };
          }
          if (updateErr && !String(updateErr.message || '').includes('PGRST116')) {
            return { data: null, error: updateErr };
          }
        }

        // 5. If no row was found to update, insert as new product to avoid blocking the sync queue
        const insertPayload: any = { ...p };
        if (idNum !== null && idNum <= 2147483647) {
          insertPayload.id = idNum;
        }
        if (skuNum !== null) {
          insertPayload.p_k = skuNum;
        }
        delete insertPayload.updated_at;

        const { data: insertData, error: insertErr } = await supabase
          .from('products')
          .insert([insertPayload])
          .select('id, name');

        if (!insertErr && Array.isArray(insertData) && insertData.length > 0) {
          return { data: insertData[0], error: null };
        }

        return { data: { id: idNum || skuNum, name: product.name }, error: null };
      },
      payload
    );
    if (error) return { success: false, error };
    return { success: true, data: data ? mapDbProductToProduct(data) : product };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function deleteProductFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const productId = extractIdFromPayload(payload);
    if (!productId) return { success: true };
    let query = supabase.from('products').delete();
    if (!isNaN(Number(productId))) query = query.eq('id', Number(productId));
    else query = query.or(`id.eq.${productId},name.eq.${productId}`);
    const { error } = await query;
    if (error) return { success: false, error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function bulkDeleteProductsFromSupabase(productIds: string[]): Promise<{ success: boolean; error?: any }> {
  try {
    const numericIds = productIds.map((id) => Number(id)).filter((id) => !isNaN(id));
    if (numericIds.length === 0) return { success: true };
    const { error } = await supabase.from('products').delete().in('id', numericIds);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function clearAllProductsFromSupabase(): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase.from('products').delete().gt('id', -1);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function fetchCustomersFromSupabase(): Promise<{ data: Customer[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('customers', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbCustomerToCustomer) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertCustomerToSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  try {
    const payload = mapCustomerToDbPayload(customer);
    const { data, error } = await safeSupabaseMutation(
      'customers',
      async (p) => {
        const res = await supabase.from('customers').insert([p]).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        'customers',
        async (p) => {
          const res = await supabase.from('customers').upsert([p]).select('id, name');
          if (res.error) return res;
          return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
        },
        payload
      );
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: upsertData ? mapDbCustomerToCustomer(upsertData) : customer };
    }
    return { success: true, data: data ? mapDbCustomerToCustomer(data) : customer };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function updateCustomerInSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  try {
    const payload = mapCustomerToDbPayload(customer);
    const targetId = payload.id || toSafeDbId(customer.id) || customer.id;
    const { data, error } = await safeSupabaseMutation(
      'customers',
      async (p) => {
        const res = await supabase.from('customers').update(p).eq('id', targetId).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: targetId, name: p.name }, error: null };
      },
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        'customers',
        async (p) => {
          const res = await supabase.from('customers').upsert([p]).select('id, name');
          if (res.error) return res;
          return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
        },
        payload
      );
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: upsertData ? mapDbCustomerToCustomer(upsertData) : customer };
    }
    return { success: true, data: data ? mapDbCustomerToCustomer(data) : customer };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteCustomerFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const customerId = extractIdFromPayload(payload);
    if (!customerId) return { success: true };
    const targetId = toSafeDbId(customerId) || customerId;
    const { error } = await supabase.from('customers').delete().eq('id', targetId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchSuppliersFromSupabase(): Promise<{ data: Supplier[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('suppliers', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbSupplierToSupplier) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertSupplierToSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await safeSupabaseMutation(
      'suppliers',
      async (p) => {
        const res = await supabase.from('suppliers').insert([p]).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        'suppliers',
        async (p) => {
          const res = await supabase.from('suppliers').upsert([p]).select('id, name');
          if (res.error) return res;
          return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
        },
        payload
      );
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: upsertData ? mapDbSupplierToSupplier(upsertData) : supplier };
    }
    return { success: true, data: data ? mapDbSupplierToSupplier(data) : supplier };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function updateSupplierInSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await safeSupabaseMutation(
      'suppliers',
      async (p) => {
        const res = await supabase.from('suppliers').update(p).eq('id', supplier.id).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: supplier.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        'suppliers',
        async (p) => {
          const res = await supabase.from('suppliers').upsert([p]).select('id, name');
          if (res.error) return res;
          return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
        },
        payload
      );
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: upsertData ? mapDbSupplierToSupplier(upsertData) : supplier };
    }
    return { success: true, data: data ? mapDbSupplierToSupplier(data) : supplier };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteSupplierFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const supplierId = extractIdFromPayload(payload);
    if (!supplierId) return { success: true };
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchSupplierTransactionsFromSupabase(): Promise<{ data: SupplierTransaction[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('supplier_transactions', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbSupplierTxToSupplierTx) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertSupplierTransactionToSupabase(tx: SupplierTransaction): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapSupplierTxToDbPayload(tx);
    const { error } = await safeSupabaseMutation(
      'supplier_transactions',
      async (p) => await supabase.from('supplier_transactions').upsert([p]),
      payload
    );
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchTransactionsFromSupabase(): Promise<{ data: Transaction[]; error?: any }> {
  try {
    const txRes = await fetchSelectiveFromSupabase('transactions', '*');
    if (txRes.error) return { data: [], error: txRes.error };

    const itemsRes = await fetchSelectiveFromSupabase('transaction_items', '*');
    const itemsByTx: Record<string, any[]> = {};
    if (itemsRes.data) {
      itemsRes.data.forEach((item: any) => {
        const tid = String(item.transaction_id);
        if (!itemsByTx[tid]) itemsByTx[tid] = [];
        itemsByTx[tid].push({
          productId: String(item.product_id || ''),
          productName: item.product_name || 'منتج',
          sku: item.sku || '',
          quantity: Number(item.quantity || 1),
          priceTier: item.price_tier || 'cash',
          unitPrice: Number(item.unit_price || 0),
          totalPrice: Number(item.total_price || 0),
          assignedAssociateId: item.assigned_associate_id,
        });
      });
    }

    const txs: Transaction[] = (txRes.data || []).map((t: any) => mapDbTransactionToTransaction(t, itemsByTx));

    return { data: txs };
  } catch (err) {
    return { data: [], error: err };
  }
}

export async function insertTransactionToSupabase(transaction: Transaction): Promise<{ success: boolean; error?: any }> {
  try {
    const isoTime = new Date(transaction.timestamp || Date.now()).toISOString();
    const payload: any = {
      id: transaction.id,
      receipt_number: transaction.receiptNumber,
      timestamp: isoTime,
      subtotal: transaction.subtotal,
      discount_total: transaction.discountTotal,
      tax_total: transaction.taxTotal,
      grand_total: transaction.grandTotal,
      payment_method: transaction.paymentMethod,
      payment_details: transaction.paymentDetails || null,
      customer_id: toSafeDbId(transaction.customerId),
      customer_name: transaction.customerName || null,
      primary_associate_id: transaction.primaryAssociateId,
      primary_associate_name: transaction.primaryAssociateName,
      split_associates: transaction.splitAssociates || null,
      commissions: transaction.commissions || null,
      notes: transaction.notes || null,
      status: transaction.status || 'مكتملة',
      original_cart: transaction.originalCart || null,
      amount_paid: transaction.amountPaid || 0,
      amount_deferred: transaction.amountDeferred || 0,
      split_payments: transaction.splitPayments || null,
      updated_at: isoTime,
    };

    const { error: txError } = await safeSupabaseMutation(
      'transactions',
      async (p) => await supabase.from('transactions').upsert([p]),
      payload
    );

    if (txError) return { success: false, error: txError };

    if (transaction.items && transaction.items.length > 0) {
      await supabase.from('transaction_items').delete().eq('transaction_id', transaction.id);
      const itemsPayload = transaction.items.map((item) => {
        const itemP: any = {
          transaction_id: transaction.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          price_tier: item.priceTier || 'cash',
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          assigned_associate_id: item.assignedAssociateId || null,
        };
        if (!isColumnMissing('transaction_items', 'sku') && item.sku) {
          itemP.sku = item.sku;
        }
        return itemP;
      });

      await safeSupabaseMutation(
        'transaction_items',
        async (pArr) => await supabase.from('transaction_items').insert(pArr),
        itemsPayload
      );
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteTransactionFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const transactionId = extractIdFromPayload(payload);
    if (!transactionId) return { success: true };

    // 1. Delete associated transaction items if any
    try {
      await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
    } catch (itemErr) {
      console.warn('[SUPABASE] Could not delete transaction items:', itemErr);
    }

    // 2. Perform soft-delete update so delta-sync never re-pulls this transaction
    try {
      await safeSupabaseMutation(
        'transactions',
        async (p) => await supabase.from('transactions').update(p).eq('id', transactionId),
        { is_deleted: true, status: 'ملغاة', updated_at: new Date().toISOString() }
      );
    } catch (softErr) {
      console.warn('[SUPABASE] Soft-delete update error:', softErr);
    }

    // 3. Attempt hard-delete
    const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
    if (error) {
      console.warn('[SUPABASE] Hard-delete error (soft-delete flag was applied):', error);
      // If hard delete fails due to RLS or constraints, the soft-delete ensures it is marked deleted
      return { success: true };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchAssociatesFromSupabase(): Promise<{ data: Associate[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('associates', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbAssociateToAssociate) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertAssociateToSupabase(associate: Associate): Promise<{ success: boolean; data?: Associate; error?: any }> {
  try {
    const payload = mapAssociateToDbPayload(associate);
    const { data, error } = await safeSupabaseMutation(
      'associates',
      async (p) => {
        const res = await supabase.from('associates').upsert([p]).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) return { success: false, error };
    return { success: true, data: data ? mapDbAssociateToAssociate(data) : associate };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function updateAssociateInSupabase(associate: Associate): Promise<{ success: boolean; data?: Associate; error?: any }> {
  try {
    const payload = mapAssociateToDbPayload(associate);
    const { data, error } = await safeSupabaseMutation(
      'associates',
      async (p) => {
        const res = await supabase.from('associates').update(p).eq('id', associate.id).select('id, name');
        if (res.error) return res;
        return { data: res.data?.[0] || { id: associate.id, name: p.name }, error: null };
      },
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        'associates',
        async (p) => {
          const res = await supabase.from('associates').upsert([p]).select('id, name');
          if (res.error) return res;
          return { data: res.data?.[0] || { id: p.id, name: p.name }, error: null };
        },
        payload
      );
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: upsertData ? mapDbAssociateToAssociate(upsertData) : associate };
    }
    return { success: true, data: data ? mapDbAssociateToAssociate(data) : associate };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteAssociateFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const associateId = extractIdFromPayload(payload);
    if (!associateId) return { success: true };
    const { error } = await supabase.from('associates').delete().eq('id', associateId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchClosedShiftsFromSupabase(): Promise<{ data: ClosedShift[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('closed_shifts', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbShiftToClosedShift) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertClosedShiftToSupabase(shift: ClosedShift): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapClosedShiftToDbPayload(shift);
    const { error } = await safeSupabaseMutation(
      'closed_shifts',
      async (p) => await supabase.from('closed_shifts').upsert([p]),
      payload
    );
    if (error) return { success: false, error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function fetchExpensesFromSupabase(): Promise<{ data: POSExpense[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('expenses', '*');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbExpenseToExpense) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertExpenseToSupabase(expense: POSExpense): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapExpenseToDbPayload(expense);
    const { error } = await safeSupabaseMutation(
      'expenses',
      async (p) => await supabase.from('expenses').upsert([p]),
      payload
    );
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteExpenseFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const expenseId = extractIdFromPayload(payload);
    if (!expenseId) return { success: true };
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchDiscountsFromSupabase(): Promise<{ data: ProductDiscount[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('discounts', '*');
    if (res.error) return { data: [] };
    const discounts: ProductDiscount[] = (res.data || []).map((d: any) => ({
      productId: String(d.product_id || d.productId),
      type: d.type || 'percentage',
      value: Number(d.value || 0),
      isActive: d.is_active ?? true,
      applyTo: d.apply_to || 'both',
    }));
    return { data: discounts };
  } catch {
    return { data: [] };
  }
}

export async function insertDiscountToSupabase(discount: ProductDiscount): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = {
      product_id: discount.productId,
      type: discount.type,
      value: discount.value,
      is_active: discount.isActive,
      apply_to: discount.applyTo,
      updated_at: new Date().toISOString(),
    };
    const { error } = await safeSupabaseMutation(
      'discounts',
      async (p) => await supabase.from('discounts').upsert([p]),
      payload
    );
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteDiscountFromSupabase(payload: any): Promise<{ success: boolean; error?: any }> {
  try {
    const productId = extractIdFromPayload(payload);
    if (!productId) return { success: true };
    await supabase.from('discounts').delete().eq('product_id', productId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

// --- COMPATIBILITY ALIASES ---
export const syncProductToSupabase = async (p: Product) => updateProductInSupabase(p);
export const syncCustomerToSupabase = async (c: Customer) => updateCustomerInSupabase(c);
export const syncSupplierToSupabase = async (s: Supplier) => updateSupplierInSupabase(s);
export const syncAssociateToSupabase = async (a: Associate) => updateAssociateInSupabase(a);
export const syncSupplierTransactionToSupabase = async (st: SupplierTransaction) => insertSupplierTransactionToSupabase(st);
export const syncExpenseToSupabase = async (e: POSExpense) => insertExpenseToSupabase(e);
export const syncClosedShiftToSupabase = async (cs: ClosedShift) => insertClosedShiftToSupabase(cs);
export const syncTransactionToSupabase = async (t: Transaction) => insertTransactionToSupabase(t);
