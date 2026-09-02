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
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  retryCount: number;
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
      pendingSync: '++id, tableName, operation, createdAt',
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

export async function addToPendingQueue(
  tableName: PendingSyncItem['tableName'],
  operation: PendingSyncItem['operation'],
  payload: any
): Promise<number> {
  return await db.pendingSync.add({
    tableName,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function getPendingSyncCount(): Promise<number> {
  return await db.pendingSync.count();
}
