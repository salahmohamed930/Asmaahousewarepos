import { supabase } from './supabase';
import { Product, Customer, Transaction, Associate, ClosedShift, Supplier, SupplierTransaction, POSExpense } from '../types';

/**
 * Sync POS Data with Supabase Database
 * Project URL: https://ilyxhubihdqjbvkkpalx.supabase.co
 */

export async function checkSupabaseConnection(): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    const { error } = await supabase.from('products').select('*', { count: 'exact', head: true }).limit(1);
    if (error) {
      return { success: false, errorMessage: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase ping error:', err);
    return { success: false, errorMessage: err?.message || String(err) };
  }
}

export async function syncClosedShiftToSupabase(shift: ClosedShift): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase.from('closed_shifts').upsert({
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
    });

    if (error) {
      // Fallback with minimal columns if the database has a basic schema
      const { error: fallbackError } = await supabase.from('closed_shifts').upsert({
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
      });
      if (fallbackError) {
        console.warn('Supabase closed shift fallback sync failed:', fallbackError);
        return { success: false, error: fallbackError };
      }
    }
    return { success: true };
  } catch (err) {
    console.warn('Supabase closed shift sync error:', err);
    return { success: false, error: err };
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

export async function syncTransactionToSupabase(transaction: Transaction): Promise<{ success: boolean; error?: any }> {
  try {
    const payload: any = {
      id: transaction.id,
      receipt_number: transaction.receiptNumber,
      timestamp: new Date(transaction.timestamp).toISOString(),
      subtotal: transaction.subtotal,
      discount_total: transaction.discountTotal,
      tax_total: transaction.taxTotal,
      grand_total: transaction.grandTotal,
      payment_method: transaction.paymentMethod,
      payment_details: transaction.paymentDetails || null,
      customer_id: transaction.customerId || null,
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

    const { error } = await supabase.from('transactions').upsert(payload);
    if (error) {
      console.warn('Supabase transactions upsert failed:', error);
      return { success: false, error };
    }

    // Synchronize individual transaction items to transaction_items table
    if (transaction.items && transaction.items.length > 0) {
      try {
        // Delete existing items for this transaction to avoid duplicates
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
          console.warn('Supabase transaction_items insert failed:', itemsError);
          // Return false so we can re-sync later
          return { success: false, error: itemsError };
        }
      } catch (itemErr) {
        console.warn('Error during transaction_items sync:', itemErr);
        return { success: false, error: itemErr };
      }
    }

    return { success: true };
  } catch (err) {
    console.warn('Supabase transaction sync error:', err);
    return { success: false, error: err };
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
      advances_balance: associate.advancesBalance || 0,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase associate sync error:', err);
  }
}

export async function syncSupplierToSupabase(supplier: Supplier) {
  try {
    await supabase.from('suppliers').upsert({
      id: supplier.id,
      name: supplier.name,
      company_name: supplier.companyName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category || '',
      current_balance: supplier.currentBalance,
      notes: supplier.notes || '',
      tax_number: supplier.taxNumber || '',
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase supplier sync:', err);
  }
}

export async function syncSupplierTransactionToSupabase(tx: SupplierTransaction) {
  try {
    await supabase.from('supplier_transactions').upsert({
      id: tx.id,
      supplier_id: tx.supplierId,
      supplier_name: tx.supplierName,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      reference_number: tx.referenceNumber || '',
      payment_method: tx.paymentMethod || '',
      notes: tx.notes || '',
      associate_name: tx.associateName || '',
    });
  } catch (err) {
    console.warn('Supabase supplier transaction sync:', err);
  }
}

export async function syncExpenseToSupabase(expense: POSExpense) {
  try {
    await supabase.from('expenses').upsert({
      id: expense.id,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      timestamp: expense.timestamp,
      associate_id: expense.associateId,
      associate_name: expense.associateName,
      linked_supplier_id: expense.linkedSupplierId,
      linked_supplier_name: expense.linkedSupplierName,
      linked_associate_id: expense.linkedAssociateId,
      linked_associate_name: expense.linkedAssociateName,
    });
  } catch (err) {
    console.warn('Supabase expense sync:', err);
  }
}


