import { useMyInvoices, Invoice } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Eye } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface Props {
  onCreateNew: () => void;
  onViewInvoice: (inv: Invoice) => void;
}

export default function MyInvoicesList({ onCreateNew, onViewInvoice }: Props) {
  const { data: invoices, isLoading } = useMyInvoices();

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n) + ` ${c}`;

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">My Invoices</h2>
        <Button size="sm" onClick={onCreateNew}><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>
      </div>

      {!invoices?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-3">No invoices yet</p>
          <Button onClick={onCreateNew}>Create Your First Invoice</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.bill_to_name} · {fmt(inv.amount, inv.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "MMM dd, yyyy")}</span>
                <Badge className={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                <Button variant="ghost" size="icon" onClick={() => onViewInvoice(inv)}><Eye className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
