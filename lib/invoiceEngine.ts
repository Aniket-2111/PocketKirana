import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '@/types';

export interface SellerProfile {
  sellerDisplayName: string;
  legalBusinessName: string;
  address: string;
  fssaiNumber: string;
  isGstRegistered: boolean;
  gstin?: string;
  phone: string;
  email: string;
  state: string;
  invoicePrefix: string;
  invoiceNumberFormat: string;
}

export interface InvoiceTemplateSettings {
  id: string;
  version: number;
  title: string;
  logoUrl?: string;
  seller: SellerProfile;
  footerMessage: string;
  operatedByText: string;
  showTaxBreakdown: boolean;
  showDiscountBreakdown: boolean;
  showDeliveryBreakdown: boolean;
  showPaymentInfo: boolean;
  showFSSAI: boolean;
  showGSTIN: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface InvoiceItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  taxRate: number;
  taxAmount: number;
  itemTotal: number;
}

export interface InvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  invoiceDate: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  seller: SellerProfile;
  customer: {
    id: string;
    name: string;
    mobile: string;
    deliveryAddress: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: InvoiceItemSnapshot[];
  totals: {
    subtotal: number;
    discount: number;
    deliveryFee: number;
    taxAmount: number;
    taxRate?: number;
    grandTotal: number;
  };
  templateVersion: number;
  templateSnapshot: InvoiceTemplateSettings;
  status: 'GENERATED' | 'FINALIZED' | 'CANCELLED' | 'REFUNDED';
  refunds?: Array<{
    id: string;
    refundAmount: number;
    refundDate: string;
    reason: string;
    status: string;
  }>;
  createdAt: string;
  finalizedAt: string;
}

export const DEFAULT_SELLER_PROFILE: SellerProfile = {
  sellerDisplayName: 'Maule Kirana Store',
  legalBusinessName: 'Maule Kirana',
  address: 'Shop No. 4, Main Market, Neral, Karjat, Raigad, Maharashtra - 410101',
  fssaiNumber: '21524068001234',
  isGstRegistered: false,
  gstin: '',
  phone: '+91 98765 43210',
  email: 'support@pocketkirana.com',
  state: 'Maharashtra',
  invoicePrefix: 'PK-INV',
  invoiceNumberFormat: 'PK-INV-{YEAR}-{SEQ}',
};

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateSettings = {
  id: 'tmpl-v1',
  version: 1,
  title: 'RETAIL INVOICE / CASH MEMO',
  seller: DEFAULT_SELLER_PROFILE,
  footerMessage: 'Thank you for shopping with Pocket Kirana.',
  operatedByText: 'Powered/Operated by Maule Kirana',
  showTaxBreakdown: true,
  showDiscountBreakdown: true,
  showDeliveryBreakdown: true,
  showPaymentInfo: true,
  showFSSAI: true,
  showGSTIN: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

// Collision-safe sequential invoice number generator
let invoiceSequenceCounter = 1;

export function generateSequentialInvoiceNumber(
  prefix = 'PK-INV',
  existingInvoices: InvoiceSnapshot[] = []
): string {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `${prefix}-${currentYear}-`;
  
  // Find highest existing sequence for current year
  let maxSeq = 0;
  if (Array.isArray(existingInvoices)) {
    for (const inv of existingInvoices) {
      if (inv.invoiceNumber && inv.invoiceNumber.startsWith(yearPrefix)) {
        const parts = inv.invoiceNumber.split('-');
        const seqStr = parts[parts.length - 1];
        const num = parseInt(seqStr, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = Math.max(maxSeq + 1, invoiceSequenceCounter++);
  return `${yearPrefix}${String(nextSeq).padStart(6, '0')}`;
}

/**
 * Creates or retrieves a finalized invoice snapshot for an order.
 * Ensures immutability: if an invoice already exists, returns the existing record.
 */
export function createOrGetInvoiceSnapshot(
  order: Order,
  template: InvoiceTemplateSettings = DEFAULT_INVOICE_TEMPLATE,
  existingInvoices: InvoiceSnapshot[] = []
): InvoiceSnapshot {
  // 1. Check if invoice already exists
  const existing = existingInvoices.find(
    (inv) => inv.orderId === order.id || inv.orderNumber === order.orderNumber
  );
  if (existing) {
    return existing;
  }

  // 2. Build items snapshot
  const rawItems = order.items || [];
  const itemsSnapshot: InvoiceItemSnapshot[] = rawItems.map((it: any, idx: number) => {
    const unitPrice = Number(it.price ?? it.product?.sellingPrice ?? it.unitPrice ?? 0);
    const qty = Number(it.quantity ?? 1);
    const itemSubtotal = unitPrice * qty;
    const itemDiscount = Number(it.discount ?? 0);
    const taxableValue = Math.max(0, itemSubtotal - itemDiscount);
    const taxRate = Number(it.product?.taxPercentage ?? it.taxPercentage ?? 0);
    const taxAmount = taxRate > 0 ? (taxableValue * taxRate) / 100 : 0;
    const itemTotal = taxableValue + taxAmount;

    return {
      id: it.id || `item-${idx + 1}`,
      productId: it.productId || it.product?.id || `prod-${idx + 1}`,
      productName: it.product?.name || it.productName || 'Grocery Item',
      sku: it.sku || it.product?.sku || `SKU-${idx + 1}`,
      hsnCode: it.hsnCode || it.product?.hsnCode || '',
      quantity: qty,
      unit: it.product?.unit || it.unit || '1 unit',
      unitPrice,
      discount: itemDiscount,
      taxableValue,
      taxRate,
      taxAmount,
      itemTotal,
    };
  });

  // 3. Decimal-safe financial totals
  const subtotal = itemsSnapshot.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
  const totalItemDiscounts = itemsSnapshot.reduce((sum, it) => sum + it.discount, 0);
  const orderDiscount = Number(order.discount ?? 0);
  const finalDiscount = Math.max(totalItemDiscounts, orderDiscount);
  const deliveryFee = Number(order.deliveryFee ?? order.deliveryCharge ?? 0);
  const totalTax = itemsSnapshot.reduce((sum, it) => sum + it.taxAmount, 0) || Number(order.tax ?? 0);
  const grandTotal = Number(order.total ?? (subtotal - finalDiscount + deliveryFee + totalTax));

  const invoiceNumber = generateSequentialInvoiceNumber(
    template.seller.invoicePrefix || 'PK-INV',
    existingInvoices
  );

  const fullAddress = [
    order.address?.fullName || order.customerName,
    order.address?.addressLine1,
    order.address?.addressLine2,
    order.address?.city,
    order.address?.state,
    order.address?.postalCode || (order.address as any)?.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const nowIso = new Date().toISOString();

  const snapshot: InvoiceSnapshot = {
    id: `inv-${order.id}-${Date.now()}`,
    invoiceNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderDate: order.placedAt || nowIso,
    invoiceDate: nowIso,
    orderStatus: order.orderStatus || 'DELIVERED',
    paymentStatus: order.paymentStatus || 'paid',
    paymentMethod: order.paymentMethod || 'Online Paid',
    seller: { ...template.seller },
    customer: {
      id: order.customerId || 'cust-1',
      name: order.customerName || (order.address as any)?.name || 'Valued Customer',
      mobile: order.customerPhone || order.address?.phone || '',
      deliveryAddress: fullAddress || 'Neral, Maharashtra - 410101',
      city: order.address?.city || 'Neral',
      state: order.address?.state || 'Maharashtra',
      pincode: order.address?.postalCode || (order.address as any)?.pincode || '410101',
    },
    items: itemsSnapshot,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(finalDiscount * 100) / 100,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      taxAmount: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    },
    templateVersion: template.version,
    templateSnapshot: JSON.parse(JSON.stringify(template)),
    status: 'FINALIZED',
    createdAt: nowIso,
    finalizedAt: nowIso,
  };

  return snapshot;
}

/**
 * Generates an A4 PDF document for an InvoiceSnapshot matching the strict specification.
 */
export function generateInvoicePDF(
  invoice: InvoiceSnapshot,
  options: { saveAsFile?: boolean; returnBlob?: boolean } = { saveAsFile: true }
): { doc: jsPDF; filename: string; blob?: Blob } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180 mm

  let y = margin;

  // ── HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 83, 43); // Emerald brand color (#0F532B)
  doc.text('POCKET KIRANA', pageWidth / 2, y + 4, { align: 'center' });

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(invoice.templateSnapshot?.operatedByText || 'Powered/Operated by Maule Kirana', pageWidth / 2, y, {
    align: 'center',
  });

  y += 4;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;

  // ── TWO-COLUMN TOP SECTION: SELLER & ORDER INFO ──
  const colWidth = contentWidth / 2 - 3;
  const col2X = margin + colWidth + 6;

  // LEFT COLUMN: SELLER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SELLER', margin, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(invoice.seller.sellerDisplayName || 'Maule Kirana Store', margin, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85); // Slate-700
  const sellerAddrLines = doc.splitTextToSize(invoice.seller.address || '', colWidth);
  doc.text(sellerAddrLines, margin, y);
  y += sellerAddrLines.length * 3.5;

  if (invoice.seller.fssaiNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`FSSAI Registration/Licence No:`, margin, y);
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.seller.fssaiNumber, margin, y);
    y += 3.5;
  }

  if (invoice.seller.isGstRegistered && invoice.seller.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${invoice.seller.gstin}`, margin, y);
    y += 3.5;
  }

  const sellerBottomY = y;

  // RIGHT COLUMN: ORDER INFORMATION
  let rightY = margin + 19;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ORDER INFORMATION', col2X, rightY);

  rightY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const orderDateStr = new Date(invoice.orderDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const metaItems = [
    { label: 'Order:', value: invoice.orderNumber },
    { label: 'Invoice:', value: invoice.invoiceNumber },
    { label: 'Order Date:', value: orderDateStr },
    { label: 'Invoice Date:', value: invoiceDateStr },
    { label: 'Order Status:', value: invoice.orderStatus.toUpperCase() },
    { label: 'Payment Status:', value: invoice.paymentStatus.toUpperCase() },
  ];

  for (const m of metaItems) {
    doc.setFont('helvetica', 'bold');
    doc.text(m.label, col2X, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(m.value, col2X + 28, rightY);
    rightY += 4;
  }

  y = Math.max(sellerBottomY, rightY) + 3;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── CUSTOMER SECTION ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CUSTOMER', margin, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customer.name || 'Valued Customer', margin, y);

  if (invoice.customer.mobile) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Mobile: ${invoice.customer.mobile}`, margin + 60, y);
  }

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const custAddrLines = doc.splitTextToSize(`Delivery Address: ${invoice.customer.deliveryAddress}`, contentWidth);
  doc.text(custAddrLines, margin, y);
  y += custAddrLines.length * 3.5 + 3;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ── PRODUCTS TABLE (autoTable) ──
  const tableData = invoice.items.map((item, index) => [
    String(index + 1),
    `${item.productName}${item.unit ? ` (${item.unit})` : ''}`,
    String(item.quantity),
    `Rs. ${item.unitPrice.toFixed(2)}`,
    `Rs. ${item.itemTotal.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [226, 232, 240],
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Keep headers repeating nicely
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  y = finalY + 5;

  // Check if summary fits on this page, otherwise add a new page
  if (y + 55 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  // ── BILL SUMMARY BOX ──
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  const summaryRows = [
    { label: 'Subtotal:', value: `Rs. ${invoice.totals.subtotal.toFixed(2)}` },
    ...(invoice.totals.discount > 0
      ? [{ label: 'Discount:', value: `-Rs. ${invoice.totals.discount.toFixed(2)}` }]
      : []),
    {
      label: 'Delivery:',
      value: invoice.totals.deliveryFee === 0 ? 'FREE' : `Rs. ${invoice.totals.deliveryFee.toFixed(2)}`,
    },
    ...(invoice.totals.taxAmount > 0
      ? [{ label: 'Tax, if applicable:', value: `Rs. ${invoice.totals.taxAmount.toFixed(2)}` }]
      : []),
  ];

  doc.setFontSize(8.5);
  for (const row of summaryRows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(row.label, summaryX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(row.value, pageWidth - margin, y, { align: 'right' });
    y += 4.5;
  }

  // Total Line
  doc.setDrawColor(226, 232, 240);
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 83, 43); // Brand Green
  doc.text('TOTAL:', summaryX, y);
  doc.text(`Rs. ${invoice.totals.grandTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });

  y += 7;

  // ── PAYMENT INFO ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT', margin, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Payment Method: ${invoice.paymentMethod || 'Online Paid'}`, margin, y);
  y += 3.5;
  doc.text(`Payment Status: ${invoice.paymentStatus.toUpperCase()}`, margin, y);

  // ── FOOTER ON ALL PAGES ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footY = pageHeight - margin + 2;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footY - 5, pageWidth - margin, footY - 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Thank you for shopping with Pocket Kirana.', pageWidth / 2, footY - 1, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      invoice.templateSnapshot?.operatedByText || 'Powered/Operated by Maule Kirana',
      pageWidth / 2,
      footY + 2.5,
      { align: 'center' }
    );

    // Page number
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footY + 2.5, { align: 'right' });
  }

  const filename = `Pocket-Kirana-Invoice-${invoice.orderNumber}.pdf`;

  if (options.saveAsFile && typeof window !== 'undefined') {
    doc.save(filename);
  }

  let blob: Blob | undefined;
  if (options.returnBlob) {
    blob = doc.output('blob');
  }

  return { doc, filename, blob };
}
