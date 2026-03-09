import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { LoanRequestForm } from "./LoanRequestForm";
import { SIMPLIFIED_STATUS_LABELS, LoanPolicy, FIXED_ANNUAL_RATE } from "@/lib/loanCalculations";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface EmployeeLoanDashboardProps {
  myLoans: any[];
  employeeData: any;
  loanPolicy: LoanPolicy | null;
  onCreateLoan: (data: any) => Promise<any>;
  onDeleteLoan: (loanId: string) => Promise<void>;
  fetchRepayments?: (loanId: string) => Promise<any[]>;
  repayments?: Record<string, any[]>;
  isVP?: boolean;
}

export function EmployeeLoanDashboard({
  myLoans,
  employeeData,
  loanPolicy,
  onCreateLoan,
  onDeleteLoan,
  fetchRepayments,
  repayments = {},
  isVP,
}: EmployeeLoanDashboardProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const statusColor = (s: string) => {
    if (["approved", "disbursed"].includes(s)) return "default";
    if (s === "closed") return "secondary";
    if (s === "rejected") return "destructive";
    return "outline";
  };

  const toggleRepayments = async (loanId: string) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
      return;
    }
    setExpandedLoan(loanId);
    if (fetchRepayments && !repayments[loanId]) {
      await fetchRepayments(loanId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Loan Requests</h3>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Apply for Loan
        </Button>
      </div>

      {myLoans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No loan requests yet. Click "Apply for Loan" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myLoans.map((loan) => (
            <Card key={loan.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      NPR {Number(loan.amount).toLocaleString()} · {loan.term_months} months
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {loan.submitted_at ? format(new Date(loan.submitted_at), "MMM dd, yyyy") : "N/A"}
                      {loan.estimated_monthly_installment
                        ? ` · EMI: NPR ${Number(loan.estimated_monthly_installment).toFixed(2)}/mo`
                        : ""}
                    </p>
                    {["disbursed", "closed"].includes(loan.status) && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Balance: </span>
                        <span className={loan.status === "closed" ? "text-green-600 font-medium" : "font-medium"}>
                          NPR {Number(loan.remaining_balance ?? loan.amount).toFixed(2)}
                        </span>
                        {loan.status === "closed" && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Fully Paid</Badge>
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusColor(loan.status) as any}>
                    {SIMPLIFIED_STATUS_LABELS[loan.status] || loan.status}
                  </Badge>
                </div>
                <LoanStatusTimeline currentStatus={loan.status} />

                {/* Repayment history toggle for disbursed/closed loans */}
                {["disbursed", "closed"].includes(loan.status) && fetchRepayments && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => toggleRepayments(loan.id)}
                    >
                      {expandedLoan === loan.id ? (
                        <><ChevronUp className="h-3 w-3 mr-1" /> Hide Repayments</>
                      ) : (
                        <><ChevronDown className="h-3 w-3 mr-1" /> View Repayments</>
                      )}
                    </Button>
                    {expandedLoan === loan.id && (
                      <div className="mt-2">
                        {(repayments[loan.id] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No repayments recorded yet</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">#</TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Amount</TableHead>
                                <TableHead className="text-xs">Principal</TableHead>
                                <TableHead className="text-xs">Interest</TableHead>
                                <TableHead className="text-xs">Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(repayments[loan.id] || []).map((r: any) => (
                                <TableRow key={r.id}>
                                  <TableCell className="text-xs">{r.month_number}</TableCell>
                                  <TableCell className="text-xs">
                                    {r.deducted_at ? format(new Date(r.deducted_at), "MMM dd, yyyy") : "-"}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium">NPR {Number(r.total_amount).toFixed(2)}</TableCell>
                                  <TableCell className="text-xs">NPR {Number(r.principal_amount).toFixed(2)}</TableCell>
                                  <TableCell className="text-xs">NPR {Number(r.interest_amount).toFixed(2)}</TableCell>
                                  <TableCell className="text-xs">NPR {Number(r.remaining_balance).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {["pending_vp", "pending_manager", "rejected", "draft"].includes(loan.status) && (
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this loan request? This action cannot be undone.",
                          )
                        ) {
                          onDeleteLoan(loan.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LoanRequestForm
        open={showForm}
        onOpenChange={setShowForm}
        employeeData={employeeData}
        loanPolicy={loanPolicy}
        onSubmit={onCreateLoan}
      />
    </div>
  );
}
