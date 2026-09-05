import React, { useState, useEffect, useCallback } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { ProductLabelModal } from './ProductLabelModal';
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  bulkDeleteProducts as bulkDeleteProductsService,
  clearAllProducts as clearAllProductsService,
  getNextUniqueProductCode,
  checkProductCodeConflict,
  identifyDuplicateProductCodes,
  fetchDuplicateProductsAcrossCatalog,
  DuplicateCodeGroup,
} from '../../services/products.service';
import {
  Package,
  Plus,
  Search,
  Edit,
  Tag,
  Barcode,
  X,
  AlertTriangle,
  DollarSign,
  Check,
  List,
  LayoutGrid,
  Printer,
  RefreshCw,
  FolderPlus,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Copy,
} from 'lucide-react';

export const CatalogView: React.FC = () => {
  const {
    settings,
    hasPermission,
  } = usePOS();

  const canAdd = hasPermission('add_products');
  const canEdit = hasPermission('edit_products');
  const canDelete = hasPermission('delete_products');
  const canViewCash = hasPermission('view_cash_price');
  const canViewInstallment = hasPermission('view_installment_price');
  const canViewWholesale = hasPermission('view_wholesale_price');
  const canViewCost = hasPermission('view_cost_price');

  // --- Server-side pagination, search, category & sort state ---
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [sort, setSort] = useState<string>('created_at_desc');

  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(['الكل']);

  const [layoutMode, setLayoutMode] = useState<'rows' | 'grid'>('rows');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [labelProducts, setLabelProducts] = useState<Product[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Remember last chosen category
  const [lastChosenCategory] = useState(() => {
    return localStorage.getItem('last_chosen_category') || 'أطقم طهي وحلل';
  });

  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [extraBarcodeEntry, setExtraBarcodeEntry] = useState('');

  const handleAddExtraBarcode = () => {
    const trimmed = extraBarcodeEntry.trim();
    if (!trimmed) return;
    const newCodes = trimmed.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    const existing = formData.barcodes || [];
    const updated = Array.from(new Set([...existing, ...newCodes]));
    setFormData((prev) => ({ ...prev, barcodes: updated }));
    setExtraBarcodeEntry('');
  };

  const handleRemoveExtraBarcode = (codeToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      barcodes: (prev.barcodes || []).filter(c => c !== codeToRemove)
    }));
  };

  // Bulk selection states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Bulk add multiple products states
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkAddRows, setBulkAddRows] = useState<any[]>([
    { name: '', sku: '', barcode: '', category: 'أطقم طهي وحلل', cost: 0, priceCash: 0, priceWholesale: 0, priceInstallment: 0, stock: 10 }
  ]);

  // Duplicate codes filter state & Conflict states
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateCodeGroup[]>([]);
  const [duplicateProductsList, setDuplicateProductsList] = useState<Product[]>([]);
  const [duplicateMap, setDuplicateMap] = useState<Map<string, { code: string; type: 'sku' | 'barcode'; conflictingProducts: string[]; groupIndex: number }>>(new Map());
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [duplicatesLoaded, setDuplicatesLoaded] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [skuConflict, setSkuConflict] = useState<{ exists: boolean; name?: string; sku?: string } | null>(null);
  const [barcodeConflict, setBarcodeConflict] = useState<{ exists: boolean; name?: string; barcode?: string } | null>(null);

  // Scan current catalog page for local duplicate SKUs and Barcodes
  const duplicateCodesMap = React.useMemo(() => {
    return identifyDuplicateProductCodes(catalogProducts);
  }, [catalogProducts]);

  // Load all duplicate products across the entire database
  const loadDuplicates = useCallback(async () => {
    setIsLoadingDuplicates(true);
    try {
      const res = await fetchDuplicateProductsAcrossCatalog();
      setDuplicateGroups(res.groups);
      setDuplicateProductsList(res.allDuplicateProducts);
      setDuplicateMap(res.duplicateMap);
      setDuplicatesLoaded(true);
    } catch (e) {
      console.error('[CatalogView] Error loading duplicate products:', e);
    } finally {
      setIsLoadingDuplicates(false);
    }
  }, []);

  // Fetch duplicates once on catalog mount to populate counter badge
  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  // Handle clicking the "الأكواد المتشابهة" button
  const handleToggleDuplicates = () => {
    const nextVal = !filterDuplicatesOnly;
    setFilterDuplicatesOnly(nextVal);
    if (nextVal && (!duplicatesLoaded || duplicateProductsList.length === 0)) {
      loadDuplicates();
    }
  };

  // Filtered products: if filterDuplicatesOnly is active, show the duplicate items across the entire catalog
  const displayedProducts = React.useMemo(() => {
    if (!filterDuplicatesOnly) return catalogProducts;

    let list = duplicateProductsList;
    if (selectedCategory && selectedCategory !== 'الكل') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        (Array.isArray(p.barcodes) && p.barcodes.some((b) => b?.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [filterDuplicatesOnly, catalogProducts, duplicateProductsList, selectedCategory, debouncedSearch]);

  // Debounce search input (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 whenever search query, selected category, sort option, or page size changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, sort, pageSize]);

  // Fetch products from Supabase with Server-Side Search & Pagination
  const fetchCatalogProducts = useCallback(async (abortSignal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getProducts({
        page,
        pageSize,
        search: debouncedSearch,
        category: selectedCategory,
        sort,
        abortSignal,
      });

      if (res.error) {
        if (res.error.name !== 'AbortError' && !res.error.message?.includes('aborted')) {
          setErrorMsg('فشل في تحميل المنتجات من Supabase');
        }
      } else {
        setCatalogProducts(res.products);
        setTotalCount(res.totalCount);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.message?.includes('aborted')) {
        setErrorMsg('حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedCategory, sort]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchCatalogProducts(abortController.signal);
    return () => abortController.abort();
  }, [fetchCatalogProducts]);

  // Dynamic Categories query
  useEffect(() => {
    getCategories().then((dbCats) => {
      const combined = Array.from(
        new Set(['الكل', ...(settings?.categories || []), ...dbCats])
      );
      setCategories(combined);
    });
  }, [settings?.categories]);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCatalogProducts();
    setIsRefreshing(false);
  };

  // Pricing helper functions based on settings profit margins
  const getMarginsForCategory = (catName: string) => {
    const catMargins = settings?.profitMargins?.categories?.[catName];
    const defaultMargins = settings?.profitMargins?.default || { cash: 20, wholesale: 10, installment: 30 };
    return catMargins || defaultMargins;
  };

  const calculatePricesFromCost = (costValue: number, catName: string) => {
    const margins = getMarginsForCategory(catName);
    return {
      priceCash: Math.round(costValue * (1 + margins.cash / 100)),
      priceWholesale: Math.round(costValue * (1 + margins.wholesale / 100)),
      priceInstallment: Math.round(costValue * (1 + margins.installment / 100)),
    };
  };

  const handleFormCategoryChange = (newCat: string) => {
    setFormData((prev) => {
      if (prev.cost > 0) {
        const prices = calculatePricesFromCost(prev.cost, newCat);
        return { ...prev, category: newCat, ...prices };
      }
      return { ...prev, category: newCat };
    });
  };

  const handleFormCostChange = (newCost: number) => {
    setFormData((prev) => {
      if (newCost > 0) {
        const prices = calculatePricesFromCost(newCost, prev.category);
        return { ...prev, cost: newCost, ...prices };
      }
      return { ...prev, cost: newCost };
    });
  };

  // Bulk edit form states
  const [bulkForm, setBulkForm] = useState({
    changeCategory: false,
    category: '',
    changePrices: false,
    priceType: 'all',
    priceAction: 'increase',
    priceValue: 0,
    changeStock: false,
    stockAction: 'add',
    stockValue: 0,
  });

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'أطقم طهي وحلل',
    priceCash: 0,
    priceInstallment: 0,
    priceWholesale: 0,
    cost: 0,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
    description: '',
    barcodes: [] as string[],
  });

  const handleBulkAddRowChange = (index: number, key: string, val: any) => {
    setBulkAddRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: val };

      if (key === 'cost' || key === 'category') {
        const costVal = parseFloat(key === 'cost' ? val : updated[index].cost) || 0;
        const catName = key === 'category' ? val : updated[index].category;
        if (costVal > 0) {
          const calculated = calculatePricesFromCost(costVal, catName);
          updated[index].priceCash = calculated.priceCash;
          updated[index].priceWholesale = calculated.priceWholesale;
          updated[index].priceInstallment = calculated.priceInstallment;
        }
      }
      return updated;
    });
  };

  // Debounced check for SKU conflict in add/edit modal
  useEffect(() => {
    if (!isModalOpen || !formData.sku?.trim()) {
      setSkuConflict(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await checkProductCodeConflict(formData.sku, editingProduct?.id);
      if (res.exists && res.conflictingProduct) {
        setSkuConflict({ exists: true, name: res.conflictingProduct.name, sku: res.conflictingProduct.sku });
      } else {
        setSkuConflict(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [formData.sku, isModalOpen, editingProduct?.id]);

  // Debounced check for Barcode conflict in add/edit modal
  useEffect(() => {
    if (!isModalOpen || !formData.barcode?.trim()) {
      setBarcodeConflict(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await checkProductCodeConflict(formData.barcode, editingProduct?.id);
      if (res.exists && res.conflictingProduct) {
        setBarcodeConflict({ exists: true, name: res.conflictingProduct.name, barcode: res.conflictingProduct.barcode });
      } else {
        setBarcodeConflict(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [formData.barcode, isModalOpen, editingProduct?.id]);

  // Generate unique codes for single add/edit product
  const handleGenerateUniqueCodes = async () => {
    setIsGeneratingCode(true);
    try {
      const next = await getNextUniqueProductCode(0);
      setFormData((prev) => ({
        ...prev,
        sku: next.sku,
        barcode: next.barcode,
        barcodes: next.barcode ? [next.barcode, ...(prev.barcodes || []).filter((b) => b !== prev.barcode)] : prev.barcodes,
      }));
      setSkuConflict(null);
      setBarcodeConflict(null);
    } catch (e) {
      console.error('Error generating unique codes:', e);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const addBulkAddRow = async () => {
    const usedCodes = new Set<string>();
    bulkAddRows.forEach((r) => {
      if (r.sku) usedCodes.add(String(r.sku).trim());
      if (r.barcode) usedCodes.add(String(r.barcode).trim());
    });

    const nextCode = await getNextUniqueProductCode(bulkAddRows.length, usedCodes);
    setBulkAddRows((prev) => [
      ...prev,
      {
        name: '',
        sku: nextCode.sku,
        barcode: nextCode.barcode,
        category: lastChosenCategory,
        cost: 0,
        priceCash: 0,
        priceWholesale: 0,
        priceInstallment: 0,
        stock: 10,
      },
    ]);
  };

  const regenerateRowCode = async (index: number) => {
    const usedCodes = new Set<string>();
    bulkAddRows.forEach((r, i) => {
      if (i !== index) {
        if (r.sku) usedCodes.add(String(r.sku).trim());
        if (r.barcode) usedCodes.add(String(r.barcode).trim());
      }
    });

    const nextCode = await getNextUniqueProductCode(index, usedCodes);
    setBulkAddRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        sku: nextCode.sku,
        barcode: nextCode.barcode,
      };
      return updated;
    });
  };

  const removeBulkAddRow = (index: number) => {
    if (bulkAddRows.length <= 1) return;
    setBulkAddRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenBulkAdd = async () => {
    setIsGeneratingCode(true);
    try {
      const nextCode = await getNextUniqueProductCode(0);
      setBulkAddRows([
        {
          name: '',
          sku: nextCode.sku,
          barcode: nextCode.barcode,
          category: lastChosenCategory,
          cost: 0,
          priceCash: 0,
          priceWholesale: 0,
          priceInstallment: 0,
          stock: 10,
        },
      ]);
    } finally {
      setIsGeneratingCode(false);
    }
    setIsBulkAddModalOpen(true);
  };

  const handleSaveBulkAdd = async () => {
    const invalidRowIndex = bulkAddRows.findIndex((row) => !row.name.trim());
    if (invalidRowIndex !== -1) {
      alert(`يرجى إدخال اسم الصنف في الصف رقم ${invalidRowIndex + 1}`);
      return;
    }

    // 1. Check for duplicate SKUs or Barcodes within the modal rows
    const skuSeen = new Map<string, number>();
    const barcodeSeen = new Map<string, number>();
    for (let i = 0; i < bulkAddRows.length; i++) {
      const row = bulkAddRows[i];
      if (row.sku?.trim()) {
        const s = row.sku.trim();
        if (skuSeen.has(s)) {
          alert(`تنبيه: الكود (SKU) "${s}" مكرر في الصف ${i + 1} والصف ${skuSeen.get(s)! + 1}. يجب أن يكون كود كل صنف مميزاً وغير متشابه.`);
          return;
        }
        skuSeen.set(s, i);
      }
      if (row.barcode?.trim()) {
        const b = row.barcode.trim();
        if (barcodeSeen.has(b)) {
          alert(`تنبيه: الباركود "${b}" مكرر في الصف ${i + 1} والصف ${barcodeSeen.get(b)! + 1}.`);
          return;
        }
        barcodeSeen.set(b, i);
      }
    }

    // 2. Check for conflicts with existing database products
    for (let i = 0; i < bulkAddRows.length; i++) {
      const row = bulkAddRows[i];
      if (row.sku?.trim()) {
        const conflict = await checkProductCodeConflict(row.sku.trim());
        if (conflict.exists && conflict.conflictingProduct) {
          alert(`تنبيه في الصف رقم ${i + 1}: الكود (SKU) "${row.sku}" مستخدم بالفعل للمنتج "${conflict.conflictingProduct.name}". يرجى تعديل الكود لتجنب تكرار الأكواد.`);
          return;
        }
      }
      if (row.barcode?.trim()) {
        const bConflict = await checkProductCodeConflict(row.barcode.trim());
        if (bConflict.exists && bConflict.conflictingProduct) {
          alert(`تنبيه في الصف رقم ${i + 1}: الباركود "${row.barcode}" مستخدم بالفعل للمنتج "${bConflict.conflictingProduct.name}". يرجى تعديله.`);
          return;
        }
      }
    }

    for (const row of bulkAddRows) {
      await createProduct({
        name: row.name,
        sku: row.sku || '',
        barcode: row.barcode || '',
        category: row.category,
        cost: Number(row.cost),
        priceCash: Number(row.priceCash),
        priceWholesale: Number(row.priceWholesale),
        priceInstallment: Number(row.priceInstallment),
        stock: Number(row.stock),
        image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
        description: 'صنف مضاف من خلال الإضافة المتعددة',
        barcodes: row.barcode ? [row.barcode] : [],
      });
    }

    setIsBulkAddModalOpen(false);
    fetchCatalogProducts();
    loadDuplicates();
  };

  const handleOpenAdd = async () => {
    setEditingProduct(null);
    setIsGeneratingCode(true);
    try {
      const nextCode = await getNextUniqueProductCode(0);
      setFormData({
        name: '',
        sku: nextCode.sku,
        barcode: nextCode.barcode,
        category: lastChosenCategory,
        priceCash: 0,
        priceInstallment: 0,
        priceWholesale: 0,
        cost: 0,
        stock: 10,
        image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=500&q=80',
        description: '',
        barcodes: nextCode.barcode ? [nextCode.barcode] : [],
      });
      setSkuConflict(null);
      setBarcodeConflict(null);
    } finally {
      setIsGeneratingCode(false);
    }
    setExtraBarcodeEntry('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      priceCash: p.priceCash,
      priceInstallment: p.priceInstallment,
      priceWholesale: p.priceWholesale,
      cost: p.cost,
      stock: p.stock,
      image: p.image,
      description: p.description || '',
      barcodes: p.barcodes || (p.barcode ? [p.barcode] : []),
    });
    setSkuConflict(null);
    setBarcodeConflict(null);
    setExtraBarcodeEntry('');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // Check SKU conflict before saving
    if (formData.sku?.trim()) {
      const skuCheck = await checkProductCodeConflict(formData.sku.trim(), editingProduct?.id);
      if (skuCheck.exists && skuCheck.conflictingProduct) {
        alert(`لا يمكن حفظ الصنف: كود المنتج (SKU) "${formData.sku}" مستخدم بالفعل للصنف "${skuCheck.conflictingProduct.name}". يرجى اختيار كود فريد.`);
        return;
      }
    }

    // Check Barcode conflict before saving
    if (formData.barcode?.trim()) {
      const barcodeCheck = await checkProductCodeConflict(formData.barcode.trim(), editingProduct?.id);
      if (barcodeCheck.exists && barcodeCheck.conflictingProduct) {
        alert(`لا يمكن حفظ الصنف: الباركود "${formData.barcode}" مستخدم بالفعل للصنف "${barcodeCheck.conflictingProduct.name}". يرجى اختيار باركود فريد.`);
        return;
      }
    }

    localStorage.setItem('last_chosen_category', formData.category);

    const productPayload: Partial<Product> = {
      id: editingProduct?.id,
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode,
      category: formData.category,
      priceCash: Number(formData.priceCash),
      priceInstallment: Number(formData.priceInstallment),
      priceWholesale: Number(formData.priceWholesale),
      cost: Number(formData.cost),
      stock: Number(formData.stock),
      image: formData.image,
      description: formData.description,
      barcodes: formData.barcodes || (formData.barcode ? [formData.barcode] : []),
    };

    if (editingProduct) {
      const updatedProduct = { ...editingProduct, ...productPayload } as Product;
      setCatalogProducts((prev) => prev.map((p) => (String(p.id) === String(editingProduct.id) ? updatedProduct : p)));
      setDuplicateProductsList((prev) => prev.map((p) => (String(p.id) === String(editingProduct.id) ? updatedProduct : p)));

      await updateProductService(editingProduct.id, productPayload);
    } else {
      await createProduct(productPayload);
    }

    setIsModalOpen(false);
    await loadDuplicates();
    await fetchCatalogProducts();
  };

  const handleApplyBulkEdit = async () => {
    if (selectedProductIds.length === 0) return;

    for (const id of selectedProductIds) {
      const p = catalogProducts.find((prod) => prod.id === id);
      if (!p) continue;

      const updated: Partial<Product> = { ...p };

      if (bulkForm.changeCategory && bulkForm.category) {
        updated.category = bulkForm.category;
      }

      if (bulkForm.changeStock) {
        if (bulkForm.stockAction === 'add') {
          updated.stock = (p.stock || 0) + Number(bulkForm.stockValue);
        } else {
          updated.stock = Number(bulkForm.stockValue);
        }
      }

      if (bulkForm.changePrices) {
        const val = Number(bulkForm.priceValue);
        const applyToPrice = (current: number) => {
          if (bulkForm.priceAction === 'increase_percent') return Math.round(current * (1 + val / 100));
          if (bulkForm.priceAction === 'decrease_percent') return Math.round(Math.max(0, current * (1 - val / 100)));
          if (bulkForm.priceAction === 'fixed') return val;
          if (bulkForm.priceAction === 'increase') return current + val;
          if (bulkForm.priceAction === 'decrease') return Math.max(0, current - val);
          return current;
        };

        if (bulkForm.priceType === 'all' || bulkForm.priceType === 'cash') {
          updated.priceCash = applyToPrice(p.priceCash);
        }
        if (bulkForm.priceType === 'all' || bulkForm.priceType === 'installment') {
          updated.priceInstallment = applyToPrice(p.priceInstallment);
        }
        if (bulkForm.priceType === 'all' || bulkForm.priceType === 'wholesale') {
          updated.priceWholesale = applyToPrice(p.priceWholesale);
        }
        if (bulkForm.priceType === 'all' || bulkForm.priceType === 'cost') {
          updated.cost = applyToPrice(p.cost);
        }
      }

      await updateProductService(id, updated);
    }

    setSelectedProductIds([]);
    setIsBulkModalOpen(false);
    await loadDuplicates();
    await fetchCatalogProducts();
  };

  const handleDeleteProduct = async (p: Product) => {
    if (window.confirm(`هل أنت متأكد من حذف الصنف "${p.name}"؟ سيتم حذفه من قاعدة البيانات أيضاً.`)) {
      setCatalogProducts((prev) => prev.filter((item) => String(item.id) !== String(p.id)));
      setDuplicateProductsList((prev) => prev.filter((item) => String(item.id) !== String(p.id)));
      await deleteProductService(p.id);
      await loadDuplicates();
      await fetchCatalogProducts();
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedProductIds.length} صنف محدد؟ سيتم حذفها نهائياً من قاعدة البيانات.`)) {
      setCatalogProducts((prev) => prev.filter((item) => !selectedProductIds.includes(item.id)));
      setDuplicateProductsList((prev) => prev.filter((item) => !selectedProductIds.includes(item.id)));
      await bulkDeleteProductsService(selectedProductIds);
      setSelectedProductIds([]);
      await loadDuplicates();
      await fetchCatalogProducts();
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('تنبيه هام: هل أنت متأكد من مسح وتفريغ جميع الأصناف بالكامل؟\nسيتم تفريغ السجل ومسح الأصناف في قاعدة البيانات.')) {
      setCatalogProducts([]);
      setDuplicateProductsList([]);
      await clearAllProductsService();
      setSelectedProductIds([]);
      await loadDuplicates();
      await fetchCatalogProducts();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3.5">
      {/* Controls & Search Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col gap-4">
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box & Add Button */}
          <div className="flex items-center gap-2 flex-1 max-w-xl w-full">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="بحث بالكود، الباركود، أو اسم المنتج (Server-Side)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 text-xs text-stone-200 rounded-xl pr-10 pl-8 py-2.5 focus:outline-none focus:border-amber-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 transition-colors"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {canAdd && (
              <button
                onClick={handleOpenAdd}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 space-x-reverse shrink-0 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف جديد</span>
              </button>
            )}
          </div>

          {/* Action Tools & Sort/View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedProductIds.length > 0 && (
              <div className="flex items-center space-x-2 space-x-reverse bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                <span className="text-xs font-bold text-amber-400">
                  محدد ({selectedProductIds.length})
                </span>
                <button
                  onClick={() => {
                    const selectedProds = catalogProducts.filter((p) => selectedProductIds.includes(p.id));
                    setLabelProducts(selectedProds);
                  }}
                  className="py-1 px-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg text-xs transition-all flex items-center space-x-1 space-x-reverse shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                {canEdit && (
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="py-1 px-2.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-200 font-bold rounded-lg text-xs transition-all"
                  >
                    تعديل جماعي
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleBulkDelete}
                    className="py-1 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 font-bold rounded-lg text-xs transition-all flex items-center space-x-1 space-x-reverse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-2 bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl transition-all disabled:opacity-50"
              title="تحديث البيانات من Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            {canAdd && (
              <button
                onClick={handleOpenBulkAdd}
                className="py-2 px-3 bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-800 rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 space-x-reverse transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>إضافة أصناف متعددة</span>
              </button>
            )}

            {/* Filter Duplicate / Similar Codes Toggle */}
            <button
              type="button"
              onClick={handleToggleDuplicates}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse border ${
                filterDuplicatesOnly
                  ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-sm ring-1 ring-rose-500/30'
                  : 'bg-stone-950 hover:bg-stone-800 text-stone-300 border-stone-800'
              }`}
              title="تصفية وعرض جميع الأصناف التي تشترك في نفس الكود أو الباركود عبر كامل الكتالوج"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${filterDuplicatesOnly ? 'text-rose-400 animate-pulse' : (duplicateGroups.length > 0 ? 'text-rose-400' : 'text-stone-500')}`} />
              <span>الأكواد المتشابهة</span>
              {isLoadingDuplicates ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              ) : duplicateGroups.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-mono font-bold">
                  {duplicateGroups.length}
                </span>
              ) : null}
            </button>

            {/* Sorting Select */}
            <div className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-stone-300 font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="created_at_desc">الأحدث إضافة</option>
                <option value="created_at_asc">الأقدم إضافة</option>
                <option value="name_asc">الاسم (أ - ي)</option>
                <option value="name_desc">الاسم (ي - أ)</option>
                <option value="price_asc">السعر (الأقل أولاً)</option>
                <option value="price_desc">السعر (الأعلى أولاً)</option>
                <option value="stock_asc">المخزون (الأقل أولاً)</option>
                <option value="stock_desc">المخزون (الأعلى أولاً)</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="bg-stone-950 border border-stone-800 p-1 rounded-xl flex items-center space-x-1 space-x-reverse shrink-0">
              <button
                onClick={() => setLayoutMode('rows')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse ${
                  layoutMode === 'rows'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="عرض كصفوف"
              >
                <List className="w-4 h-4" />
                <span className="text-[11px] font-bold">صفوف</span>
              </button>
              <button
                onClick={() => setLayoutMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse ${
                  layoutMode === 'grid'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="عرض كشبكة كروت"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-[11px] font-bold">شبكة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="border-t border-stone-800/60 pt-3">
          <div className="flex items-center space-x-2 space-x-reverse mb-2 text-stone-400 text-xs font-bold">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <span>تصنيفات المنتجات:</span>
          </div>
          
          <div 
            className="flex overflow-x-auto pb-1.5 gap-2 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent" 
            style={{ 
              scrollbarWidth: 'thin', 
              scrollbarColor: '#292524 transparent',
              direction: 'rtl'
            }}
          >
            {categories.map((c, idx) => (
              <button
                key={`cat_${c}_${idx}`}
                onClick={() => setSelectedCategory(c)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === c
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Duplicate Codes Filter Banner */}
      {filterDuplicatesOnly && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start sm:items-center space-x-3 space-x-reverse">
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-rose-200">
                  عرض الأصناف ذات الأكواد أو الباركودات المتشابهة
                </h3>
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-2 py-0.5 rounded-full font-bold font-mono">
                  {duplicateGroups.length} مجموعة تشابه ({duplicateProductsList.length} صنف مكرر)
                </span>
              </div>
              <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                يتم عرض الأصناف التي تشترك في نفس كود المنتج (SKU) أو الباركود معاً لتسهيل مراجعتها وتوليد كود فريد لمنع التعارض في نقاط البيع والفواتير.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadDuplicates}
              disabled={isLoadingDuplicates}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="إعادة فحص قاعدة البيانات للأكواد المتشابهة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDuplicates ? 'animate-spin text-amber-400' : ''}`} />
              <span>تحديث الفحص</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterDuplicatesOnly(false)}
              className="px-3 py-1.5 bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 rounded-xl text-xs font-bold transition-colors"
            >
              عرض جميع الأصناف
            </button>
          </div>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-stone-300">جاري تحميل الأصناف مباشرة من Supabase...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-rose-200">{errorMsg}</p>
          <button
            onClick={() => fetchCatalogProducts()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : layoutMode === 'rows' ? (
        /* Rows Layout Table */
        <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-stone-950 text-[10px] font-extrabold text-stone-400 uppercase tracking-wider border-b border-stone-800">
                  <th className="py-2 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={catalogProducts.length > 0 && catalogProducts.every(p => selectedProductIds.includes(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds(catalogProducts.map((p) => p.id));
                        } else {
                          setSelectedProductIds([]);
                        }
                      }}
                      className="rounded bg-stone-900 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3">الصنف والمعلومات</th>
                  <th className="py-2 px-3">القسم</th>
                  <th className="py-2 px-3 text-center">سعر الكاش</th>
                  <th className="py-2 px-3 text-center">سعر التقسيط</th>
                  <th className="py-2 px-3 text-center">سعر الجملة</th>
                  <th className="py-2 px-3 text-center">التكلفة</th>
                  <th className="py-2 px-3 text-center">المخزون</th>
                  <th className="py-2 px-3 text-center">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 text-xs text-stone-200">
                {isLoadingDuplicates && filterDuplicatesOnly ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-stone-400 font-bold text-xs space-y-2">
                      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                      <p className="text-sm font-bold text-stone-300">جاري فحص كامل أصناف قاعدة البيانات لتحديد الأكواد المتشابهة...</p>
                    </td>
                  </tr>
                ) : displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-stone-400 font-bold text-xs">
                      {filterDuplicatesOnly
                        ? 'رائع! لا توجد أصناف بأكواد أو باركودات متشابهة في قاعدة البيانات.'
                        : 'لا توجد أصناف تطابق معايير البحث.'}
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((p, idx) => {
                    const isLow = p.stock <= 5;
                    const isSelected = selectedProductIds.includes(p.id);
                    const globalDup = duplicateMap.get(String(p.id));
                    const localDup = !duplicatesLoaded ? duplicateCodesMap.get(p.id) : null;
                    const dupInfo = globalDup || (localDup ? { code: localDup.code, type: localDup.type, conflictingProducts: [localDup.duplicateName], groupIndex: 0 } : null);

                    return (
                      <tr 
                        key={p.id ? `prod_row_${p.id}_${idx}` : `prod_row_${idx}`} 
                        className={`hover:bg-stone-950/50 transition-colors ${
                          dupInfo ? 'bg-rose-950/10 hover:bg-rose-950/20' : ''
                        } ${isSelected ? 'bg-amber-600/5 hover:bg-amber-650/10' : ''}`}
                      >
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds([...selectedProductIds, p.id]);
                              } else {
                                setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                              }
                            }}
                            className="rounded bg-stone-950 border-stone-800 text-amber-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center space-x-2.5 space-x-reverse">
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-8 h-8 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-stone-100">{p.name}</h3>
                              <p className="text-[9px] text-stone-500 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                                {dupInfo && dupInfo.type === 'sku' ? (
                                  <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                                    كود: {p.sku} (مكرر)
                                  </span>
                                ) : (
                                  <span>كود: {p.sku}</span>
                                )}
                                <span className="text-stone-700">|</span>
                                {dupInfo && dupInfo.type === 'barcode' ? (
                                  <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                                    باركود: {p.barcode} (مكرر)
                                  </span>
                                ) : (
                                  <span>باركود: {p.barcode}</span>
                                )}
                                {p.barcodes && p.barcodes.length > 0 && (
                                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] font-sans font-extrabold px-1 rounded-sm" title={p.barcodes.join(' - ')}>
                                    +{p.barcodes.length} أكواد
                                  </span>
                                )}
                              </p>
                              {dupInfo && (
                                <div
                                  className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-sans font-bold px-2 py-0.5 rounded flex flex-wrap items-center gap-1 mt-1"
                                  title={
                                    dupInfo.conflictingProducts && dupInfo.conflictingProducts.length > 0
                                      ? `مشترك في ${dupInfo.type === 'sku' ? 'كود الصنف' : 'الباركود'} (${dupInfo.code}) مع:\n${dupInfo.conflictingProducts.join('\n')}`
                                      : `كود مكرر (${dupInfo.code})`
                                  }
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                                  <span>
                                    {dupInfo.type === 'sku' ? 'كود صنف مشترك' : 'باركود مشترك'}: <strong className="font-mono text-white underline">{dupInfo.code}</strong>
                                  </span>
                                  {dupInfo.conflictingProducts && dupInfo.conflictingProducts.length > 0 && (
                                    <span className="text-rose-300/80 mr-1 truncate max-w-[280px]">
                                      مع: {dupInfo.conflictingProducts.join('، ')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-[9px] bg-stone-950 text-stone-300 border border-stone-800 px-1.5 py-0.2 rounded font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {canViewCash ? `${(p.priceCash || 0).toLocaleString()} ج.م` : '***'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-amber-400 whitespace-nowrap">
                        {canViewInstallment ? `${(p.priceInstallment || 0).toLocaleString()} ج.م` : '***'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-indigo-400 whitespace-nowrap">
                        {canViewWholesale ? `${(p.priceWholesale || 0).toLocaleString()} ج.م` : '***'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-stone-400 whitespace-nowrap">
                        {canViewCost ? `${p.cost || 0} ج.م` : '***'}
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                            isLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                          }`}
                        >
                          {p.stock} قطعة
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => setLabelProduct(p)}
                            className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse"
                            title="طباعة ملصق السعر والباركود"
                          >
                            <Printer className="w-3 h-3" />
                            <span>ملصق السعر</span>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className={`px-2 py-0.5 border rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse ${
                                dupInfo
                                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
                                  : 'bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border-stone-800'
                              }`}
                              title={dupInfo ? 'تعديل وتوليد كود فريد جديد للصنف' : 'تعديل الصنف'}
                            >
                              {dupInfo ? <Sparkles className="w-3 h-3 text-rose-400" /> : <Edit className="w-3 h-3" />}
                              <span>{dupInfo ? 'تعديل الكود' : 'تعديل'}</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse"
                              title="حذف الصنف نهائياً"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Layout Cards */
        isLoadingDuplicates && filterDuplicatesOnly ? (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-stone-300">جاري فحص كامل أصناف قاعدة البيانات لتحديد الأكواد المتشابهة...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl py-12 text-center text-stone-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-stone-600 stroke-1" />
            <p className="text-sm font-bold text-stone-300">
              {filterDuplicatesOnly
                ? 'رائع! لا توجد أصناف بأكواد أو باركودات متشابهة في قاعدة البيانات.'
                : 'لا توجد أصناف معروضة حالياً'}
            </p>
            <p className="text-xs text-stone-500">
              {filterDuplicatesOnly
                ? 'جميع الأكواد والباركودات المعروضة فريدة وغير مكررة عبر كامل الكتالوج.'
                : totalCount === 0 
                  ? 'قاعدة البيانات فارغة من الأصناف. يمكنك إضافة أصناف جديدة بالضغط على "إضافة صنف جديد".'
                  : 'لا توجد نتائج تطابق البحث أو التصنيف المحدد.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {displayedProducts.map((p, idx) => {
              const isLow = p.stock <= 5;
              const isSelected = selectedProductIds.includes(p.id);
              const globalDup = duplicateMap.get(String(p.id));
              const localDup = !duplicatesLoaded ? duplicateCodesMap.get(p.id) : null;
              const dupInfo = globalDup || (localDup ? { code: localDup.code, type: localDup.type, conflictingProducts: [localDup.duplicateName], groupIndex: 0 } : null);

              return (
                <div
                  key={p.id ? `prod_card_${p.id}_${idx}` : `prod_card_${idx}`}
                  className={`bg-stone-900 border rounded-xl p-2.5 shadow-sm flex flex-col justify-between space-y-2 transition-all ${
                    dupInfo
                      ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/60'
                      : 'border-stone-800 hover:border-amber-500/40'
                  } ${
                    isSelected ? 'border-amber-500/85 ring-1 ring-amber-500/30 bg-stone-900/90' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start space-x-2.5 space-x-reverse mb-1.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds([...selectedProductIds, p.id]);
                          } else {
                            setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                          }
                        }}
                        className="mt-1 rounded bg-stone-950 border border-stone-800 text-amber-600 focus:ring-0 cursor-pointer shrink-0"
                      />
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-8.5 h-8.5 rounded-lg object-cover bg-stone-950 border border-stone-800 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] bg-stone-950 text-stone-400 border border-stone-800/80 px-1.5 py-0.2 rounded font-bold uppercase inline-block mb-0.5 truncate max-w-full">
                          {p.category}
                        </span>
                        <h3 className="text-xs font-bold text-stone-100 line-clamp-1">{p.name}</h3>
                        <p className="text-[8px] text-stone-500 font-mono flex flex-wrap items-center gap-1">
                          {dupInfo && dupInfo.type === 'sku' ? (
                            <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1 py-0.2 rounded">
                              كود: {p.sku} (مكرر)
                            </span>
                          ) : (
                            <span>كود: {p.sku}</span>
                          )}
                          <span className="text-stone-700">|</span>
                          {dupInfo && dupInfo.type === 'barcode' ? (
                            <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1 py-0.2 rounded">
                              باركود: {p.barcode} (مكرر)
                            </span>
                          ) : (
                            <span>باركود: {p.barcode}</span>
                          )}
                        </p>
                        {dupInfo && (
                          <div
                            className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[8px] font-sans font-bold px-1.5 py-0.5 rounded flex flex-wrap items-center gap-1 mt-1"
                            title={
                              dupInfo.conflictingProducts && dupInfo.conflictingProducts.length > 0
                                ? `مشترك في ${dupInfo.type === 'sku' ? 'كود الصنف' : 'الباركود'} (${dupInfo.code}) مع:\n${dupInfo.conflictingProducts.join('\n')}`
                                : `كود مكرر (${dupInfo.code})`
                            }
                          >
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                            <span>
                              {dupInfo.type === 'sku' ? 'كود صنف مشترك' : 'باركود مشترك'}: <strong className="font-mono text-white underline">{dupInfo.code}</strong>
                            </span>
                            {dupInfo.conflictingProducts && dupInfo.conflictingProducts.length > 0 && (
                              <span className="text-rose-300/80 truncate max-w-full">
                                مع: {dupInfo.conflictingProducts.join('، ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3 Price Tiers Grid */}
                    <div className="bg-stone-950 border border-stone-800/80 rounded-lg p-1.5 grid grid-cols-3 gap-0.5 text-center text-[9px] mb-1.5">
                      <div>
                        <span className="text-[8px] text-emerald-400 font-bold block">كاش</span>
                        <span className="font-mono font-bold text-stone-100">
                          {canViewCash ? (p.priceCash || 0).toLocaleString() : '***'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[8px] text-amber-400 font-bold block">تقسيط</span>
                        <span className="font-mono font-bold text-stone-100">
                          {canViewInstallment ? (p.priceInstallment || 0).toLocaleString() : '***'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[8px] text-indigo-400 font-bold block">جملة</span>
                        <span className="font-mono font-bold text-stone-100">
                          {canViewWholesale ? (p.priceWholesale || 0).toLocaleString() : '***'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-stone-800 flex items-center justify-between text-xs">
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                        isLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      }`}
                    >
                      {p.stock} قطعة
                    </span>

                    <div className="flex items-center space-x-1 space-x-reverse">
                      <button
                        onClick={() => setLabelProduct(p)}
                        className="p-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] transition-colors"
                        title="طباعة ملصق الباركود"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className={`p-1 border rounded-lg text-[10px] transition-colors ${
                            dupInfo
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
                              : 'bg-stone-950 hover:bg-stone-800 text-stone-300 border-stone-800'
                          }`}
                          title={dupInfo ? 'تعديل وتوليد كود فريد' : 'تعديل الصنف'}
                        >
                          {dupInfo ? <Sparkles className="w-3 h-3 text-rose-400" /> : <Edit className="w-3 h-3" />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] transition-colors"
                          title="حذف الصنف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Server-Side Pagination Bar (BOTTOM) */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-300">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-stone-300">
            {filterDuplicatesOnly ? (
              <span>
                عرض <strong className="text-amber-400 font-mono">{displayedProducts.length}</strong> صنف بأكواد متشابهة (موزعة على <strong className="text-rose-400 font-mono">{duplicateGroups.length}</strong> مجموعة)
              </span>
            ) : (
              <span>
                عرض {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} من إجمالي {totalCount} صنف
              </span>
            )}
          </span>
          {!filterDuplicatesOnly && (
            <div className="flex items-center space-x-1.5 space-x-reverse bg-stone-950 px-2.5 py-1 rounded-xl border border-stone-800">
              <span className="text-[11px] text-stone-400 font-medium">عدد العناصر بالصفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-stone-900 text-amber-400 font-bold text-xs border border-stone-800 rounded px-2 py-0.5 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {!filterDuplicatesOnly && (
          <div className="flex items-center space-x-1 space-x-reverse">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>السابقة</span>
            </button>
            <span className="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg font-extrabold font-mono">
              صفحة {page} من {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
            >
              <span>التالية</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-stone-300 rounded-lg font-bold border border-stone-800 transition-all flex items-center gap-1"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Product Single Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-100 flex items-center space-x-2 space-x-reverse">
                <Package className="w-5 h-5 text-amber-500" />
                <span>{editingProduct ? 'تعديل بيانات المنتج' : 'إضافة صنف جديد كلياً'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Product Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-stone-300 mb-1">اسم الصنف / المنتج *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: طقم حلل استانلس ستيل 10 قطع"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-300">كود المنتج (SKU)</label>
                    <button
                      type="button"
                      onClick={handleGenerateUniqueCodes}
                      disabled={isGeneratingCode}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-stone-900 border border-stone-800 hover:border-amber-500/50 px-2 py-0.5 rounded-lg transition-colors"
                      title="إنشاء كود SKU وباركود جديدين مميزين وغير مكررين"
                    >
                      <Sparkles className={`w-3 h-3 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                      <span>توليد كود تلقائي فريد</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className={`w-full bg-stone-950 border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      skuConflict?.exists
                        ? 'border-rose-500 text-rose-300 bg-rose-500/10 focus:border-rose-500'
                        : 'border-stone-800 text-stone-100 focus:border-amber-500'
                    }`}
                  />
                  {skuConflict?.exists && (
                    <p className="text-[10px] text-rose-400 font-bold mt-1.5 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>⚠️ تنبيه: كود المنتج (SKU) مستخدم بالفعل للمنتج: "{skuConflict.name}"! يرجى توليد أو اختيار كود فريد.</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-300">الباركود الرئيسي</label>
                  </div>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className={`w-full bg-stone-950 border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      barcodeConflict?.exists
                        ? 'border-rose-500 text-rose-300 bg-rose-500/10 focus:border-rose-500'
                        : 'border-stone-800 text-stone-100 focus:border-amber-500'
                    }`}
                  />
                  {barcodeConflict?.exists && (
                    <p className="text-[10px] text-rose-400 font-bold mt-1.5 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>⚠️ تنبيه: هذا الباركود مستخدم بالفعل للمنتج: "{barcodeConflict.name}"!</span>
                    </p>
                  )}
                </div>

                {/* Additional Barcodes Section (Multi-Barcode Support) */}
                <div className="md:col-span-2 bg-stone-950/80 border border-stone-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-400">
                      أكواد وباركودات إضافية (دعم أكثر من كود للمنتج الواحد)
                    </label>
                    <span className="text-[10px] text-stone-400 font-mono font-bold bg-stone-900 border border-stone-800 px-2 py-0.5 rounded-md">
                      الأكواد الإضافية: {formData.barcodes?.length || 0}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="أدخل كود أو باركود إضافي ثم اضغط إضافة (أو مفتاح Enter)..."
                      value={extraBarcodeEntry}
                      onChange={(e) => setExtraBarcodeEntry(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExtraBarcode();
                        }
                      }}
                      className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddExtraBarcode}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all flex items-center space-x-1 space-x-reverse shrink-0 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة كود</span>
                    </button>
                  </div>

                  {formData.barcodes && formData.barcodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {formData.barcodes.map((code, idx) => (
                        <span
                          key={`extra_bc_${code}_${idx}`}
                          className="inline-flex items-center space-x-1.5 space-x-reverse px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-mono font-bold shadow-sm"
                        >
                          <Barcode className="w-3.5 h-3.5 text-amber-400" />
                          <span>{code}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraBarcode(code)}
                            className="text-stone-400 hover:text-rose-400 p-0.5 rounded hover:bg-stone-800 transition-colors mr-1"
                            title="حذف هذا الكود"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Category selector */}
              <div className="relative">
                <label className="block text-xs font-bold text-stone-300 mb-1">القسم / التصنيف</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => handleFormCategoryChange(e.target.value)}
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                    className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-amber-500 font-bold hover:bg-stone-800"
                  >
                    اختر قسم
                  </button>
                </div>

                {isCatDropdownOpen && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-stone-950 border border-stone-800 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                    {categories.filter(c => c !== 'الكل').map((cat, idx) => (
                      <button
                        key={`cat_opt_${cat}_${idx}`}
                        type="button"
                        onClick={() => {
                          handleFormCategoryChange(cat);
                          setIsCatDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 hover:text-amber-400 font-bold transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cost & Prices */}
              <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">التسعير والتكلفة</span>
                  <span className="text-[10px] text-stone-500">
                    هامش الربح التلقائي: كاش (%{getMarginsForCategory(formData.category).cash}) | تقسيط (%{getMarginsForCategory(formData.category).installment}) | جملة (%{getMarginsForCategory(formData.category).wholesale})
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 mb-1">التكلفة الشراء</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.cost}
                      onChange={(e) => handleFormCostChange(Number(e.target.value))}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-400 mb-1">سعر الكاش</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.priceCash}
                      onChange={(e) => setFormData({ ...formData, priceCash: Number(e.target.value) })}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-400 mb-1">سعر التقسيط</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.priceInstallment}
                      onChange={(e) => setFormData({ ...formData, priceInstallment: Number(e.target.value) })}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 mb-1">سعر الجملة</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.priceWholesale}
                      onChange={(e) => setFormData({ ...formData, priceWholesale: Number(e.target.value) })}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-indigo-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">الكمية بالمخزون</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-950 hover:bg-stone-800 text-stone-400 rounded-xl text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 space-x-reverse"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'حفظ التعديلات' : 'إضافة الصنف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Multiple Products Modal */}
      {isBulkAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-100 flex items-center space-x-2 space-x-reverse">
                <FolderPlus className="w-5 h-5 text-amber-500" />
                <span>إضافة أصناف متعددة دفعة واحدة</span>
              </h2>
              <button
                onClick={() => setIsBulkAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                أدخل أسعار وتفاصيل الأصناف مباشرة. سيتم احتساب أسعار البيع تلقائياً بناءً على نسبة هامش الربح المحفوظة بالقسم المختار.
              </div>

              <div className="overflow-x-auto border border-stone-800 rounded-xl">
                <table className="w-full text-right text-xs text-stone-200">
                  <thead className="bg-stone-950 text-[10px] text-stone-400 uppercase font-bold">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2 min-w-[150px]">اسم الصنف *</th>
                      <th className="py-2 px-2 min-w-[120px]">كود الصنف (SKU)</th>
                      <th className="py-2 px-2 min-w-[130px]">الباركود الرئيسي</th>
                      <th className="py-2 px-2 min-w-[110px]">القسم / التصنيف</th>
                      <th className="py-2 px-2 w-20 text-center">التكلفة</th>
                      <th className="py-2 px-2 w-20 text-center text-emerald-400">كاش</th>
                      <th className="py-2 px-2 w-20 text-center text-amber-400">تقسيط</th>
                      <th className="py-2 px-2 w-20 text-center text-indigo-400">جملة</th>
                      <th className="py-2 px-2 w-16 text-center">المخزون</th>
                      <th className="py-2 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800">
                    {bulkAddRows.map((row, index) => {
                      const isSkuDup = row.sku && bulkAddRows.some((r, i) => i !== index && r.sku?.trim() === row.sku?.trim());
                      const isBarcodeDup = row.barcode && bulkAddRows.some((r, i) => i !== index && r.barcode?.trim() === row.barcode?.trim());

                      return (
                        <tr key={index} className="hover:bg-stone-950/40">
                          <td className="py-1.5 px-2 text-center font-mono text-[10px] text-stone-500">
                            {index + 1}
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              placeholder="اسم الصنف..."
                              value={row.name}
                              onChange={(e) => handleBulkAddRowChange(index, 'name', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="كود..."
                                value={row.sku}
                                onChange={(e) => handleBulkAddRowChange(index, 'sku', e.target.value)}
                                className={`w-full bg-stone-950 border ${
                                  isSkuDup
                                    ? 'border-rose-500 text-rose-300 bg-rose-500/10'
                                    : 'border-stone-800 text-stone-100'
                                } rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500`}
                              />
                              <button
                                type="button"
                                onClick={() => regenerateRowCode(index)}
                                title="توليد كود تلقائي جديد فريد"
                                className="p-1 hover:bg-stone-800 text-stone-400 hover:text-amber-400 rounded-md transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {isSkuDup && (
                              <span className="text-[8px] text-rose-400 font-bold block mt-0.5">⚠️ كود مكرر</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="باركود..."
                                value={row.barcode}
                                onChange={(e) => handleBulkAddRowChange(index, 'barcode', e.target.value)}
                                className={`w-full bg-stone-950 border ${
                                  isBarcodeDup
                                    ? 'border-rose-500 text-rose-300 bg-rose-500/10'
                                    : 'border-stone-800 text-stone-100'
                                } rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500`}
                              />
                            </div>
                            {isBarcodeDup && (
                              <span className="text-[8px] text-rose-400 font-bold block mt-0.5">⚠️ باركود مكرر</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <select
                              value={row.category}
                              onChange={(e) => handleBulkAddRowChange(index, 'category', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs text-amber-400 font-bold focus:outline-none"
                            >
                              {categories.filter(c => c !== 'الكل').map((c, idx) => (
                                <option key={`bulk_cat_${c}_${idx}`} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min="0"
                              value={row.cost}
                              onChange={(e) => handleBulkAddRowChange(index, 'cost', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono text-stone-100 text-center focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min="0"
                              value={row.priceCash}
                              onChange={(e) => handleBulkAddRowChange(index, 'priceCash', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min="0"
                              value={row.priceInstallment}
                              onChange={(e) => handleBulkAddRowChange(index, 'priceInstallment', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400 text-center focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min="0"
                              value={row.priceWholesale}
                              onChange={(e) => handleBulkAddRowChange(index, 'priceWholesale', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-indigo-400 text-center focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min="0"
                              value={row.stock}
                              onChange={(e) => handleBulkAddRowChange(index, 'stock', e.target.value)}
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono text-stone-100 text-center focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              onClick={() => removeBulkAddRow(index)}
                              disabled={bulkAddRows.length <= 1}
                              className="p-1 text-stone-500 hover:text-rose-400 disabled:opacity-30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addBulkAddRow}
                className="w-full py-2.5 bg-stone-950 hover:bg-stone-800 border border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center space-x-2 space-x-reverse transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صف جديد للقائمة (توليد كود تلقائي فريد ✨)</span>
              </button>
            </div>

            <div className="p-4 border-t border-stone-800 flex items-center justify-end space-x-2 space-x-reverse">
              <button
                type="button"
                onClick={() => setIsBulkAddModalOpen(false)}
                className="px-4 py-2 bg-stone-950 hover:bg-stone-800 text-stone-400 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveBulkAdd}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 space-x-reverse"
              >
                <Check className="w-4 h-4" />
                <span>حفظ ورفع جميع الأصناف إلى Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h2 className="text-base font-bold text-stone-100">تعديل جماعي لـ ({selectedProductIds.length}) صنف محدد</h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-stone-400 hover:text-stone-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkForm.changeCategory}
                    onChange={(e) => setBulkForm({ ...bulkForm, changeCategory: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600"
                  />
                  <span className="text-xs font-bold text-stone-200">تعديل القسم / التصنيف</span>
                </label>
                {bulkForm.changeCategory && (
                  <select
                    value={bulkForm.category}
                    onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold"
                  >
                    <option value="">اختر القسم الجديد...</option>
                    {categories.filter(c => c !== 'الكل').map((c, idx) => (
                      <option key={`edit_cat_${c}_${idx}`} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkForm.changePrices}
                    onChange={(e) => setBulkForm({ ...bulkForm, changePrices: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600"
                  />
                  <span className="text-xs font-bold text-stone-200">تعديل الأسعار</span>
                </label>
                {bulkForm.changePrices && (
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={bulkForm.priceType}
                      onChange={(e) => setBulkForm({ ...bulkForm, priceType: e.target.value })}
                      className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-stone-200"
                    >
                      <option value="all">جميع الأسعار</option>
                      <option value="cash">سعر الكاش</option>
                      <option value="installment">سعر التقسيط</option>
                      <option value="wholesale">سعر الجملة</option>
                      <option value="cost">التكلفة</option>
                    </select>

                    <select
                      value={bulkForm.priceAction}
                      onChange={(e) => setBulkForm({ ...bulkForm, priceAction: e.target.value })}
                      className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-stone-200 font-bold"
                    >
                      <option value="increase_percent">زيادة بنسبة مئوية (%)</option>
                      <option value="decrease_percent">خصم بنسبة مئوية (%)</option>
                      <option value="increase">زيادة بمبلغ (ج.م)</option>
                      <option value="decrease">خصم بمبلغ (ج.م)</option>
                      <option value="fixed">مبلغ ثابت (ج.م)</option>
                    </select>

                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={bulkForm.priceValue}
                        onChange={(e) => setBulkForm({ ...bulkForm, priceValue: Number(e.target.value) })}
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono text-stone-100 text-center font-bold"
                      />
                      <span className="absolute left-2 text-[10px] font-bold text-amber-400 font-mono">
                        {bulkForm.priceAction.includes('percent') ? '%' : 'ج.م'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkForm.changeStock}
                    onChange={(e) => setBulkForm({ ...bulkForm, changeStock: e.target.checked })}
                    className="rounded bg-stone-900 border-stone-800 text-amber-600"
                  />
                  <span className="text-xs font-bold text-stone-200">تعديل الكميات بالمخزون</span>
                </label>
                {bulkForm.changeStock && (
                  <div className="flex gap-2">
                    <select
                      value={bulkForm.stockAction}
                      onChange={(e) => setBulkForm({ ...bulkForm, stockAction: e.target.value })}
                      className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-stone-200"
                    >
                      <option value="add">إضافة مخزون</option>
                      <option value="fixed">كمية ثابتة</option>
                    </select>
                    <input
                      type="number"
                      value={bulkForm.stockValue}
                      onChange={(e) => setBulkForm({ ...bulkForm, stockValue: Number(e.target.value) })}
                      className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs font-mono text-stone-100 text-center"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleApplyBulkEdit}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                تطبيق التغييرات الجماعية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Label Print Modal */}
      {(labelProduct || labelProducts) && (
        <ProductLabelModal
          isOpen={true}
          product={labelProduct}
          products={labelProducts}
          onClose={() => {
            setLabelProduct(null);
            setLabelProducts(null);
          }}
        />
      )}
    </div>
  );
};
