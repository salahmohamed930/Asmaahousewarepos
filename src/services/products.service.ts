import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { Product } from '../types';
import {
  mapDbProductToProduct,
  insertProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  bulkDeleteProductsFromSupabase,
  clearAllProductsFromSupabase,
} from '../lib/supabaseSync';

export const PRODUCT_SELECT_COLUMNS =
  'id, name, p_k, barcode, barcodes, alternative_barcodes, category, price, wholesale_price, price_installment, cost, stock_quantity, description, updated_at';

export interface GetProductsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  sort?: string;
  abortSignal?: AbortSignal;
}

export interface GetProductsResult {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: any;
}

export interface POSSearchOptions {
  search?: string;
  category?: string;
  limit?: number;
  abortSignal?: AbortSignal;
}

/**
 * 1. Server-side Paginated & Searched Products Query for Catalog Page
 */
export async function getProducts(options: GetProductsOptions = {}): Promise<GetProductsResult> {
  const {
    page = 1,
    pageSize = 50,
    search = '',
    category = 'الكل',
    sort = 'created_at_desc',
    abortSignal,
  } = options;

  const validPage = Math.max(1, page);
  const from = (validPage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const trimmedSearch = search.trim();
    // Clean special control characters for PostgREST
    const cleanSearch = trimmedSearch.replace(/[,(){}%\\"[\]]/g, '').trim();

    const buildQuery = (searchFilter?: string) => {
      let q = supabase.from('products').select(PRODUCT_SELECT_COLUMNS, { count: 'exact' });

      // Category filter in Supabase
      if (category && category !== 'الكل') {
        q = q.eq('category', category);
      }

      // Search filter
      if (searchFilter) {
        q = q.or(searchFilter);
      }

      // Server-side Sorting
      switch (sort) {
        case 'name_asc':
          q = q.order('name', { ascending: true });
          break;
        case 'name_desc':
          q = q.order('name', { ascending: false });
          break;
        case 'price_asc':
          q = q.order('price', { ascending: true });
          break;
        case 'price_desc':
          q = q.order('price', { ascending: false });
          break;
        case 'stock_asc':
          q = q.order('stock_quantity', { ascending: true });
          break;
        case 'stock_desc':
          q = q.order('stock_quantity', { ascending: false });
          break;
        case 'created_at_asc':
          q = q.order('id', { ascending: true });
          break;
        case 'created_at_desc':
        default:
          q = q.order('id', { ascending: false });
          break;
      }

      // Server-side Pagination Range
      q = q.range(from, to);

      if (abortSignal) {
        q = q.abortSignal(abortSignal);
      }

      return q;
    };

    let searchFilterString: string | undefined = undefined;
    if (cleanSearch.length > 0) {
      const terms: string[] = [
        `name.ilike."%${cleanSearch}%"`,
        `description.ilike."%${cleanSearch}%"`,
        `barcodes.cs.{"${cleanSearch}"}`,
        `alternative_barcodes.cs.{"${cleanSearch}"}`,
      ];
      if (/^\d+$/.test(cleanSearch)) {
        const num = Number(cleanSearch);
        if (!isNaN(num) && num <= 2147483647) {
          terms.push(`id.eq.${num}`);
          terms.push(`p_k.eq.${num}`);
        }
      }
      searchFilterString = terms.join(',');
    }

    let { data, error, count } = await buildQuery(searchFilterString);

    // If multi-column .or() filter threw a PostgREST error, fallback to name-only search
    if (error && searchFilterString && !error.message?.includes('aborted') && error.name !== 'AbortError') {
      console.warn('[products.service] Multi-column search error, falling back to name search:', error.message);
      const fallbackFilter = `name.ilike."%${cleanSearch}%"`;
      const fallbackRes = await buildQuery(fallbackFilter);
      data = fallbackRes.data;
      error = fallbackRes.error;
      count = fallbackRes.count;
    }

    // If Supabase returned 0 products and there's a search term, search local Dexie database
    if ((!data || data.length === 0) && cleanSearch.length > 0) {
      try {
        const qLower = cleanSearch.toLowerCase();
        const localMatches = await db.products
          .filter((p) => {
            return Boolean(
              (p.name && p.name.toLowerCase().includes(qLower)) ||
              (p.sku && p.sku.toLowerCase().includes(qLower)) ||
              (p.barcode && p.barcode.toLowerCase().includes(qLower)) ||
              (p.id && String(p.id).toLowerCase().includes(qLower)) ||
              (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase().includes(qLower))) ||
              (p.description && p.description.toLowerCase().includes(qLower))
            );
          })
          .toArray();

        if (localMatches.length > 0) {
          return {
            products: localMatches.slice(from, to + 1),
            totalCount: localMatches.length,
            page: validPage,
            pageSize,
            totalPages: Math.ceil(localMatches.length / pageSize) || 1,
          };
        }
      } catch (localErr) {
        console.warn('[products.service] Dexie search fallback error:', localErr);
      }
    }

    if (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return { products: [], totalCount: 0, page: validPage, pageSize, totalPages: 0, error };
      }
      console.error('[products.service] getProducts error:', error);
      return { products: [], totalCount: 0, page: validPage, pageSize, totalPages: 0, error };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const products = (data || []).map(mapDbProductToProduct);

    return {
      products,
      totalCount,
      page: validPage,
      pageSize,
      totalPages,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      return { products: [], totalCount: 0, page: validPage, pageSize, totalPages: 0 };
    }
    console.error('[products.service] getProducts exception:', err);
    return { products: [], totalCount: 0, page: validPage, pageSize, totalPages: 0, error: err };
  }
}

/**
 * 2. Optimized Server-side Product Search for POS / Invoice Page
 */
export async function searchProductsForPOS(options: POSSearchOptions = {}): Promise<{
  products: Product[];
  error?: any;
}> {
  const { search = '', category = 'الكل', limit = 25, abortSignal } = options;

  try {
    const trimmedSearch = search.trim();
    const cleanSearch = trimmedSearch.replace(/[,(){}%\\"[\]]/g, '').trim();

    const buildQuery = (searchFilter?: string) => {
      let q = supabase.from('products').select(PRODUCT_SELECT_COLUMNS);

      if (category && category !== 'الكل') {
        q = q.eq('category', category);
      }

      if (searchFilter) {
        q = q.or(searchFilter);
      }

      q = q.order('name', { ascending: true }).limit(limit);

      if (abortSignal) {
        q = q.abortSignal(abortSignal);
      }

      return q;
    };

    let searchFilterString: string | undefined = undefined;
    if (cleanSearch.length > 0) {
      const terms: string[] = [
        `name.ilike."%${cleanSearch}%"`,
        `description.ilike."%${cleanSearch}%"`,
        `barcodes.cs.{"${cleanSearch}"}`,
        `alternative_barcodes.cs.{"${cleanSearch}"}`,
      ];
      if (/^\d+$/.test(cleanSearch)) {
        const num = Number(cleanSearch);
        if (!isNaN(num) && num <= 2147483647) {
          terms.push(`id.eq.${num}`);
          terms.push(`p_k.eq.${num}`);
        }
      }
      searchFilterString = terms.join(',');
    }

    let { data, error } = await buildQuery(searchFilterString);

    if (error && searchFilterString && !error.message?.includes('aborted') && error.name !== 'AbortError') {
      console.warn('[products.service] searchProductsForPOS multi-column search failed, falling back to name search:', error.message);
      const fallbackFilter = `name.ilike."%${cleanSearch}%"`;
      const fallbackRes = await buildQuery(fallbackFilter);
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    // If Supabase returned 0 products and there's a search term, search local Dexie database
    if ((!data || data.length === 0) && cleanSearch.length > 0) {
      try {
        const qLower = cleanSearch.toLowerCase();
        const localMatches = await db.products
          .filter((p) => {
            return Boolean(
              (p.name && p.name.toLowerCase().includes(qLower)) ||
              (p.sku && p.sku.toLowerCase().includes(qLower)) ||
              (p.barcode && p.barcode.toLowerCase().includes(qLower)) ||
              (p.id && String(p.id).toLowerCase().includes(qLower)) ||
              (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase().includes(qLower)))
            );
          })
          .limit(limit)
          .toArray();

        if (localMatches.length > 0) {
          return { products: localMatches };
        }
      } catch (localErr) {
        console.warn('[products.service] searchProductsForPOS Dexie fallback error:', localErr);
      }
    }

    if (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return { products: [], error };
      }
      console.error('[products.service] searchProductsForPOS error:', error);
      return { products: [], error };
    }

    const products = (data || []).map(mapDbProductToProduct);
    return { products };
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      return { products: [] };
    }
    console.error('[products.service] searchProductsForPOS exception:', err);
    return { products: [], error: err };
  }
}

/**
 * 3. Exact Barcode / SKU Server-Side Lookup for Scanner
 */
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  try {
    const cleanSearch = cleanBarcode.replace(/[,(){}%\\"[\]]/g, '').trim();

    // 1. Direct query on barcodes arrays and p_k / id
    const terms: string[] = [
      `barcodes.cs.{"${cleanSearch}"}`,
      `alternative_barcodes.cs.{"${cleanSearch}"}`,
    ];
    if (/^\d+$/.test(cleanSearch)) {
      const num = Number(cleanSearch);
      if (!isNaN(num) && num <= 2147483647) {
        terms.push(`id.eq.${num}`);
        terms.push(`p_k.eq.${num}`);
      }
    }

    const { data: directData } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .or(terms.join(','))
      .limit(10);

    if (directData && directData.length > 0) {
      for (const item of directData) {
        const mapped = mapDbProductToProduct(item);
        if (
          mapped.barcode.toLowerCase() === cleanBarcode.toLowerCase() ||
          mapped.sku.toLowerCase() === cleanBarcode.toLowerCase() ||
          mapped.id.toLowerCase() === cleanBarcode.toLowerCase() ||
          (mapped.barcodes && mapped.barcodes.some((b) => b.toLowerCase() === cleanBarcode.toLowerCase()))
        ) {
          return mapped;
        }
      }
      return mapDbProductToProduct(directData[0]);
    }

    // 2. Search by string match for names/description
    const { data: searchData } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .or(`name.ilike."%${cleanSearch}%",description.ilike."%${cleanSearch}%"`)
      .limit(20);

    if (searchData && searchData.length > 0) {
      for (const item of searchData) {
        const mapped = mapDbProductToProduct(item);
        if (
          mapped.barcode.toLowerCase() === cleanBarcode.toLowerCase() ||
          mapped.sku.toLowerCase() === cleanBarcode.toLowerCase() ||
          mapped.id.toLowerCase() === cleanBarcode.toLowerCase() ||
          (mapped.barcodes && mapped.barcodes.some((b) => b.toLowerCase() === cleanBarcode.toLowerCase()))
        ) {
          return mapped;
        }
      }
    }

    // 3. Check local Dexie database for fast offline lookup
    try {
      const qLower = cleanBarcode.toLowerCase();
      const localProduct = await db.products
        .filter((p) => {
          return (
            p.barcode?.toLowerCase() === qLower ||
            p.sku?.toLowerCase() === qLower ||
            p.id?.toLowerCase() === qLower ||
            (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase() === qLower))
          );
        })
        .first();
      if (localProduct) return localProduct;
    } catch (e) {
      console.warn('[getProductByBarcode] Dexie lookup error:', e);
    }

    return null;
  } catch (err) {
    console.error('[products.service] getProductByBarcode exception:', err);
    return null;
  }
}

/**
 * 4. Get Single Product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  if (!id) return null;
  try {
    const idNum = !isNaN(Number(id)) ? Number(id) : null;
    let query = supabase.from('products').select(PRODUCT_SELECT_COLUMNS);
    if (idNum !== null) {
      query = query.eq('id', idNum);
    } else {
      query = query.eq('name', id);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return mapDbProductToProduct(data);
  } catch (err) {
    console.error('[products.service] getProductById exception:', err);
    return null;
  }
}

/**
 * 5. Distinct Categories Query
 */
export async function getCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('products').select('category');
    if (error || !data) return ['الكل'];
    const cats = Array.from(
      new Set(
        data
          .map((row: any) => row.category?.trim())
          .filter((cat: any): cat is string => Boolean(cat && cat !== 'الكل'))
      )
    );
    return ['الكل', ...cats];
  } catch {
    return ['الكل'];
  }
}

/**
 * 6. CRUD Operations Wrappers
 */
export async function createProduct(product: Partial<Product>): Promise<{ success: boolean; data?: Product; error?: any }> {
  return await insertProductToSupabase(product as Product);
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<{ success: boolean; data?: Product; error?: any }> {
  return await updateProductInSupabase({ ...product, id } as Product);
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: any }> {
  return await deleteProductFromSupabase(id);
}

export async function bulkDeleteProducts(ids: string[]): Promise<{ success: boolean; error?: any }> {
  return await bulkDeleteProductsFromSupabase(ids);
}

export async function clearAllProducts(): Promise<{ success: boolean; error?: any }> {
  return await clearAllProductsFromSupabase();
}

/**
 * 7. EAN-13 Check Digit Calculation
 */
export function calculateEan13CheckDigit(base12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i] || '0', 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

/**
 * 8. Build a standard 13-digit EAN-13 Barcode from a sequence number
 * Prefix: 622100 (Egypt standard retail prefix) + 6 digits + check digit
 */
export function buildEan13Barcode(num: number): string {
  const padded = String(Math.abs(num)).padStart(6, '0');
  const base12 = '622100' + padded.slice(-6);
  return base12 + calculateEan13CheckDigit(base12);
}

/**
 * 9. Check if a SKU or Barcode conflicts with any existing product
 * (checks both Dexie local cache and Supabase)
 */
export async function checkProductCodeConflict(
  code: string,
  excludeProductId?: string
): Promise<{ exists: boolean; conflictingProduct?: { id: string; name: string; sku: string; barcode: string } | null }> {
  const clean = code?.trim();
  if (!clean) return { exists: false, conflictingProduct: null };

  const cleanLower = clean.toLowerCase();

  // 1. Check local Dexie first for instant response
  try {
    const localMatch = await db.products
      .filter((p) => {
        if (excludeProductId && String(p.id) === String(excludeProductId)) return false;
        return Boolean(
          p.sku?.toLowerCase() === cleanLower ||
          p.barcode?.toLowerCase() === cleanLower ||
          (Array.isArray(p.barcodes) && p.barcodes.some((b) => b?.toLowerCase() === cleanLower)) ||
          (!isNaN(Number(clean)) && String(p.id) === clean)
        );
      })
      .first();

    if (localMatch) {
      return {
        exists: true,
        conflictingProduct: {
          id: String(localMatch.id),
          name: localMatch.name,
          sku: localMatch.sku,
          barcode: localMatch.barcode,
        },
      };
    }
  } catch (e) {
    console.warn('[checkProductCodeConflict] Dexie check error:', e);
  }

  // 2. Check Supabase
  try {
    const cleanSearch = clean.replace(/[,(){}%\\"[\]]/g, '').trim();
    const terms: string[] = [
      `barcodes.cs.{"${cleanSearch}"}`,
      `alternative_barcodes.cs.{"${cleanSearch}"}`,
    ];
    if (/^\d+$/.test(cleanSearch)) {
      const num = Number(cleanSearch);
      if (num <= 2147483647) {
        terms.push(`p_k.eq.${num}`);
        terms.push(`id.eq.${num}`);
      }
    }

    let query = supabase.from('products').select('id, name, p_k, barcodes').or(terms.join(','));
    if (excludeProductId && !isNaN(Number(excludeProductId))) {
      query = query.neq('id', Number(excludeProductId));
    }

    const { data, error } = await query.limit(1);
    if (!error && data && data.length > 0) {
      const p = data[0];
      return {
        exists: true,
        conflictingProduct: {
          id: String(p.id),
          name: p.name,
          sku: String(p.p_k || p.id),
          barcode: Array.isArray(p.barcodes) && p.barcodes.length > 0 ? p.barcodes[0] : String(p.p_k || p.id),
        },
      };
    }
  } catch (e) {
    console.warn('[checkProductCodeConflict] Supabase check error:', e);
  }

  return { exists: false, conflictingProduct: null };
}

/**
 * 10. Generate a guaranteed unique product code (SKU & EAN-13 Barcode)
 * Finds the max existing numeric code in Supabase & Dexie, then steps sequentially
 * ensuring no collision with existing products or codes in current session.
 */
export async function getNextUniqueProductCode(
  offset: number = 0,
  excludeCodes: Set<string> = new Set()
): Promise<{ sku: string; barcode: string }> {
  let maxCode = 24630;

  // 1. Fetch max p_k from Supabase
  try {
    const { data } = await supabase
      .from('products')
      .select('p_k')
      .order('p_k', { ascending: false })
      .limit(1);
    if (data && data.length > 0 && data[0]?.p_k) {
      const pNum = Number(data[0].p_k);
      if (!isNaN(pNum)) {
        maxCode = Math.max(maxCode, pNum);
      }
    }
  } catch (e) {
    console.warn('[products.service] error querying max p_k:', e);
  }

  // 2. Also check Dexie for any local items with higher codes
  try {
    const localMax = await db.products
      .filter((p) => !isNaN(Number(p.sku)))
      .toArray();
    for (const p of localMax) {
      const n = Number(p.sku);
      if (n > maxCode && n < 1000000) {
        maxCode = n;
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Increment sequentially with offset
  let candidateNum = maxCode + 1 + offset;
  let sku = String(candidateNum);
  let barcode = buildEan13Barcode(candidateNum);

  // 4. Ensure candidate doesn't conflict with excludeCodes or DB
  let attempts = 0;
  while (attempts < 100) {
    const inExclude = excludeCodes.has(sku) || excludeCodes.has(barcode);
    if (!inExclude) {
      const skuConflict = await checkProductCodeConflict(sku);
      const barcodeConflict = await checkProductCodeConflict(barcode);
      if (!skuConflict.exists && !barcodeConflict.exists) {
        break;
      }
    }
    candidateNum++;
    sku = String(candidateNum);
    barcode = buildEan13Barcode(candidateNum);
    attempts++;
  }

  return { sku, barcode };
}

export interface DuplicateCodeGroup {
  code: string;
  type: 'sku' | 'barcode';
  products: Product[];
}

/**
 * Check if a code is an empty or placeholder value that shouldn't trigger duplicate alerts
 */
export function isPlaceholderProductCode(code?: string | null): boolean {
  if (!code) return true;
  const c = String(code).trim().toLowerCase();
  if (!c || c === '0' || c === '00' || c === '000' || c === '0000' || c === '00000' || c === '000000') return true;
  if (c === '-' || c === '--' || c === '---' || c === 'none' || c === 'null' || c === 'undefined') return true;
  if (c === 'n/a' || c === 'na' || c === 'sku-000' || c === 'sku' || c === 'barcode' || c === 'لا يوجد' || c === 'بدون كود') return true;
  return false;
}

/**
 * 11. Scan a list of products to identify duplicate SKUs or Barcodes.
 * Returns a map of productId -> duplicate info.
 * Compares ONLY between DIFFERENT products and ignores placeholders and self-references.
 */
export function identifyDuplicateProductCodes(products: Product[]): Map<string, { code: string; type: 'sku' | 'barcode'; duplicateName: string }> {
  const duplicateMap = new Map<string, { code: string; type: 'sku' | 'barcode'; duplicateName: string }>();

  const skuTracker = new Map<string, Product[]>();
  const barcodeTracker = new Map<string, Product[]>();

  for (const p of products) {
    if (!p || !p.id) continue;

    // Check SKU
    if (!isPlaceholderProductCode(p.sku)) {
      const s = p.sku.trim().toLowerCase();
      if (!skuTracker.has(s)) skuTracker.set(s, []);
      const list = skuTracker.get(s)!;
      if (!list.some((item) => String(item.id) === String(p.id))) {
        list.push(p);
      }
    }

    // Collect all valid unique barcodes of THIS product
    const thisProductBarcodes = new Set<string>();
    if (!isPlaceholderProductCode(p.barcode)) {
      thisProductBarcodes.add(p.barcode.trim().toLowerCase());
    }
    if (Array.isArray(p.barcodes)) {
      for (const extra of p.barcodes) {
        if (!isPlaceholderProductCode(extra)) {
          thisProductBarcodes.add(String(extra).trim().toLowerCase());
        }
      }
    }

    for (const b of thisProductBarcodes) {
      if (!barcodeTracker.has(b)) barcodeTracker.set(b, []);
      const list = barcodeTracker.get(b)!;
      if (!list.some((item) => String(item.id) === String(p.id))) {
        list.push(p);
      }
    }
  }

  // Populate duplicateMap ONLY when 2 or more DIFFERENT products share the SKU
  for (const [code, prods] of skuTracker.entries()) {
    if (prods.length > 1) {
      for (const p of prods) {
        const other = prods.find((o) => String(o.id) !== String(p.id));
        if (other) {
          duplicateMap.set(p.id, {
            code: p.sku || code,
            type: 'sku',
            duplicateName: other.name,
          });
        }
      }
    }
  }

  // Populate duplicateMap ONLY when 2 or more DIFFERENT products share the Barcode
  for (const [code, prods] of barcodeTracker.entries()) {
    if (prods.length > 1) {
      for (const p of prods) {
        const other = prods.find((o) => String(o.id) !== String(p.id));
        if (other && !duplicateMap.has(p.id)) {
          duplicateMap.set(p.id, {
            code,
            type: 'barcode',
            duplicateName: other.name,
          });
        }
      }
    }
  }

  return duplicateMap;
}

/**
 * 12. Fetch ALL duplicate products across the entire catalog (Supabase & Dexie).
 * Groups items sharing the exact same SKU or Barcodes together so the user can easily see and resolve them.
 */
export async function fetchDuplicateProductsAcrossCatalog(): Promise<{
  groups: DuplicateCodeGroup[];
  allDuplicateProducts: Product[];
  duplicateMap: Map<string, { code: string; type: 'sku' | 'barcode'; conflictingProducts: string[]; groupIndex: number }>;
}> {
  try {
    let products: Product[] = await db.products.toArray();
    if (products.length === 0) {
      let allDbRows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_SELECT_COLUMNS)
          .order('id')
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        allDbRows.push(...data);
        from += 1000;
        if (data.length < 1000) break;
      }
      if (allDbRows.length > 0) {
        products = allDbRows.map(mapDbProductToProduct);
      }
    }

    const codeToProducts = new Map<string, Product[]>();

    for (const p of products) {
      if (!p || !p.id) continue;

      // 1. SKU tracking
      if (!isPlaceholderProductCode(p.sku)) {
        const sKey = `SKU:${p.sku.trim().toLowerCase()}`;
        if (!codeToProducts.has(sKey)) codeToProducts.set(sKey, []);
        const existing = codeToProducts.get(sKey)!;
        if (!existing.some((x) => String(x.id) === String(p.id))) {
          existing.push(p);
        }
      }

      // 2. Barcode tracking (primary + array)
      const allBarcodes = new Set<string>();
      if (!isPlaceholderProductCode(p.barcode)) {
        allBarcodes.add(p.barcode.trim().toLowerCase());
      }
      if (Array.isArray(p.barcodes)) {
        p.barcodes.forEach((b) => {
          if (!isPlaceholderProductCode(b)) {
            allBarcodes.add(String(b).trim().toLowerCase());
          }
        });
      }

      for (const b of allBarcodes) {
        const bKey = `BARCODE:${b}`;
        if (!codeToProducts.has(bKey)) codeToProducts.set(bKey, []);
        const existing = codeToProducts.get(bKey)!;
        if (!existing.some((x) => String(x.id) === String(p.id))) {
          existing.push(p);
        }
      }
    }

    const groups: DuplicateCodeGroup[] = [];
    const duplicateMap = new Map<string, { code: string; type: 'sku' | 'barcode'; conflictingProducts: string[]; groupIndex: number }>();
    const seenProductIds = new Set<string>();
    const allDuplicateProducts: Product[] = [];

    let groupIdx = 0;
    for (const [codeKey, prods] of codeToProducts.entries()) {
      if (prods.length > 1) {
        const isSku = codeKey.startsWith('SKU:');
        const rawCode = codeKey.replace(/^(SKU:|BARCODE:)/, '');
        groups.push({
          code: rawCode,
          type: isSku ? 'sku' : 'barcode',
          products: prods,
        });

        for (const p of prods) {
          const otherNames = prods.filter((other) => String(other.id) !== String(p.id)).map((o) => o.name);
          duplicateMap.set(String(p.id), {
            code: rawCode,
            type: isSku ? 'sku' : 'barcode',
            conflictingProducts: otherNames,
            groupIndex: groupIdx,
          });

          if (!seenProductIds.has(String(p.id))) {
            seenProductIds.add(String(p.id));
            allDuplicateProducts.push(p);
          }
        }
        groupIdx++;
      }
    }

    return { groups, allDuplicateProducts, duplicateMap };
  } catch (err) {
    console.error('[fetchDuplicateProductsAcrossCatalog] error:', err);
    return { groups: [], allDuplicateProducts: [], duplicateMap: new Map() };
  }
}

