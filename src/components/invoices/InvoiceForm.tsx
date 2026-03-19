import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceFormData } from "@/hooks/useInvoices";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const INVOICE_CLIENT_NAMES = ["Focus Your Finance Inc", "Focus Data Analysis LLC", "Gain Consult LLC"];

const CLIENT_ADDRESSES: Record<string, string> = {
  "focus your finance inc": "350 Main St Suite H-7\nPleasanton CA 94566",
  "focus data analysis llc": "350 Main St Suite H-7\nPleasanton CA 94566",
  "gain consult llc": "United States of America",
};

interface Props {
  formData: InvoiceFormData;
  onChange: (partial: Partial<InvoiceFormData>) => void;
  disabled?: boolean;
}

export default function InvoiceForm({ formData, onChange, disabled }: Props) {
  const { clients } = useClients();
  const { user } = useAuth();

  // Filter clients to only show the allowed ones
  const invoiceClients = clients.filter((c) =>
    INVOICE_CLIENT_NAMES.some((name) => c.name.toLowerCase().includes(name.toLowerCase())),
  );

  // Auto-fill sender name and email from profile on mount (still editable)
  useEffect(() => {
    if (!user || formData.sender_name) return;
    supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
          onChange({
            sender_name: fullName,
            // sender_email: data.email || user.email || "",
          });
        }
      });
  }, [user]);

  // Auto-fill client name and address when client is selected
  useEffect(() => {
    if (formData.bill_to_client_id) {
      const client = invoiceClients.find((c) => c.id === formData.bill_to_client_id);
      if (client) {
        const matchedKey = Object.keys(CLIENT_ADDRESSES).find((key) => client.name.toLowerCase().includes(key));
        const address = matchedKey ? CLIENT_ADDRESSES[matchedKey] : "";
        const updates: Partial<InvoiceFormData> = {};
        if (formData.bill_to_name !== client.name) updates.bill_to_name = client.name;
        if (formData.bill_to_address !== address) updates.bill_to_address = address;
        if (Object.keys(updates).length) onChange(updates);
      }
    }
  }, [formData.bill_to_client_id, invoiceClients]);

  return (
    <div className="space-y-6">
      {/* YOUR DETAILS */}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Your Details
        </legend>
        <div>
          <Label className="text-xs">Full Name</Label>
          <Input
            value={formData.sender_name}
            onChange={(e) => onChange({ sender_name: e.target.value })}
            placeholder="Your full name"
          />
        </div>
        <div>
          <Label className="text-xs">Address</Label>
          <Textarea
            rows={2}
            value={formData.sender_address}
            onChange={(e) => onChange({ sender_address: e.target.value })}
            placeholder="Your address"
          />
        </div>
        {/* <div>
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={formData.sender_email}
            onChange={(e) => onChange({ sender_email: e.target.value })}
            placeholder="Your email"
          />
        </div> */}
      </fieldset>

      {/* INVOICE DETAILS */}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Invoice Details
        </legend>
        <div>
          <Label className="text-xs">Bill To (Client)</Label>
          <Select value={formData.bill_to_client_id} onValueChange={(v) => onChange({ bill_to_client_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {invoiceClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Client Address</Label>
          <Textarea rows={2} value={formData.bill_to_address} readOnly className="bg-muted" />
        </div>
        <div>
          <Label className="text-xs">Invoice Number</Label>
          <Input
            value={formData.invoice_number}
            onChange={(e) => onChange({ invoice_number: e.target.value })}
            placeholder="INV-001"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Invoice Date</Label>
            <Input
              type="date"
              value={formData.invoice_date}
              onChange={(e) => onChange({ invoice_date: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={formData.due_date} onChange={(e) => onChange({ due_date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Month of Service</Label>
          <Select value={formData.month_of_service} onValueChange={(v) => onChange({ month_of_service: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Service Description</Label>
          <Textarea rows={3} value={formData.service_description} readOnly className="bg-muted" />
        </div>
        <div>
          <Label className="text-xs">Amount (NPR)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={formData.amount || ""}
            onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
          />
        </div>
      </fieldset>

      {/* PAYMENT INSTRUCTIONS */}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Payment Instructions
        </legend>
        <div>
          <Label className="text-xs">Account Name</Label>
          <Input
            value={formData.payment_account_name}
            onChange={(e) => onChange({ payment_account_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Bank Name</Label>
          <Input value={formData.payment_bank_name} onChange={(e) => onChange({ payment_bank_name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Account Number / IBAN</Label>
          <Input
            value={formData.payment_account_number}
            onChange={(e) => onChange({ payment_account_number: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">SWIFT / BIC Code</Label>
          <Input
            value={formData.payment_swift_code}
            onChange={(e) => onChange({ payment_swift_code: e.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}
