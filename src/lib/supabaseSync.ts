import { supabase, getSupabaseKeys } from './supabase';
import { db, getLastSyncTimestamp, setLastSyncTimestamp, addToPendingQueue, PendingSyncItem } from './db';
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

// --- AUTO-RECOVERY MUTATION HELPER ---
export async function safeSupabaseMutation(
  operationFn: (cleanPayload: any) => Promise<{ data?: any; error?: any }>,
  initialPayload: any
): Promise<{ data?: any; error?: any }> {
  let currentPayload = { ...initialPayload };
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    const res = await operationFn(currentPayload);
    const error = res?.error;

    if (!error) {
      return res;
    }

    if (error && error.code === 'PGRST204' && typeof error.message === 'string') {
      const match = error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        const missingColumn = match[1];
        console.warn(`[SUPABASE AUTO-RECOVERY] Stripping missing column '${missingColumn}' from payload...`);
        delete currentPayload[missingColumn];
        continue;
      }
    }

    return res;
  }

  return { data: null, error: new Error('Max retry attempts reached for PGRST204 recovery') };
}

// --- MAPPERS ---

export function mapDbProductToProduct(p: any): Product {
  const safeId = (p.id !== null && p.id !== undefined && String(p.id) !== 'null' && String(p.id) !== 'undefined')
    ? String(p.id)
    : (p.sku ? String(p.sku) : (p.barcode ? String(p.barcode) : `prod_${Math.random().toString(36).substring(2, 9)}`));

  return {
    id: safeId,
    name: p.name || 'منتج',
    sku: String(p.sku ?? safeId ?? 'SKU-000'),
    barcode: String(p.barcode || p.sku || safeId || '000000'),
    category: p.category || 'عام',
    priceCash: Number(p.priceCash ?? p.cash_price ?? p.price_cash ?? p.price ?? p.sale_price ?? 0),
    priceInstallment: Number(p.priceInstallment ?? p.installment_price ?? p.price_installment ?? p.installmentPrice ?? 0),
    priceWholesale: Number(p.priceWholesale ?? p.wholesale_price ?? p.price_wholesale ?? p.wholesalePrice ?? 0),
    cost: Number(p.cost ?? p.cost_price ?? p.purchase_price ?? 0),
    stock: Number(p.stock_quantity ?? p.quantity ?? p.stock ?? 0),
    image: p.image_url || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
    description: p.description || '',
    barcodes: Array.isArray(p.barcodes)
      ? p.barcodes.map(String)
      : typeof p.barcodes === 'string'
        ? p.barcodes.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
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
    image: product.image || '',
    barcodes: product.barcodes || (product.barcode ? [product.barcode] : []),
    updated_at: new Date().toISOString(),
  };

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

export function mapDbAssociateToAssociate(a: any): Associate {
  const safeId = (a.id !== null && a.id !== undefined && String(a.id) !== 'null' && String(a.id) !== 'undefined')
    ? String(a.id)
    : `assoc_${Math.random().toString(36).substring(2, 9)}`;

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
    permissions: Array.isArray(a.permissions) ? a.permissions : undefined,
  };
}

export function mapAssociateToDbPayload(associate: Associate): any {
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
    avatar: associate.avatar || '',
    advances_balance: associate.advancesBalance || 0,
    is_clocked_in: Boolean(associate.isClockedIn),
    permissions: associate.permissions || [],
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
 * Optimized Selective Query Helper with Pagination & Delta Filter
 */
async function fetchSelectiveFromSupabase(
  tableName: string,
  columns: string,
  lastSyncTimestamp?: string | null,
  orderColumn: string = 'updated_at'
): Promise<{ data: any[]; error?: any }> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from(tableName).select(columns).range(from, to);

    if (lastSyncTimestamp) {
      // Delta sync filter
      query = query.or(`updated_at.gt.${lastSyncTimestamp},created_at.gt.${lastSyncTimestamp}`);
    }

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true, nullsFirst: false });
    }

    const { data, error } = await query;
    if (error) {
      // If order by updated_at fails (column missing), retry without filter or fallback to id
      if (error.message?.includes('updated_at') || error.code === '42703') {
        const fallbackRes = await supabase.from(tableName).select(columns).range(from, to);
        return { data: fallbackRes.data || [] };
      }
      if (allRows.length > 0) break;
      return { data: [], error };
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
  outboxResult: { processedCount: number; remainingCount: number };
  deltaSyncResult: { success: boolean; syncedCounts: Record<string, number>; error?: any };
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
  error?: any;
}> {
  if (isSyncingLock) {
    console.warn('[SYNC CONCURRENCY LOCK] Sync cycle already running. Skipping standalone delta sync.');
    return { success: false, syncedCounts: {} };
  }
  isSyncingLock = true;
  try {
    return await performDeltaSyncInternal();
  } finally {
    isSyncingLock = false;
  }
}

async function performDeltaSyncInternal(): Promise<{
  success: boolean;
  syncedCounts: Record<string, number>;
  error?: any;
}> {
  console.log('[SUPABASE DELTA SYNC] Starting delta sync...');
  const lastSync = await getLastSyncTimestamp();
  const nextSyncTimestamp = new Date().toISOString();
  const syncedCounts: Record<string, number> = {};

  try {
    // 1. Sync Products (including soft-delete check)
    const prodRes = await fetchSelectiveFromSupabase(
      'products',
      'id, name, sku, barcode, category, price, wholesale_price, price_installment, cost, stock_quantity, description, image, barcodes, is_deleted',
      lastSync
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
      'id, name, phone, email, address, total_spent, loyalty_points, tier, is_credit_eligible, credit_limit, current_debt, notes, monthly_installment_amount, is_deleted',
      lastSync
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
      'id, name, company_name, phone, email, address, category, current_balance, notes, tax_number, is_deleted',
      lastSync
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
      'id, supplier_id, supplier_name, type, amount, date, reference_number, payment_method, notes, associate_name, is_deleted',
      lastSync
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

    // 5. Sync Transactions
    const txRes = await fetchSelectiveFromSupabase(
      'transactions',
      'id, receipt_number, timestamp, subtotal, discount_total, tax_total, grand_total, payment_method, payment_details, customer_id, customer_name, primary_associate_id, primary_associate_name, split_associates, commissions, notes, status, amount_paid, amount_deferred, split_payments, original_cart, is_deleted',
      lastSync
    );
    if (txRes.data && txRes.data.length > 0) {
      const itemsRes = await fetchSelectiveFromSupabase('transaction_items', 'transaction_id, product_id, product_name, sku, quantity, price_tier, unit_price, total_price, assigned_associate_id');
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

      const activeTxs: Transaction[] = [];
      const deletedTxIds: string[] = [];

      for (const t of txRes.data) {
        const id = String(t.id);
        if (t.is_deleted === true || t.is_deleted === 1 || String(t.is_deleted) === 'true') {
          deletedTxIds.push(id);
        } else {
          activeTxs.push({
            id,
            receiptNumber: t.receipt_number || `RCP-${id}`,
            timestamp: t.timestamp || new Date().toISOString(),
            items: itemsByTx[id] || (Array.isArray(t.items) ? t.items : []),
            subtotal: Number(t.subtotal || 0),
            discountTotal: Number(t.discount_total || 0),
            taxTotal: Number(t.tax_total || 0),
            grandTotal: Number(t.grand_total || 0),
            paymentMethod: t.payment_method || 'كاش',
            paymentDetails: t.payment_details || '',
            customerId: t.customer_id || undefined,
            customerName: t.customer_name || undefined,
            primaryAssociateId: t.primary_associate_id || 'system',
            primaryAssociateName: t.primary_associate_name || 'النظام',
            splitAssociates: t.split_associates,
            commissions: t.commissions || [],
            notes: t.notes || '',
            status: t.status || 'مكتملة',
            amountPaid: Number(t.amount_paid ?? t.grand_total ?? 0),
            amountDeferred: Number(t.amount_deferred ?? 0),
            splitPayments: t.split_payments,
            originalCart: t.original_cart,
            isSynced: true,
          });
        }
      }

      if (activeTxs.length > 0) await db.transactions.bulkPut(activeTxs);
      if (deletedTxIds.length > 0) {
        await db.transactions.bulkDelete(deletedTxIds);
        console.log(`[SOFT-DELETE SYNC] Deleted ${deletedTxIds.length} soft-deleted transactions from Dexie.js`);
      }
      syncedCounts.transactions = activeTxs.length;
    }

    // 6. Sync Associates
    const assocRes = await fetchSelectiveFromSupabase(
      'associates',
      'id, name, username, password, pin, role, email, phone, commission_rate, daily_goal, hourly_rate, avatar, advances_balance, is_clocked_in, permissions, is_deleted',
      lastSync
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
      'id, associate_id, associate_name, start_time, end_time, expected_cash, actual_cash, discrepancy, sales_count, total_sales, total_card, total_installment, total_debt_collected, notes, opening_balance, leftover_balance, is_deleted',
      lastSync
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
      'id, amount, category, description, timestamp, associate_id, associate_name, linked_supplier_id, linked_supplier_name, linked_associate_id, linked_associate_name, is_deleted',
      lastSync
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
    console.log('[SUPABASE DELTA SYNC] Completed successfully. Next timestamp:', nextSyncTimestamp);
    return { success: true, syncedCounts };
  } catch (err: any) {
    console.warn('[SUPABASE DELTA SYNC] Exception during sync:', err?.message || String(err));
    return { success: false, syncedCounts, error: err };
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
  error?: any;
}> {
  if (isSyncingLock) {
    console.warn('[SYNC CONCURRENCY LOCK] Sync cycle already running. Skipping standalone queue processing.');
    return { processedCount: 0, remainingCount: await db.pendingSync.count() };
  }
  isSyncingLock = true;
  try {
    return await processPendingSyncQueueInternal();
  } finally {
    isSyncingLock = false;
  }
}

async function processPendingSyncQueueInternal(): Promise<{
  processedCount: number;
  remainingCount: number;
  error?: any;
}> {
  const pendingItems = await db.pendingSync.orderBy('id').toArray();
  if (pendingItems.length === 0) {
    return { processedCount: 0, remainingCount: 0 };
  }

  console.log(`[OUTBOX WORKER] Processing ${pendingItems.length} queued mutations...`);
  let processedCount = 0;

  for (const item of pendingItems) {
    if (!item.id) continue;
    const currentRetry = item.retryCount || 0;

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
      } else {
        const nextRetry = currentRetry + 1;
        const errReason = result.error?.message || String(result.error || 'Failed Supabase sync mutation');

        if (nextRetry >= 5) {
          console.warn(`[DEAD-LETTER QUEUE] Pending sync item #${item.id} (${item.tableName}:${item.operation}) failed 5 times (${errReason}). Moving to syncErrors table and skipping.`);
          await db.syncErrors.add({
            originalPendingId: item.id,
            tableName: item.tableName,
            operation: item.operation,
            payload: item.payload,
            failedAt: new Date().toISOString(),
            errorReason: errReason,
            retryCount: nextRetry,
          });
          await db.pendingSync.delete(item.id);
        } else {
          await db.pendingSync.update(item.id, { retryCount: nextRetry });
          console.warn(`[OUTBOX WORKER] Item #${item.id} (${item.tableName}) attempt ${nextRetry}/5 failed: ${errReason}`);

          // Stop processing queue if network is strictly offline
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.warn('[OUTBOX WORKER] Device is offline. Pausing outbox queue processing.');
            break;
          }
        }
      }
    } catch (err: any) {
      const nextRetry = currentRetry + 1;
      const errReason = err?.message || String(err);
      console.error(`[OUTBOX WORKER] Exception processing queue item #${item.id}:`, errReason);

      if (nextRetry >= 5) {
        console.warn(`[DEAD-LETTER QUEUE] Item #${item.id} threw exception 5 times. Moving to syncErrors.`);
        await db.syncErrors.add({
          originalPendingId: item.id,
          tableName: item.tableName,
          operation: item.operation,
          payload: item.payload,
          failedAt: new Date().toISOString(),
          errorReason: errReason,
          retryCount: nextRetry,
        });
        await db.pendingSync.delete(item.id);
      } else {
        await db.pendingSync.update(item.id, { retryCount: nextRetry });
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }
      }
    }
  }

  const remaining = await db.pendingSync.count();
  console.log(`[OUTBOX WORKER] Finished batch. Processed: ${processedCount}, Remaining in queue: ${remaining}`);
  return { processedCount, remainingCount: remaining };
}

// --- DIRECT SUPABASE API IMPLEMENTATIONS (Used by Worker & Initial Fallbacks) ---

export async function fetchProductsFromSupabase(): Promise<{ data: Product[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('products', 'id, name, sku, barcode, category, price, wholesale_price, price_installment, cost, stock_quantity, description, image, barcodes');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbProductToProduct) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertProductToSupabase(product: Product): Promise<{ success: boolean; data?: Product; error?: any }> {
  try {
    const payload = mapProductToDbPayload(product);
    const { data, error } = await safeSupabaseMutation(
      async (p) => await supabase.from('products').insert([p]).select('id, name, sku').single(),
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
    const idNum = (product.id && !isNaN(Number(product.id))) ? Number(product.id) : null;
    const { data, error } = await safeSupabaseMutation(
      async (p) => {
        let query = supabase.from('products').update(p);
        if (idNum !== null) query = query.eq('id', idNum);
        else query = query.eq('name', product.name);
        return await query.select('id, name, sku').single();
      },
      payload
    );
    if (error) return { success: false, error };
    return { success: true, data: data ? mapDbProductToProduct(data) : product };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<{ success: boolean; error?: any }> {
  try {
    let query = supabase.from('products').delete();
    if (productId && !isNaN(Number(productId))) query = query.eq('id', Number(productId));
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
    const res = await fetchSelectiveFromSupabase('customers', 'id, name, phone, email, address, total_spent, loyalty_points, tier, is_credit_eligible, credit_limit, current_debt, notes, monthly_installment_amount');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbCustomerToCustomer) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertCustomerToSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  try {
    const payload = mapCustomerToDbPayload(customer);
    const { data, error } = await supabase.from('customers').insert([payload]).select('id, name').single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('customers').upsert([payload]).select('id, name').single();
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: mapDbCustomerToCustomer(upsertData) };
    }
    return { success: true, data: mapDbCustomerToCustomer(data) };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function updateCustomerInSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  try {
    const payload = mapCustomerToDbPayload(customer);
    const targetId = payload.id || toSafeDbId(customer.id) || customer.id;
    const { data, error } = await supabase.from('customers').update(payload).eq('id', targetId).select('id, name').single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('customers').upsert([payload]).select('id, name').single();
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: mapDbCustomerToCustomer(upsertData) };
    }
    return { success: true, data: mapDbCustomerToCustomer(data) };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteCustomerFromSupabase(customerId: string): Promise<{ success: boolean; error?: any }> {
  try {
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
    const res = await fetchSelectiveFromSupabase('suppliers', 'id, name, company_name, phone, email, address, category, current_balance, notes, tax_number');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbSupplierToSupplier) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertSupplierToSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await supabase.from('suppliers').insert([payload]).select('id, name').single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('suppliers').upsert([payload]).select('id, name').single();
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: mapDbSupplierToSupplier(upsertData) };
    }
    return { success: true, data: mapDbSupplierToSupplier(data) };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function updateSupplierInSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id).select('id, name').single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('suppliers').upsert([payload]).select('id, name').single();
      if (upsertErr) return { success: false, error: upsertErr };
      return { success: true, data: mapDbSupplierToSupplier(upsertData) };
    }
    return { success: true, data: mapDbSupplierToSupplier(data) };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteSupplierFromSupabase(supplierId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchSupplierTransactionsFromSupabase(): Promise<{ data: SupplierTransaction[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('supplier_transactions', 'id, supplier_id, supplier_name, type, amount, date, reference_number, payment_method, notes, associate_name');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbSupplierTxToSupplierTx) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertSupplierTransactionToSupabase(tx: SupplierTransaction): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapSupplierTxToDbPayload(tx);
    const { error } = await supabase.from('supplier_transactions').upsert([payload]);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchTransactionsFromSupabase(): Promise<{ data: Transaction[]; error?: any }> {
  try {
    const txRes = await fetchSelectiveFromSupabase('transactions', 'id, receipt_number, timestamp, subtotal, discount_total, tax_total, grand_total, payment_method, payment_details, customer_id, customer_name, primary_associate_id, primary_associate_name, split_associates, commissions, notes, status, amount_paid, amount_deferred, split_payments, original_cart');
    if (txRes.error) return { data: [], error: txRes.error };

    const itemsRes = await fetchSelectiveFromSupabase('transaction_items', 'transaction_id, product_id, product_name, sku, quantity, price_tier, unit_price, total_price, assigned_associate_id');
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

    const txs: Transaction[] = (txRes.data || []).map((t: any) => {
      const id = String(t.id);
      return {
        id,
        receiptNumber: t.receipt_number || `RCP-${id}`,
        timestamp: t.timestamp || new Date().toISOString(),
        items: itemsByTx[id] || (Array.isArray(t.items) ? t.items : []),
        subtotal: Number(t.subtotal || 0),
        discountTotal: Number(t.discount_total || 0),
        taxTotal: Number(t.tax_total || 0),
        grandTotal: Number(t.grand_total || 0),
        paymentMethod: t.payment_method || 'كاش',
        paymentDetails: t.payment_details || '',
        customerId: t.customer_id || undefined,
        customerName: t.customer_name || undefined,
        primaryAssociateId: t.primary_associate_id || 'system',
        primaryAssociateName: t.primary_associate_name || 'النظام',
        splitAssociates: t.split_associates,
        commissions: t.commissions || [],
        notes: t.notes || '',
        status: t.status || 'مكتملة',
        amountPaid: Number(t.amount_paid ?? t.grand_total ?? 0),
        amountDeferred: Number(t.amount_deferred ?? 0),
        splitPayments: t.split_payments,
        originalCart: t.original_cart,
        isSynced: true,
      };
    });

    return { data: txs };
  } catch (err) {
    return { data: [], error: err };
  }
}

export async function insertTransactionToSupabase(transaction: Transaction): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = {
      id: transaction.id,
      receipt_number: transaction.receiptNumber,
      timestamp: new Date(transaction.timestamp).toISOString(),
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
      updated_at: new Date().toISOString(),
    };

    const { error: txError } = await supabase.from('transactions').upsert([payload]);
    if (txError) return { success: false, error: txError };

    if (transaction.items && transaction.items.length > 0) {
      await supabase.from('transaction_items').delete().eq('transaction_id', transaction.id);
      const itemsPayload = transaction.items.map((item) => ({
        transaction_id: transaction.id,
        product_id: item.productId,
        product_name: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        price_tier: item.priceTier || 'cash',
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        assigned_associate_id: item.assignedAssociateId || null,
      }));
      await supabase.from('transaction_items').insert(itemsPayload);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteTransactionFromSupabase(transactionId: string): Promise<{ success: boolean; error?: any }> {
  try {
    await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
    const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchAssociatesFromSupabase(): Promise<{ data: Associate[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('associates', 'id, name, username, password, pin, role, email, phone, commission_rate, daily_goal, hourly_rate, avatar, advances_balance, is_clocked_in, permissions');
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
      async (p) => await supabase.from('associates').upsert([p]).select('id, name').single(),
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
      async (p) => await supabase.from('associates').update(p).eq('id', associate.id).select('id, name').single(),
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        async (p) => await supabase.from('associates').upsert([p]).select('id, name').single(),
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

export async function deleteAssociateFromSupabase(associateId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase.from('associates').delete().eq('id', associateId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchClosedShiftsFromSupabase(): Promise<{ data: ClosedShift[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('closed_shifts', 'id, associate_id, associate_name, start_time, end_time, expected_cash, actual_cash, discrepancy, sales_count, total_sales, total_card, total_installment, total_debt_collected, notes, opening_balance, leftover_balance');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbShiftToClosedShift) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertClosedShiftToSupabase(shift: ClosedShift): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapClosedShiftToDbPayload(shift);
    const { error } = await supabase.from('closed_shifts').upsert([payload]);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function fetchExpensesFromSupabase(): Promise<{ data: POSExpense[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('expenses', 'id, amount, category, description, timestamp, associate_id, associate_name, linked_supplier_id, linked_supplier_name, linked_associate_id, linked_associate_name');
    if (res.error) return { data: [], error: res.error };
    return { data: (res.data || []).map(mapDbExpenseToExpense) };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

export async function insertExpenseToSupabase(expense: POSExpense): Promise<{ success: boolean; error?: any }> {
  try {
    const payload = mapExpenseToDbPayload(expense);
    const { error } = await supabase.from('expenses').upsert([payload]);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteExpenseFromSupabase(expenseId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchDiscountsFromSupabase(): Promise<{ data: ProductDiscount[]; error?: any }> {
  try {
    const res = await fetchSelectiveFromSupabase('discounts', 'product_id, type, value, is_active, apply_to');
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
    await supabase.from('discounts').upsert([payload]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteDiscountFromSupabase(productId: string): Promise<{ success: boolean; error?: any }> {
  try {
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
