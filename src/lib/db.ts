import Dexie, { type Table } from 'dexie';
import {
  Product,
  Customer,
  Supplier,
  SupplierTransaction,
  Transaction,
  Associate,
  ClosedShift,
  POSExpense,
  ProductDiscount,
} from '../types';

export interface PendingSyncItem {
  id?: number;
  operation_id: string;
  tableName:
    | 'products'
    | 'customers'
    | 'suppliers'
    | 'supplier_transactions'
    | 'transactions'
    | 'associates'
    | 'closed_shifts'
    | 'expenses'
    | 'discounts';
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'failed' | 'processing';
  lastError?: string;
}

export interface SyncErrorItem {
  id?: number;
  originalPendingId?: number;
  tableName: PendingSyncItem['tableName'];
  operation: PendingSyncItem['operation'];
  payload: any;
  failedAt: string;
  errorReason: string;
  retryCount: number;
}

export interface SyncMeta {
  key: string;
  value: string;
}

export class POSDatabase extends Dexie {
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  supplierTransactions!: Table<SupplierTransaction, string>;
  transactions!: Table<Transaction, string>;
  associates!: Table<Associate, string>;
  closedShifts!: Table<ClosedShift, string>;
  expenses!: Table<POSExpense, string>;
  discounts!: Table<ProductDiscount, string>;
  syncMeta!: Table<SyncMeta, string>;
  pendingSync!: Table<PendingSyncItem, number>;
  syncErrors!: Table<SyncErrorItem, number>;

  constructor() {
    super('AsmaaPOS_LocalDB');
    this.version(1).stores({
      products: 'id, name, sku, barcode, category, priceCash, stock, updated_at',
      customers: 'id, name, phone, email, currentDebt, totalSpent, updated_at',
      suppliers: 'id, name, companyName, phone, updated_at',
      supplierTransactions: 'id, supplierId, type, date, updated_at',
      transactions: 'id, receiptNumber, timestamp, customerId, primaryAssociateId, status, isSynced, updated_at',
      associates: 'id, name, username, pin, role, isClockedIn, updated_at',
      closedShifts: 'id, associateId, startTime, endTime, isSynced, updated_at',
      expenses: 'id, amount, category, timestamp, updated_at',
      discounts: 'productId, isActive, updated_at',
      syncMeta: 'key',
      pendingSync: '++id, operation_id, tableName, record_id, operation, createdAt, status',
      syncErrors: '++id, tableName, failedAt, retryCount',
    });
  }
}

export const db = new POSDatabase();

// --- HELPER FUNCTIONS FOR LOCAL DEXIE DB ---

export async function getLastSyncTimestamp(): Promise<string | null> {
  const meta = await db.syncMeta.get('last_sync_timestamp');
  return meta ? meta.value : null;
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  await db.syncMeta.put({ key: 'last_sync_timestamp', value: timestamp });
}

export async function getLastPushTime(): Promise<string | null> {
  const meta = await db.syncMeta.get('last_push_time');
  return meta ? meta.value : null;
}

export async function setLastPushTime(timestamp: string): Promise<void> {
  await db.syncMeta.put({ key: 'last_push_time', value: timestamp });
}

export async function getLastPullTime(): Promise<string | null> {
  const meta = await db.syncMeta.get('last_pull_time');
  return meta ? meta.value : null;
}

export async function setLastPullTime(timestamp: string): Promise<void> {
  await db.syncMeta.put({ key: 'last_pull_time', value: timestamp });
}

export async function getLastSyncError(): Promise<string | null> {
  const meta = await db.syncMeta.get('last_sync_error');
  return meta ? meta.value : null;
}

export async function setLastSyncError(errorMsg: string | null): Promise<void> {
  if (!errorMsg) {
    await db.syncMeta.delete('last_sync_error');
  } else {
    await db.syncMeta.put({ key: 'last_sync_error', value: errorMsg });
  }
}

export async function addToPendingQueue(
  tableName: PendingSyncItem['tableName'],
  operation: PendingSyncItem['operation'],
  payload: any
): Promise<number> {
  const recId = payload?.id || payload?.productId || payload?.supplierId || payload?.receiptNumber || payload?.record_id || 'N/A';
  const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await db.pendingSync.add({
    operation_id: opId,
    tableName,
    record_id: String(recId),
    operation,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    lastError: '',
  });
}

export async function getPendingSyncCount(): Promise<number> {
  return await db.pendingSync.filter((item) => item.status === 'pending' || !item.status).count();
}

export async function getFailedSyncCount(): Promise<number> {
  return await db.pendingSync.filter((item) => item.status === 'failed').count();
}

export async function getAllPendingSyncItems(): Promise<PendingSyncItem[]> {
  return await db.pendingSync.orderBy('id').toArray();
}

export async function retryPendingItem(id: number): Promise<void> {
  await db.pendingSync.update(id, { status: 'pending', retryCount: 0, lastError: '' });
}

export async function retryAllFailedItems(): Promise<void> {
  const failed = await db.pendingSync.filter((item) => item.status === 'failed').toArray();
  for (const item of failed) {
    if (item.id) {
      await db.pendingSync.update(item.id, { status: 'pending', retryCount: 0, lastError: '' });
    }
  }
}
