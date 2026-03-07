import React, { forwardRef } from "react";
import { InvoiceFormData } from "@/hooks/useInvoices";

interface Props {
  formData: InvoiceFormData;
}

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ` ${currency}`;

const fmtDate = (d: string) => {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const InvoicePreview = forwardRef<HTMLDivElement, Props>(({ formData }, ref) => {
  const hasPayment = !!(formData.payment_account_name || formData.payment_bank_name || formData.payment_account_number || formData.payment_swift_code);

  return (
    <div ref={ref} id="invoice-preview" className="bg-white text-gray-900 rounded-lg shadow-sm border border-border p-8 min-h-[700px]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
          <p className="text-sm text-gray-500 mt-1">{formData.invoice_number || "INV-XXX"}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Date: {fmtDate(formData.invoice_date) || "—"}</p>
          {formData.due_date && <p>Due: {fmtDate(formData.due_date)}</p>}
        </div>
      </div>

      {/* From / Bill To */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">FROM</p>
          <p className="font-semibold text-sm">{formData.sender_name || "Your Name"}</p>
          {formData.sender_address && <p className="text-sm text-gray-500 whitespace-pre-line">{formData.sender_address}</p>}
          {formData.sender_email && <p className="text-sm text-gray-500">{formData.sender_email}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">BILL TO</p>
          <p className="font-semibold text-sm">{formData.bill_to_name || "Client Name"}</p>
          {formData.bill_to_address && <p className="text-sm text-gray-500 whitespace-pre-line">{formData.bill_to_address}</p>}
        </div>
      </div>

      {/* Service Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 pb-2">Description</th>
            <th className="text-center text-[10px] uppercase tracking-wider text-gray-500 pb-2">Period</th>
            <th className="text-right text-[10px] uppercase tracking-wider text-gray-500 pb-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-3 text-sm">{formData.service_description || "Service description"}</td>
            <td className="py-3 text-sm text-center">{formData.month_of_service || "—"}</td>
            <td className="py-3 text-sm text-right">{fmt(formData.amount || 0, formData.currency)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-[250px]">
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-500">Subtotal</span>
            <span>{fmt(formData.amount || 0, formData.currency)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t-2 border-gray-800 pt-2 mt-1">
            <span>Total Due</span>
            <span>{fmt(formData.amount || 0, formData.currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      {hasPayment && (
        <div className="border-t border-gray-200 pt-6 mb-6">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">PAYMENT INSTRUCTIONS</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {formData.payment_account_name && (
              <div><span className="text-gray-400">Account Name:</span> <span>{formData.payment_account_name}</span></div>
            )}
            {formData.payment_bank_name && (
              <div><span className="text-gray-400">Bank Name:</span> <span>{formData.payment_bank_name}</span></div>
            )}
            {formData.payment_account_number && (
              <div><span className="text-gray-400">Account / IBAN:</span> <span>{formData.payment_account_number}</span></div>
            )}
            {formData.payment_swift_code && (
              <div><span className="text-gray-400">SWIFT / BIC:</span> <span>{formData.payment_swift_code}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8">
        <p className="text-sm italic text-gray-400">Thank you for your business.</p>
      </div>
    </div>
  );
});

InvoicePreview.displayName = "InvoicePreview";
export default InvoicePreview;
