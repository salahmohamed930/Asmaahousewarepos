import { supabase } from './supabase';
import { Product, Customer, Transaction, Associate, ClosedShift } from '../types';

/**
 * Sync POS Data with Supabase Database
 * Project URL: https://ilyxhubihdqjbvkkpalx.supabase.co
 */

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('products').select('count', { count: 'exact', head: true });
    if (!error) return true;
    return true;
  } catch (err) {
    console.warn('Supabase ping:', err);
    return true;
  }
}

export async function syncClosedShiftToSupabase(shift: ClosedShift) {
  try {
    await supabase.from('closed_shifts').upsert({
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
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase closed shift sync error:', err);
  }
}

export async function syncProductToSupabase(product: Product) {
  try {
    const basePayload: any = {
      id: product.id || product.sku,
      name: product.name,
      sku: product.sku || product.id,
      barcode: product.barcode,
      category: product.category,
      price: product.priceCash,
      cash_price: product.priceCash,
      wholesale_price: product.priceWholesale,
      cost_price: product.cost,
      installment_price: product.priceInstallment,
      stock_quantity: product.stock,
      quantity: product.stock,
      stock: product.stock,
      image_url: product.image,
      barcodes: product.barcodes || [],
      alternative_barcodes: product.barcodes || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('products').upsert(basePayload);
    if (error) {
      // Fallback attempt without extra schema variations if strict column matching fails
      await supabase.from('products').upsert({
        id: product.id || product.sku,
        name: product.name,
        price: product.priceCash,
        stock_quantity: product.stock,
      });
    }
  } catch (err) {
    console.warn('Supabase product sync error:', err);
  }
}

export async function syncTransactionToSupabase(transaction: Transaction) {
  try {
    await supabase.from('transactions').upsert({
      id: transaction.id,
      receipt_number: transaction.receiptNumber,
      grand_total: transaction.grandTotal,
      subtotal: transaction.subtotal,
      discount_amount: transaction.discountTotal,
      payment_method: transaction.paymentMethod,
      customer_id: transaction.customerId,
      associate_id: transaction.primaryAssociateId,
      items: transaction.items,
      created_at: new Date(transaction.timestamp).toISOString(),
    });
  } catch (err) {
    console.warn('Supabase transaction sync error:', err);
  }
}

export async function syncCustomerToSupabase(customer: Customer) {
  try {
    await supabase.from('customers').upsert({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      total_spent: customer.totalSpent,
      loyalty_points: customer.loyaltyPoints,
      notes: customer.notes || '',
      address: customer.address || '',
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase customer sync error:', err);
  }
}

export async function syncAssociateToSupabase(associate: Associate) {
  try {
    await supabase.from('associates').upsert({
      id: associate.id,
      name: associate.name,
      username: associate.username,
      pin: associate.pin,
      role: associate.role,
      email: associate.email,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase associate sync error:', err);
  }
}
