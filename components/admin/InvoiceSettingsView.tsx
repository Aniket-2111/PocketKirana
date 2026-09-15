'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  DEFAULT_INVOICE_TEMPLATE,
  InvoiceTemplateSettings,
  generateInvoicePDF,
  InvoiceSnapshot,
} from '@/lib/invoiceEngine';
import { showToast } from '@/components/ui/Toast';
import {
  Sliders,
  ShieldCheck,
  Eye,
  Save,
  RotateCcw,
  Store,
  FileText,
  Building,
  Phone,
  Mail,
  Sparkles,
  Download,
  CheckCircle2,
  Receipt,
  QrCode,
  MapPin,
  Clock,
  Printer
} from 'lucide-react';

export function InvoiceSettingsView() {
  const { invoiceTemplate, updateInvoiceTemplate } = useAppStore();

  const [formData, setFormData] = useState<InvoiceTemplateSettings>(() => {
    return JSON.parse(JSON.stringify(invoiceTemplate || DEFAULT_INVOICE_TEMPLATE));
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'visual' | 'pdf'>('visual');

  const handleChangeSeller = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      seller: {
        ...prev.seller,
        [field]: value,
      },
    }));
  };

  const handleToggleDisplay = (field: keyof InvoiceTemplateSettings) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleResetToDefault = () => {
    setFormData(JSON.parse(JSON.stringify(DEFAULT_INVOICE_TEMPLATE)));
    showToast('Reset invoice template settings to default.', 'info');
  };

  const getSampleInvoiceSnapshot = (): InvoiceSnapshot => {
    return {
      id: 'inv-preview-sample',
      invoiceNumber: `${formData.seller.invoicePrefix || 'PK-INV'}-202609-000123`,
      orderId: 'order-sample',
      orderNumber: 'PK-000123',
      orderDate: new Date().toISOString(),
      invoiceDate: new Date().toISOString(),
      orderStatus: 'DELIVERED',
      paymentStatus: 'PAID',
      paymentMethod: 'UPI / Online Paid',
      seller: { ...formData.seller },
      customer: {
        id: 'cust-1',
        name: 'Rahul Sharma',
        mobile: '+91 98765 43210',
        deliveryAddress: 'Flat 302, Rama Heights, Station Road, Neral, Maharashtra - 410101',
        city: 'Neral',
        state: 'Maharashtra',
        pincode: '410101',
      },
      items: [
        {
          id: 'it-1',
          productId: 'p-1',
          productName: 'Aashirvaad Superior MP Sharbati Atta',
          sku: 'SKU-ATTA-05K',
          quantity: 1,
          unit: '5 kg',
          unitPrice: 245,
          discount: 15,
          taxableValue: 230,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 230,
        },
        {
          id: 'it-2',
          productId: 'p-2',
          productName: 'Amul Taaza Homogenised Toned Milk',
          sku: 'SKU-MILK-1L',
          quantity: 2,
          unit: '1 L',
          unitPrice: 74,
          discount: 0,
          taxableValue: 148,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 148,
        },
        {
          id: 'it-3',
          productId: 'p-3',
          productName: 'Tata Salt Vacuum Evaporated Iodised Salt',
          sku: 'SKU-SALT-1K',
          quantity: 1,
          unit: '1 kg',
          unitPrice: 28,
          discount: 0,
          taxableValue: 28,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 28,
        },
      ],
      totals: {
        subtotal: 421,
        discount: 15,
        deliveryFee: 0,
        taxAmount: 0,
        grandTotal: 406,
      },
      templateVersion: formData.version,
      templateSnapshot: formData,
      status: 'FINALIZED',
      createdAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    };
  };

  const handleDownloadPreviewPDF = () => {
    try {
      const sample = getSampleInvoiceSnapshot();
      generateInvoicePDF(sample, { saveAsFile: true });
      showToast('Downloaded sample invoice preview PDF.', 'success');
    } catch (err: any) {
      showToast('Failed to generate preview PDF.', 'error');
    }
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      const nextVersion = (formData.version || 1) + 1;
      const updated: InvoiceTemplateSettings = {
        ...formData,
        version: nextVersion,
        id: `tmpl-v${nextVersion}`,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
      };

      // Update store
      updateInvoiceTemplate(updated);
      setFormData(updated);

      // Persist to backend API if reachable
      try {
        await fetch('/api/admin/invoices/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (_) {}

      showToast(`Invoice Template saved! Future invoices will use Template v${nextVersion}.`, 'success');
    } catch (err: any) {
      showToast('Failed to save invoice template.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const sample = getSampleInvoiceSnapshot();

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      
      {/* ── TOP HEADER / CONTROLS ── */}
      <div className="bg-white border border-slate-200/90 rounded-[28px] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">Invoice Template &amp; Seller Settings</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customize seller identity, legal registration numbers, layout options, and see the live document preview.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Active: Template v{formData.version || 1}
          </span>
          <button
            type="button"
            onClick={handleDownloadPreviewPDF}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF Preview</span>
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* ── IMMUTABILITY NOTICE ── */}
      <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-black block">Strict Historical Immutability Guarantee</strong>
          <p className="text-emerald-800 mt-0.5 leading-relaxed">
            Modifications made here will apply to all <strong>future orders</strong>. Past finalized invoices remain permanently archived with the exact snapshot captured at checkout/delivery.
          </p>
        </div>
      </div>

      {/* ── 2-COLUMN SPLIT: FORM (LEFT) + LIVE PREVIEW (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN: TEMPLATE CONFIGURATION FORM (7 COLS) ── */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-6">
          
          {/* Seller & Business Profile Card */}
          <div className="bg-white border border-slate-200/90 rounded-[28px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Seller &amp; Store Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Seller Display Name</label>
                <input
                  type="text"
                  value={formData.seller.sellerDisplayName}
                  onChange={(e) => handleChangeSeller('sellerDisplayName', e.target.value)}
                  placeholder="Maule Kirana Store"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Legal Business Entity Name</label>
                <input
                  type="text"
                  value={formData.seller.legalBusinessName}
                  onChange={(e) => handleChangeSeller('legalBusinessName', e.target.value)}
                  placeholder="Maule Kirana"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Full Business / Dark Store Address</label>
                <textarea
                  rows={2}
                  value={formData.seller.address}
                  onChange={(e) => handleChangeSeller('address', e.target.value)}
                  placeholder="Shop No. 4, Main Market Road, Near Station, Neral, Karjat, Maharashtra - 410101"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">FSSAI Licence / Registration No.</label>
                <input
                  type="text"
                  value={formData.seller.fssaiNumber}
                  onChange={(e) => handleChangeSeller('fssaiNumber', e.target.value)}
                  placeholder="21524068001234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={formData.seller.invoicePrefix}
                  onChange={(e) => handleChangeSeller('invoicePrefix', e.target.value)}
                  placeholder="PK-INV"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Registered?</label>
                <select
                  value={formData.seller.isGstRegistered ? 'yes' : 'no'}
                  onChange={(e) => handleChangeSeller('isGstRegistered', e.target.value === 'yes')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="no">NO (Unregistered / Composition)</option>
                  <option value="yes">YES (Regular GST Registered)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  GSTIN {formData.seller.isGstRegistered ? '(Mandatory)' : '(Optional)'}
                </label>
                <input
                  type="text"
                  disabled={!formData.seller.isGstRegistered}
                  value={formData.seller.gstin || ''}
                  onChange={(e) => handleChangeSeller('gstin', e.target.value)}
                  placeholder="27AAAAA0000A1Z5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Support Phone</label>
                <input
                  type="text"
                  value={formData.seller.phone}
                  onChange={(e) => handleChangeSeller('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Support Email</label>
                <input
                  type="email"
                  value={formData.seller.email}
                  onChange={(e) => handleChangeSeller('email', e.target.value)}
                  placeholder="support@pocketkirana.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Branding & Subtext Card */}
          <div className="bg-white border border-slate-200/90 rounded-[28px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Branding &amp; Footer Declarations</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Header Sub-Text (Operator Attribution)</label>
                <input
                  type="text"
                  value={formData.operatedByText}
                  onChange={(e) => setFormData({ ...formData, operatedByText: e.target.value })}
                  placeholder="Powered/Operated by Maule Kirana"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Footer Thank-You Message</label>
                <input
                  type="text"
                  value={formData.footerMessage}
                  onChange={(e) => setFormData({ ...formData, footerMessage: e.target.value })}
                  placeholder="Thank you for shopping with Pocket Kirana."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Display Toggles */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.showFSSAI}
                  onChange={() => handleToggleDisplay('showFSSAI')}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Show FSSAI Registration</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.showGSTIN}
                  onChange={() => handleToggleDisplay('showGSTIN')}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Show GSTIN in Header</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.showTaxBreakdown}
                  onChange={() => handleToggleDisplay('showTaxBreakdown')}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Show Tax Breakdown</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.showPaymentInfo}
                  onChange={() => handleToggleDisplay('showPaymentInfo')}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Show Payment Status</span>
              </label>
            </div>
          </div>

          {/* Reset & Save Bar */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Template Changes'}</span>
            </button>
          </div>

        </div>

        {/* ── RIGHT COLUMN: LIVE REALISTIC INVOICE DOCUMENT PREVIEW (6 COLS) ── */}
        <div className="lg:col-span-6 xl:col-span-6 sticky top-6 space-y-3">
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Live Template Preview
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Interactive Mockup
            </span>
          </div>

          {/* Paper Sheet Preview Container */}
          <div className="bg-white border-2 border-slate-200/90 rounded-[24px] p-6 shadow-md text-slate-900 space-y-5 font-sans relative overflow-hidden select-none">
            
            {/* Top Brand Bar */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-emerald-600 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg tracking-tight text-slate-900">
                    POCKET<span className="text-emerald-700">KIRANA</span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    Tax Invoice
                  </span>
                </div>
                <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                  {formData.operatedByText || 'Powered/Operated by Maule Kirana'}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono font-bold text-slate-500 block">
                  Invoice #: <strong className="text-slate-900">{sample.invoiceNumber}</strong>
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Seller & Buyer Grid */}
            <div className="grid grid-cols-2 gap-4 text-[11px] bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              {/* Seller Details */}
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Seller (Dark Store)</span>
                <strong className="text-xs font-black text-slate-900 block">
                  {formData.seller.sellerDisplayName || 'Maule Kirana Store'}
                </strong>
                {formData.seller.legalBusinessName && (
                  <span className="text-slate-600 font-medium block">
                    {formData.seller.legalBusinessName}
                  </span>
                )}
                <span className="text-slate-500 block leading-tight text-[10px]">
                  {formData.seller.address || 'Neral, Maharashtra'}
                </span>
                {formData.showFSSAI && formData.seller.fssaiNumber && (
                  <span className="text-emerald-900 font-bold block text-[10px] pt-0.5">
                    FSSAI: {formData.seller.fssaiNumber}
                  </span>
                )}
                {formData.showGSTIN && formData.seller.isGstRegistered && formData.seller.gstin && (
                  <span className="text-slate-700 font-mono font-bold block text-[10px]">
                    GSTIN: {formData.seller.gstin}
                  </span>
                )}
              </div>

              {/* Customer Details */}
              <div className="space-y-1 border-l border-slate-200/80 pl-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Delivery To (Customer)</span>
                <strong className="text-xs font-black text-slate-900 block">
                  {sample.customer.name}
                </strong>
                <span className="text-slate-500 font-mono text-[10px] block">
                  {sample.customer.mobile}
                </span>
                <span className="text-slate-500 block leading-tight text-[10px]">
                  {sample.customer.deliveryAddress}
                </span>
                <span className="text-slate-600 font-bold block text-[10px] pt-0.5">
                  Order #: {sample.orderNumber}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#0F532B] text-white font-black text-[10px] uppercase">
                  <tr>
                    <th className="p-2 pl-3">#</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {sample.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2 pl-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <strong className="text-slate-900 block font-bold">{item.productName}</strong>
                        <span className="text-slate-400 text-[10px] font-mono">{item.unit}</span>
                      </td>
                      <td className="p-2 text-center font-bold text-slate-700">{item.quantity}</td>
                      <td className="p-2 text-right font-mono text-slate-700">₹{item.unitPrice}</td>
                      <td className="p-2 pr-3 text-right font-mono font-bold text-slate-900">₹{item.itemTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Totals */}
            <div className="flex justify-end pt-1">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-slate-900">₹{sample.totals.subtotal}</span>
                </div>
                {sample.totals.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Discount</span>
                    <span className="font-mono">-₹{sample.totals.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charge</span>
                  <span className="font-mono font-bold text-emerald-700">FREE</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t-2 border-slate-200">
                  <span>Grand Total</span>
                  <span className="font-mono text-base text-[#0F532B]">₹{sample.totals.grandTotal}</span>
                </div>
                {formData.showPaymentInfo && (
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                    <span>Payment:</span>
                    <span className="uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {sample.paymentMethod}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notice */}
            <div className="pt-3 border-t border-slate-100 text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-700">
                {formData.footerMessage || 'Thank you for shopping with Pocket Kirana.'}
              </p>
              <p className="text-[9px] text-slate-400">
                Customer Support: {formData.seller.phone} • {formData.seller.email}
              </p>
              <p className="text-[8px] text-slate-400 italic">
                This is a computer-generated invoice and requires no physical signature.
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
