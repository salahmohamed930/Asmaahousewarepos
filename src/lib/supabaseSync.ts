import { supabase, getSupabaseKeys } from './supabase';
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
 * Single Source of Truth - Supabase API Layer
 * Performs database queries & mutations directly with complete error handling & console logging.
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
      } else if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('not found')) {
        categorizedError = `[جدول] الجدول غير موجود في قاعدة البيانات: ${error.message}`;
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

    console.log(`[SUPABASE HEALTH CHECK] OK - Connected to ${url}. Status: 200 OK (${data?.length ?? 0} rows)`);
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
/**
 * Safely executes a Supabase DB write operation (insert/update/upsert).
 * If PostgREST returns PGRST204 ("Could not find the 'xyz' column of 'table' in the schema cache"),
 * it automatically strips the missing column from the payload and retries up to 5 times.
 */
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
        console.warn(`[SUPABASE AUTO-RECOVERY] Stripping missing column '${missingColumn}' from payload and retrying...`);
        delete currentPayload[missingColumn];
        continue;
      }
    }

    // Handle 22P02 invalid input syntax (e.g. smallint vs decimal "0.005" or "0.05")
    if (error && (error.code === '22P02' || (typeof error.message === 'string' && error.message.toLowerCase().includes('invalid input syntax')))) {
      console.warn(`[SUPABASE AUTO-RECOVERY] Type mismatch error detected: ${error.message}`);
      if (currentPayload.commission_rate !== undefined) {
        if (typeof currentPayload.commission_rate === 'number' && !Number.isInteger(currentPayload.commission_rate)) {
          console.warn(`[SUPABASE AUTO-RECOVERY] Converting decimal commission_rate ${currentPayload.commission_rate} to integer percentage or stripping...`);
          currentPayload.commission_rate = Math.round(currentPayload.commission_rate * 100);
          continue;
        } else {
          console.warn(`[SUPABASE AUTO-RECOVERY] Stripping commission_rate from payload to recover...`);
          delete currentPayload.commission_rate;
          continue;
        }
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
    : (p.id2 !== null && p.id2 !== undefined && String(p.id2) !== 'null' && String(p.id2) !== 'undefined')
      ? String(p.id2)
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
    cost: Number(p.cost ?? p.cost_price ?? p.cost_cash ?? p.purchase_price ?? p.buy_price ?? 0),
    stock: Number(
      p.stock_quantity ??
      p.quantity ??
      p.qty ??
      p.stock ??
      p.stock_qty ??
      p.quantity_in_stock ??
      p.inventory ??
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

  // Pure digits check
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      if (num > 2147483647) {
        return Number(str.slice(-9));
      }
      return num;
    }
  }

  // String with non-digits like "cust_1788218330932" or "supp_99"
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
    : (c.id2 !== null && c.id2 !== undefined && String(c.id2) !== 'null' && String(c.id2) !== 'undefined')
      ? String(c.id2)
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
    : (s.id2 !== null && s.id2 !== undefined && String(s.id2) !== 'null' && String(s.id2) !== 'undefined')
      ? String(s.id2)
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
  };

  if (safeId !== null && safeId !== undefined) {
    payload.id = safeId;
  }

  return payload;
}

export function mapDbAssociateToAssociate(a: any): Associate {
  const safeId = (a.id !== null && a.id !== undefined && String(a.id) !== 'null' && String(a.id) !== 'undefined')
    ? String(a.id)
    : (a.id2 !== null && a.id2 !== undefined && String(a.id2) !== 'null' && String(a.id2) !== 'undefined')
      ? String(a.id2)
      : `assoc_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: safeId,
    name: String(a.name || 'موظف'),
    username: String(a.username || a.user_name || (a.name ? String(a.name).toLowerCase() : '') || `user_${safeId}`),
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
    permissions: Array.isArray(a.permissions)
      ? a.permissions
      : typeof a.permissions === 'string'
      ? (() => {
          try { return JSON.parse(a.permissions); } catch { return undefined; }
        })()
      : undefined,
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
  };
}

// --- PAGINATED FETCH HELPER (Bypasses Supabase 100/1000 row limits) ---
export async function fetchAllRowsFromSupabase(
  tableName: string,
  orderColumn?: string,
  ascending: boolean = false
): Promise<{ data: any[]; error?: any }> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from(tableName).select('*').range(from, to);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending });
    }
    const { data, error } = await query;
    if (error) {
      if (allRows.length > 0) {
        console.warn(`[SUPABASE] Partial fetch for ${tableName} up to page ${page}:`, error.message || error);
        break;
      }
      return { data: [], error };
    }
    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return { data: allRows };
}

// --- 2. PRODUCTS API ---

export async function fetchProductsFromSupabase(): Promise<{ data: Product[]; error?: any }> {
  console.log('[SUPABASE] Fetching products...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('products');
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchProductsFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const products = (data || []).map(mapDbProductToProduct);
    console.log(`[SUPABASE] Loaded ${products.length} products`);
    return { data: products };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchProductsFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertProductToSupabase(product: Product): Promise<{ success: boolean; data?: Product; error?: any }> {
  console.log('[SUPABASE] Inserting product:', product.name);
  try {
    const payload = mapProductToDbPayload(product);
    const { data, error } = await safeSupabaseMutation(
      async (p) => await supabase.from('products').insert([p]).select().single(),
      payload
    );
    if (error) {
      console.error('[SUPABASE ERROR] insertProductToSupabase:', error.message || error);
      return { success: false, error };
    }
    return { success: true, data: data ? mapDbProductToProduct(data) : product };
  } catch (err: any) {
    console.error('[SUPABASE ERROR] insertProductToSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

export async function updateProductInSupabase(product: Product): Promise<{ success: boolean; data?: Product; error?: any }> {
  console.log('[SUPABASE] Updating product:', product.id);
  try {
    const payload = mapProductToDbPayload(product);
    const idNum = (product.id && !isNaN(Number(product.id))) ? Number(product.id) : null;

    const { data, error } = await safeSupabaseMutation(
      async (p) => {
        let query = supabase.from('products').update(p);
        if (idNum !== null) {
          query = query.eq('id', idNum);
        } else {
          query = query.eq('name', product.name);
        }
        return await query.select().single();
      },
      payload
    );

    if (error) {
      console.error('[SUPABASE ERROR] updateProductInSupabase:', error.message || error);
      return { success: false, error };
    }
    return { success: true, data: data ? mapDbProductToProduct(data) : product };
  } catch (err: any) {
    console.error('[SUPABASE ERROR] updateProductInSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting product:', productId);
  try {
    let query = supabase.from('products').delete();
    if (productId && !isNaN(Number(productId))) {
      query = query.eq('id', Number(productId));
    } else {
      query = query.or(`id.eq.${productId},name.eq.${productId}`);
    }

    const { error } = await query;
    if (error) {
      console.error('[SUPABASE ERROR] deleteProductFromSupabase:', error.message || error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[SUPABASE ERROR] deleteProductFromSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

export async function bulkDeleteProductsFromSupabase(productIds: string[]): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Bulk deleting products:', productIds.length);
  try {
    const numericIds = productIds.map((id) => Number(id)).filter((id) => !isNaN(id));
    if (numericIds.length === 0) return { success: true };

    const { error } = await supabase.from('products').delete().in('id', numericIds);
    if (error) {
      console.error('[SUPABASE ERROR] bulkDeleteProductsFromSupabase:', error.message || error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[SUPABASE ERROR] bulkDeleteProductsFromSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

export async function clearAllProductsFromSupabase(): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Clearing all products...');
  try {
    const { error } = await supabase.from('products').delete().gt('id', -1);
    if (error) {
      console.error('[SUPABASE ERROR] clearAllProductsFromSupabase:', error.message || error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[SUPABASE ERROR] clearAllProductsFromSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

// --- 3. CUSTOMERS API ---

export async function fetchCustomersFromSupabase(): Promise<{ data: Customer[]; error?: any }> {
  console.log('[SUPABASE] Fetching customers...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('customers');
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchCustomersFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const customers = (data || []).map(mapDbCustomerToCustomer);
    console.log(`[SUPABASE] Loaded ${customers.length} customers`);
    return { data: customers };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchCustomersFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertCustomerToSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  console.log('[SUPABASE] Inserting customer:', customer.id);
  try {
    const payload = mapCustomerToDbPayload(customer);
    const { data, error } = await supabase.from('customers').insert([payload]).select().single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('customers').upsert([payload]).select().single();
      if (upsertErr) {
        console.error('[SUPABASE ERROR] insertCustomerToSupabase:', upsertErr);
        return { success: false, error: upsertErr };
      }
      return { success: true, data: mapDbCustomerToCustomer(upsertData) };
    }
    return { success: true, data: mapDbCustomerToCustomer(data) };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertCustomerToSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function updateCustomerInSupabase(customer: Customer): Promise<{ success: boolean; data?: Customer; error?: any }> {
  console.log('[SUPABASE] Updating customer:', customer.id);
  try {
    const payload = mapCustomerToDbPayload(customer);
    const targetId = payload.id || toSafeDbId(customer.id) || customer.id;
    const { data, error } = await supabase.from('customers').update(payload).eq('id', targetId).select().single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('customers').upsert([payload]).select().single();
      if (upsertErr) {
        console.error('[SUPABASE ERROR] updateCustomerInSupabase:', upsertErr);
        return { success: false, error: upsertErr };
      }
      return { success: true, data: mapDbCustomerToCustomer(upsertData) };
    }
    return { success: true, data: mapDbCustomerToCustomer(data) };
  } catch (err) {
    console.error('[SUPABASE ERROR] updateCustomerInSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function deleteCustomerFromSupabase(customerId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting customer:', customerId);
  try {
    const targetId = toSafeDbId(customerId) || customerId;
    const { error } = await supabase.from('customers').delete().eq('id', targetId);
    if (error) {
      console.error('[SUPABASE ERROR] deleteCustomerFromSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] deleteCustomerFromSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 4. SUPPLIERS API ---

export async function fetchSuppliersFromSupabase(): Promise<{ data: Supplier[]; error?: any }> {
  console.log('[SUPABASE] Fetching suppliers...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('suppliers');
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchSuppliersFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const suppliers = (data || []).map(mapDbSupplierToSupplier);
    console.log(`[SUPABASE] Loaded ${suppliers.length} suppliers`);
    return { data: suppliers };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchSuppliersFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertSupplierToSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  console.log('[SUPABASE] Inserting supplier:', supplier.id);
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await supabase.from('suppliers').insert([payload]).select().single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('suppliers').upsert([payload]).select().single();
      if (upsertErr) {
        console.error('[SUPABASE ERROR] insertSupplierToSupabase:', upsertErr);
        return { success: false, error: upsertErr };
      }
      return { success: true, data: mapDbSupplierToSupplier(upsertData) };
    }
    return { success: true, data: mapDbSupplierToSupplier(data) };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertSupplierToSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function updateSupplierInSupabase(supplier: Supplier): Promise<{ success: boolean; data?: Supplier; error?: any }> {
  console.log('[SUPABASE] Updating supplier:', supplier.id);
  try {
    const payload = mapSupplierToDbPayload(supplier);
    const { data, error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id).select().single();
    if (error) {
      const { data: upsertData, error: upsertErr } = await supabase.from('suppliers').upsert([payload]).select().single();
      if (upsertErr) {
        console.error('[SUPABASE ERROR] updateSupplierInSupabase:', upsertErr);
        return { success: false, error: upsertErr };
      }
      return { success: true, data: mapDbSupplierToSupplier(upsertData) };
    }
    return { success: true, data: mapDbSupplierToSupplier(data) };
  } catch (err) {
    console.error('[SUPABASE ERROR] updateSupplierInSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function deleteSupplierFromSupabase(supplierId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting supplier:', supplierId);
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) {
      console.error('[SUPABASE ERROR] deleteSupplierFromSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] deleteSupplierFromSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 5. SUPPLIER TRANSACTIONS API ---

export async function fetchSupplierTransactionsFromSupabase(): Promise<{ data: SupplierTransaction[]; error?: any }> {
  console.log('[SUPABASE] Fetching supplier transactions...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('supplier_transactions');
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchSupplierTransactionsFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const txs = (data || []).map(mapDbSupplierTxToSupplierTx);
    console.log(`[SUPABASE] Loaded ${txs.length} supplier transactions`);
    return { data: txs };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchSupplierTransactionsFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertSupplierTransactionToSupabase(tx: SupplierTransaction): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Inserting supplier transaction:', tx.id);
  try {
    const payload = mapSupplierTxToDbPayload(tx);
    const { error } = await supabase.from('supplier_transactions').upsert([payload]);
    if (error) {
      console.error('[SUPABASE ERROR] insertSupplierTransactionToSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertSupplierTransactionToSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 6. TRANSACTIONS & ITEMS API ---

export async function fetchTransactionsFromSupabase(): Promise<{ data: Transaction[]; error?: any }> {
  console.log('[SUPABASE] Fetching transactions & items...');
  try {
    const { data: txData, error: txError } = await fetchAllRowsFromSupabase('transactions', 'timestamp', false);

    if (txError && (!txData || txData.length === 0)) {
      console.warn('[SUPABASE] fetchTransactionsFromSupabase failed:', txError.message || txError);
      return { data: [], error: txError };
    }

    const { data: itemsData, error: itemsError } = await fetchAllRowsFromSupabase('transaction_items');
    if (itemsError) {
      console.warn('[SUPABASE] transaction_items select warning:', itemsError);
    }

    const itemsByTxId: Record<string, any[]> = {};
    if (itemsData && Array.isArray(itemsData)) {
      itemsData.forEach((item: any) => {
        const tid = String(item.transaction_id || item.transactionId);
        if (!itemsByTxId[tid]) itemsByTxId[tid] = [];
        itemsByTxId[tid].push({
          productId: String(item.product_id || item.productId || ''),
          productName: item.product_name || item.productName || 'منتج',
          sku: item.sku || '',
          quantity: Number(item.quantity || 1),
          priceTier: item.price_tier || item.priceTier || 'cash',
          unitPrice: Number(item.unit_price || item.unitPrice || 0),
          totalPrice: Number(item.total_price || item.totalPrice || 0),
          discountAmount: Number(item.discount_amount || item.discountAmount || 0),
          discountPercent: Number(item.discount_percent || item.discountPercent || 0),
          assignedAssociateId: item.assigned_associate_id || item.assignedAssociateId || undefined,
        });
      });
    }

    const transactions: Transaction[] = (txData || []).map((t: any) => {
      const id = String(t.id);
      const items = itemsByTxId[id] || (Array.isArray(t.items) ? t.items : []);
      return {
        id,
        receiptNumber: t.receipt_number || t.receiptNumber || `RCP-${id}`,
        timestamp: t.timestamp || t.created_at || new Date().toISOString(),
        items,
        subtotal: Number(t.subtotal || 0),
        discountTotal: Number(t.discount_total || t.discountTotal || 0),
        taxTotal: Number(t.tax_total || t.taxTotal || 0),
        grandTotal: Number(t.grand_total || t.grandTotal || 0),
        paymentMethod: t.payment_method || t.paymentMethod || 'كاش',
        paymentDetails: t.payment_details || t.paymentDetails || '',
        customerId: t.customer_id || t.customerId || undefined,
        customerName: t.customer_name || t.customerName || undefined,
        primaryAssociateId: t.primary_associate_id || t.primaryAssociateId || 'system',
        primaryAssociateName: t.primary_associate_name || t.primaryAssociateName || 'النظام',
        splitAssociates: Array.isArray(t.split_associates)
          ? t.split_associates
          : Array.isArray(t.splitAssociates)
            ? t.splitAssociates
            : undefined,
        commissions: Array.isArray(t.commissions) ? t.commissions : [],
        notes: t.notes || '',
        status: t.status || 'مكتملة',
        amountPaid: Number(t.amount_paid ?? t.amountPaid ?? t.grand_total ?? 0),
        amountDeferred: Number(t.amount_deferred ?? t.amountDeferred ?? 0),
        splitPayments: Array.isArray(t.split_payments)
          ? t.split_payments
          : Array.isArray(t.splitPayments)
            ? t.splitPayments
            : undefined,
        originalCart: t.original_cart || t.originalCart || undefined,
      };
    });

    console.log(`[SUPABASE] Loaded ${transactions.length} transactions`);
    return { data: transactions };
  } catch (err) {
    console.error('[SUPABASE ERROR] fetchTransactionsFromSupabase exception:', err);
    return { data: [], error: err };
  }
}

export async function insertTransactionToSupabase(transaction: Transaction): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Inserting transaction:', transaction.id);
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
    };

    const { error: txError } = await supabase.from('transactions').upsert([payload]);
    if (txError) {
      console.error('[SUPABASE ERROR] insertTransactionToSupabase tx record:', txError);
      return { success: false, error: txError };
    }

    // Insert items into transaction_items
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

      const { error: itemsError } = await supabase.from('transaction_items').insert(itemsPayload);
      if (itemsError) {
        console.warn('[SUPABASE] transaction_items insert error:', itemsError);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertTransactionToSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function deleteTransactionFromSupabase(transactionId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting transaction:', transactionId);
  try {
    await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
    const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
    if (error) {
      console.error('[SUPABASE ERROR] deleteTransactionFromSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] deleteTransactionFromSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 7. ASSOCIATES API ---

export async function fetchAssociatesFromSupabase(): Promise<{ data: Associate[]; error?: any }> {
  console.log('[SUPABASE] Fetching associates...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('associates');
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchAssociatesFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const associates = (data || []).map(mapDbAssociateToAssociate);
    console.log(`[SUPABASE] Loaded ${associates.length} associates`);
    return { data: associates };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchAssociatesFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertAssociateToSupabase(associate: Associate): Promise<{ success: boolean; data?: Associate; error?: any }> {
  console.log('[SUPABASE] Inserting associate:', associate.id);
  try {
    const payload = mapAssociateToDbPayload(associate);
    const { data, error } = await safeSupabaseMutation(
      async (p) => await supabase.from('associates').upsert([p]).select().single(),
      payload
    );
    if (error) {
      console.error('[SUPABASE ERROR] insertAssociateToSupabase:', error);
      return { success: false, error };
    }
    return { success: true, data: data ? mapDbAssociateToAssociate(data) : associate };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertAssociateToSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function updateAssociateInSupabase(associate: Associate): Promise<{ success: boolean; data?: Associate; error?: any }> {
  console.log('[SUPABASE] Updating associate:', associate.id);
  try {
    const payload = mapAssociateToDbPayload(associate);
    const { data, error } = await safeSupabaseMutation(
      async (p) => await supabase.from('associates').update(p).eq('id', associate.id).select().single(),
      payload
    );
    if (error) {
      const { data: upsertData, error: upsertErr } = await safeSupabaseMutation(
        async (p) => await supabase.from('associates').upsert([p]).select().single(),
        payload
      );
      if (upsertErr) {
        console.error('[SUPABASE ERROR] updateAssociateInSupabase:', upsertErr);
        return { success: false, error: upsertErr };
      }
      return { success: true, data: upsertData ? mapDbAssociateToAssociate(upsertData) : associate };
    }
    return { success: true, data: data ? mapDbAssociateToAssociate(data) : associate };
  } catch (err) {
    console.error('[SUPABASE ERROR] updateAssociateInSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function deleteAssociateFromSupabase(associateId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting associate:', associateId);
  try {
    const { error } = await supabase.from('associates').delete().eq('id', associateId);
    if (error) {
      console.error('[SUPABASE ERROR] deleteAssociateFromSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] deleteAssociateFromSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 8. CLOSED SHIFTS API ---

export async function fetchClosedShiftsFromSupabase(): Promise<{ data: ClosedShift[]; error?: any }> {
  console.log('[SUPABASE] Fetching closed shifts...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('closed_shifts', 'created_at', false);
    if (error && (!data || data.length === 0)) {
      console.warn('[SUPABASE] fetchClosedShiftsFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const shifts = (data || []).map(mapDbShiftToClosedShift);
    console.log(`[SUPABASE] Loaded ${shifts.length} closed shifts`);
    return { data: shifts };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchClosedShiftsFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertClosedShiftToSupabase(shift: ClosedShift): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Inserting closed shift:', shift.id);
  try {
    const payload = mapClosedShiftToDbPayload(shift);
    const { error } = await supabase.from('closed_shifts').upsert([payload]);
    if (error) {
      console.warn('[SUPABASE] insertClosedShiftToSupabase failed:', error.message || error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('[SUPABASE] insertClosedShiftToSupabase exception:', err?.message || String(err));
    return { success: false, error: err };
  }
}

// --- 9. EXPENSES API ---

export async function fetchExpensesFromSupabase(): Promise<{ data: POSExpense[]; error?: any }> {
  console.log('[SUPABASE] Fetching expenses...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('expenses');
    if (error && (!data || data.length === 0)) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        console.warn('[SUPABASE] Table "expenses" not found in schema cache. Returning empty list.');
        return { data: [] };
      }
      console.warn('[SUPABASE] fetchExpensesFromSupabase failed:', error.message || error);
      return { data: [], error };
    }
    const expenses = (data || []).map(mapDbExpenseToExpense);
    console.log(`[SUPABASE] Loaded ${expenses.length} expenses`);
    return { data: expenses };
  } catch (err: any) {
    console.warn('[SUPABASE] fetchExpensesFromSupabase exception:', err?.message || String(err));
    return { data: [], error: err };
  }
}

export async function insertExpenseToSupabase(expense: POSExpense): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Inserting expense:', expense.id);
  try {
    const payload = mapExpenseToDbPayload(expense);
    const { error } = await supabase.from('expenses').upsert([payload]);
    if (error) {
      console.error('[SUPABASE ERROR] insertExpenseToSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] insertExpenseToSupabase exception:', err);
    return { success: false, error: err };
  }
}

export async function deleteExpenseFromSupabase(expenseId: string): Promise<{ success: boolean; error?: any }> {
  console.log('[SUPABASE] Deleting expense:', expenseId);
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) {
      console.error('[SUPABASE ERROR] deleteExpenseFromSupabase:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('[SUPABASE ERROR] deleteExpenseFromSupabase exception:', err);
    return { success: false, error: err };
  }
}

// --- 10. DISCOUNTS API ---

export async function fetchDiscountsFromSupabase(): Promise<{ data: ProductDiscount[]; error?: any }> {
  console.log('[SUPABASE] Fetching discounts...');
  try {
    const { data, error } = await fetchAllRowsFromSupabase('discounts');
    if (error && (!data || data.length === 0)) {
      return { data: [] };
    }
    const discounts: ProductDiscount[] = (data || []).map((d: any) => ({
      productId: String(d.product_id || d.productId),
      type: d.type || 'percentage',
      value: Number(d.value || 0),
      isActive: d.is_active ?? d.isActive ?? true,
      applyTo: d.apply_to || d.applyTo || 'both',
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

// --- COMPATIBILITY ALIASES FOR EXISTING CODE ---
export const syncProductToSupabase = async (p: Product) => updateProductInSupabase(p);
export const syncCustomerToSupabase = async (c: Customer) => updateCustomerInSupabase(c);
export const syncSupplierToSupabase = async (s: Supplier) => updateSupplierInSupabase(s);
export const syncAssociateToSupabase = async (a: Associate) => updateAssociateInSupabase(a);
export const syncSupplierTransactionToSupabase = async (st: SupplierTransaction) => insertSupplierTransactionToSupabase(st);
export const syncExpenseToSupabase = async (e: POSExpense) => insertExpenseToSupabase(e);
export const syncClosedShiftToSupabase = async (cs: ClosedShift) => insertClosedShiftToSupabase(cs);
export const syncTransactionToSupabase = async (t: Transaction) => insertTransactionToSupabase(t);
