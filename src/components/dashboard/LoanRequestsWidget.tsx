import { Banknote, ArrowRight, Check, X, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useLoans } from "@/hooks/useLoans";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface LoanEmployee {
  first_name?: string;
  last_name?: string;
}

interface LoanRequestItem {
  id: string;
  amount: number;
  term_months?: number;
  submitted_at?: string;
  status: string;
  employees?: LoanEmployee;
}

export function LoanRequestsWidget() {
  const { pendingForManager, vpQueue, managerDecision, vpDecision, loading } = useLoans();
  const { isVP, isLineManager } = useAuth();
  const navigate = useNavigate();

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    loanId: string;
    action: "approve" | "reject";
    employeeName: string;
  } | null>(null);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);

  // VP sees the full vpQueue; managers/line-managers see only their assigned pending requests
  const requests = isVP ? vpQueue : pendingForManager;
  const pendingCount = requests.length;
  const displayRequests = requests.slice(0, 5);

  const getEmployeeName = (req: LoanRequestItem): string => {
    if (req.employees?.first_name || req.employees?.last_name) {
      return `${req.employees.first_name || ""} ${req.employees.last_name || ""}`.trim();
    }
    return "Unknown Employee";
  };

  const getInitials = (req: LoanRequestItem): string => {
    if (req.employees?.first_name && req.employees?.last_name) {
      return `${req.employees.first_name[0]}${req.employees.last_name[0]}`.toUpperCase();
    }
    if (req.employees?.first_name) {
      return req.employees.first_name.substring(0, 2).toUpperCase();
    }
    return "?";
  };

  const formatAmount = (amount: number) => {
    return `रु ${Number(amount).toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_manager":
        return (
          <Badge variant="outline" className="border-warning text-warning text-[10px] px-1.5">
            Manager Review
          </Badge>
        );
      case "pending_vp":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500 text-[10px] px-1.5">
            VP Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5">
            {status}
          </Badge>
        );
    }
  };

  const handleAction = (loanId: string, action: "approve" | "reject", employeeName: string) => {
    setActionDialog({ open: true, loanId, action, employeeName });
    setComment("");
  };

  const confirmAction = async () => {
    if (!actionDialog) return;
    setActing(true);
    try {
      const { loanId, action } = actionDialog;
      const decision = action === "approve" ? "approved" : "rejected";

      // Find the loan to determine which decision function to call
      const loan = requests.find((r: LoanRequestItem) => r.id === loanId);
      if (!loan) return;

      if (loan.status === "pending_manager") {
        await managerDecision(loanId, decision, comment || `${decision} via dashboard`);
      } else if (loan.status === "pending_vp" && isVP) {
        await vpDecision(loanId, decision, comment || `${decision} via dashboard`);
      }
    } finally {
      setActing(false);
      setActionDialog(null);
      setComment("");
    }
  };

  // Only show for managers, line managers, and VPs
  if (!isVP && !isLineManager && pendingForManager.length === 0) return null;

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Loan Requests
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold">
                {pendingCount}
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/loans" className="flex items-center gap-1 text-xs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : displayRequests.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No pending loan requests
            </div>
          ) : (
            displayRequests.map((req: LoanRequestItem) => {
              const name = getEmployeeName(req);
              const canActAsManager = req.status === "pending_manager" && !isVP;
              const canActAsVP = isVP && (req.status === "pending_vp" || req.status === "pending_manager");

              return (
                <div
                  key={req.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(req)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(req.amount)}
                      {req.term_months && ` · ${req.term_months} mo`}
                      {req.submitted_at && ` · ${format(parseISO(req.submitted_at), "MMM d")}`}
                    </p>
                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => navigate("/loans")}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      {(canActAsManager || canActAsVP) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                            onClick={() => handleAction(req.id, "approve", name)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleAction(req.id, "reject", name)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Confirm action dialog */}
      <AlertDialog open={!!actionDialog?.open} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.action === "approve" ? "Approve" : "Reject"} Loan Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.action === "approve"
                ? `Approve ${actionDialog?.employeeName}'s loan request?`
                : `Reject ${actionDialog?.employeeName}'s loan request?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Add a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={acting}
              className={
                actionDialog?.action === "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {acting
                ? "Processing..."
                : actionDialog?.action === "approve"
                  ? "Approve"
                  : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
