import { useState } from "react";
import { useAllInvoices, useInvoiceComments, useReviewInvoice, useAddInvoiceComment, getInvoicePDFUrl, Invoice, InvoiceFormData } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Eye, Check, X, Send, Download } from "lucide-react";
import { format } from "date-fns";
import InvoicePreview from "./InvoicePreview";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function VPInvoicePanel() {
  const { data: invoices, isLoading } = useAllInvoices();
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [comment, setComment] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const { data: comments } = useInvoiceComments(selected?.id);
  const reviewMut = useReviewInvoice();
  const commentMut = useAddInvoiceComment();

  const handleOpen = async (inv: Invoice) => {
    setSelected(inv);
    setPdfUrl(null);
    if (inv.pdf_file_path) {
      try {
        const url = await getInvoicePDFUrl(inv.pdf_file_path);
        setPdfUrl(url);
      } catch {}
    }
  };

  const handleComment = () => {
    if (!comment.trim() || !selected) return;
    commentMut.mutate({ invoiceId: selected.id, content: comment.trim() });
    setComment("");
  };

  const toFormData = (inv: Invoice): InvoiceFormData => ({
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

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n) + ` ${c}`;

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <>
      {!invoices?.length ? (
        <div className="py-16 text-center text-muted-foreground">No submitted invoices yet.</div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.employees ? `${inv.employees.first_name} ${inv.employees.last_name}` : "Unknown"} · {inv.bill_to_name} · {fmt(inv.amount, inv.currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {inv.submitted_at && <span className="text-xs text-muted-foreground">{format(new Date(inv.submitted_at), "MMM dd, yyyy")}</span>}
                <Badge className={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                <Button variant="ghost" size="icon" onClick={() => handleOpen(inv)}><Eye className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selected.invoice_number} — {selected.employees ? `${selected.employees.first_name} ${selected.employees.last_name}` : ""}</span>
                  {selected.status === "submitted" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-destructive border-destructive" onClick={() => { reviewMut.mutate({ invoiceId: selected.id, decision: "rejected" }); setSelected(null); }}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { reviewMut.mutate({ invoiceId: selected.id, decision: "approved" }); setSelected(null); }}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    </div>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                {/* Left: Preview */}
                <div className="lg:col-span-2">
                  {pdfUrl ? (
                    <div>
                      <iframe src={pdfUrl} className="w-full h-[600px] rounded border" />
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-primary flex items-center gap-1 mt-2"><Download className="h-3 w-3" /> Download PDF</a>
                    </div>
                  ) : (
                    <InvoicePreview formData={toFormData(selected)} />
                  )}
                </div>

                {/* Right: Comments + Meta */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <p><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[selected.status] || ""}>{selected.status}</Badge></p>
                      <p><span className="text-muted-foreground">Amount:</span> {fmt(selected.amount, selected.currency)}</p>
                      {selected.submitted_at && <p><span className="text-muted-foreground">Submitted:</span> {format(new Date(selected.submitted_at), "MMM dd, yyyy")}</p>}
                      {selected.reviewed_at && <p><span className="text-muted-foreground">Reviewed:</span> {format(new Date(selected.reviewed_at), "MMM dd, yyyy")}</p>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Comments</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-[250px] overflow-y-auto mb-3">
                        {comments?.length ? comments.map(c => (
                          <div key={c.id} className="text-xs">
                            <p className="font-medium">{c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : "User"}</p>
                            <p className="text-muted-foreground">{format(new Date(c.created_at), "MMM dd, HH:mm")}</p>
                            <p className="mt-1">{c.content}</p>
                          </div>
                        )) : <p className="text-xs text-muted-foreground">No comments yet</p>}
                      </div>
                      <div className="flex gap-2">
                        <Textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…" className="text-xs" />
                        <Button size="icon" variant="ghost" onClick={handleComment} disabled={!comment.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
