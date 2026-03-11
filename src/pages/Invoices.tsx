import { useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { usePersistentState } from "@/hooks/usePersistentState";
import InvoiceForm from "@/components/invoices/InvoiceForm";
import InvoicePreview from "@/components/invoices/InvoicePreview";
import MyInvoicesList from "@/components/invoices/MyInvoicesList";
import VPInvoicePanel from "@/components/invoices/VPInvoicePanel";
import { InvoiceFormData, Invoice, useCreateInvoice, useSubmitInvoice, uploadInvoicePDF } from "@/hooks/useInvoices";

const today = new Date().toISOString().split("T")[0];

const defaultForm: InvoiceFormData = {
  sender_name: "",
  sender_address: "",
  sender_email: "",
  bill_to_client_id: "",
  bill_to_name: "",
  bill_to_address: "",
  invoice_number: "",
  invoice_date: today,
  due_date: "",
  month_of_service: "",
  service_description: "",
  amount: 0,
  currency: "NPR",
  payment_account_name: "",
  payment_bank_name: "",
  payment_account_number: "",
  payment_swift_code: "",
};

export default function Invoices() {
  const { isVP } = useAuth();
  const [vpTab, setVpTab] = usePersistentState("invoices:vpTab", "submissions");
  const [view, setView] = useState<"list" | "create" | "view">("list");
  const [formData, setFormData] = useState<InvoiceFormData>(defaultForm);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuth();

  const createMut = useCreateInvoice();
  const submitMut = useSubmitInvoice();

  const handleChange = useCallback((partial: Partial<InvoiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleViewInvoice = (inv: Invoice) => {
    setViewInvoice(inv);
    setFormData({
      sender_name: inv.sender_name,
      sender_address: inv.sender_address || "",
      sender_email: inv.sender_email || "",
      bill_to_client_id: inv.bill_to_client_id || "",
      bill_to_name: inv.bill_to_name,
      bill_to_address: inv.bill_to_address || "",
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date || "",
      month_of_service: inv.month_of_service || "",
      service_description: inv.service_description || "",
      amount: inv.amount,
      currency: inv.currency,
      payment_account_name: inv.payment_account_name || "",
      payment_bank_name: inv.payment_bank_name || "",
      payment_account_number: inv.payment_account_number || "",
      payment_swift_code: inv.payment_swift_code || "",
    });
    setView("view");
  };

  const handleCreateNew = () => {
    setFormData(defaultForm);
    setViewInvoice(null);
    setView("create");
  };

  const handleBack = () => {
    setView("list");
    setViewInvoice(null);
    setFormData(defaultForm);
  };

  const validate = () => {
    if (!formData.sender_name) {
      toast.error("Sender name is required");
      return false;
    }
    if (!formData.bill_to_name) {
      toast.error("Bill to name is required");
      return false;
    }
    if (!formData.invoice_number) {
      toast.error("Invoice number is required");
      return false;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error("Amount must be greater than 0");
      return false;
    }
    return true;
  };

  const handleSubmitToCEO = async () => {
    if (!validate()) return;
    try {
      const inv = await createMut.mutateAsync(formData);
      await submitMut.mutateAsync({ invoiceId: (inv as any).id });
      handleBack();
    } catch {}
  };

  const handleUploadAndSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF must be under 10MB");
      return;
    }
    if (!validate()) return;
    setUploading(true);
    try {
      const inv = await createMut.mutateAsync(formData);
      const path = await uploadInvoicePDF(user!.id, file);
      await submitMut.mutateAsync({ invoiceId: (inv as any).id, pdfPath: path });
      handleBack();
    } catch {
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePrint = () => {
    const el = document.getElementById("invoice-preview");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>
      body{margin:0;padding:20px;font-family:'Segoe UI',system-ui,sans-serif;color:#111}
      table{width:100%;border-collapse:collapse}
      @media print{body{padding:0}}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const editorView = (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Upload PDF & Submit"}
          </Button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadAndSubmit} />
          {view === "create" && (
            <Button size="sm" onClick={handleSubmitToCEO} disabled={createMut.isPending || submitMut.isPending}>
              <Send className="h-4 w-4 mr-1" /> Submit to CEO
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceForm formData={formData} onChange={handleChange} disabled={view === "view"} />
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-4 self-start">
          <InvoicePreview formData={formData} />
        </div>
      </div>
    </>
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4">Invoices</h1>
        {isVP ? (
          <Tabs value={vpTab} onValueChange={setVpTab}>
            <TabsList>
              <TabsTrigger value="mine">My Invoices</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
            </TabsList>
            <TabsContent value="submissions">
              <VPInvoicePanel />
            </TabsContent>
            <TabsContent value="mine">
              {view === "list" ? (
                <MyInvoicesList onCreateNew={handleCreateNew} onViewInvoice={handleViewInvoice} />
              ) : (
                editorView
              )}
            </TabsContent>
          </Tabs>
        ) : view === "list" ? (
          <MyInvoicesList onCreateNew={handleCreateNew} onViewInvoice={handleViewInvoice} />
        ) : (
          editorView
        )}
      </div>
    </DashboardLayout>
  );
}
