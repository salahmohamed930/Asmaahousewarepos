import React from 'react';
import { renderToString } from 'react-dom/server';
import { Transaction, Associate, AppSettings, Customer } from '../types';
import { smartPrintHtml, PrintOptions } from './printHelper';
import { ReceiptContent } from '../components/Register/ReceiptContent';

export interface PrintInvoiceOptions {
  settings?: AppSettings;
  associates?: Associate[];
  customers?: Customer[];
  receiptType?: 'thermal' | 'a4';
  onFallbackUsed?: (reason: string) => void;
}

/**
 * Builds a standalone, clean HTML representation of the invoice receipt.
 */
export function buildReceiptHtml(
  transaction: Transaction,
  options?: PrintInvoiceOptions
): string {
  const receiptType = options?.receiptType || options?.settings?.printSettings?.receiptType || 'thermal';

  const receiptComponent = React.createElement(ReceiptContent, {
    transaction,
    receiptType,
    elementId: 'printable-receipt',
    settings: options?.settings,
    associates: options?.associates || [],
    customers: options?.customers || [],
  });

  return renderToString(receiptComponent);
}

/**
 * Sends the invoice receipt directly for silent printing:
 * - Uses direct silent printing via isolated frame and kiosk mode.
 * - Prints without disturbing user workflow or opening secondary preview screens.
 */
export async function printInvoiceReceipt(
  transaction: Transaction,
  options?: PrintInvoiceOptions
): Promise<{ usedDirect: boolean; success: boolean; message?: string }> {
  const receiptType = options?.receiptType || options?.settings?.printSettings?.receiptType || 'thermal';
  const isThermal = receiptType !== 'a4';
  const pageCssSize = isThermal ? '80mm auto' : 'A4 portrait';

  const receiptHtml = buildReceiptHtml(transaction, options);

  const customStyles = `
    @page {
      size: ${isThermal ? '80mm auto' : 'A4 portrait'} !important;
      margin: ${isThermal ? '0 !important' : '4mm 6mm !important'};
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: ${isThermal ? '10px' : '11px'} !important;
      font-weight: 800 !important;
      direction: rtl !important;
      ${!isThermal ? 'height: 100% !important; max-height: 297mm !important; overflow: hidden !important;' : ''}
    }
    #printable-receipt {
      padding: ${isThermal ? '2mm 3mm' : '6mm 8mm'} !important;
      margin: 0 auto !important;
      max-width: ${isThermal ? '80mm' : '100%'} !important;
      width: 100% !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: ${isThermal ? '10px' : '11px'} !important;
      font-weight: 800 !important;
      line-height: 1.3 !important;
      border: none !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: avoid !important;
      page-break-after: avoid !important;
      ${!isThermal ? 'max-height: 100% !important;' : ''}
    }
    table.receipt-items-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 4px 0 !important;
      font-weight: 800 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.receipt-items-table thead tr {
      background-color: #d1d5db !important;
      border-top: 1.5px solid #000000 !important;
      border-bottom: 1.5px solid #000000 !important;
      font-weight: 900 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.receipt-items-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.receipt-items-table th, table.receipt-items-table td {
      padding: 2.5px 2px !important;
      color: #000000 !important;
      font-size: ${isThermal ? '9.5px' : '10.5px'} !important;
      font-weight: 800 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .no-print {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  const printOpts: PrintOptions = {
    docType: 'invoice',
    printSettings: options?.settings?.printSettings,
    pageTitle: `فاتورة-${transaction.receiptNumber}`,
    isThermalReceipt: isThermal,
    pageCssSize,
    customStyles,
    onFallbackUsed: options?.onFallbackUsed,
  };

  return smartPrintHtml(receiptHtml, printOpts);
}
