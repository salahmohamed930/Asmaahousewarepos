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
      let q = supabase.from('products').select('*', { count: 'exact' });

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
      let q = supabase.from('products').select('*');

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
      .select('*')
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
      .select('*')
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
    let query = supabase.from('products').select('*');
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
