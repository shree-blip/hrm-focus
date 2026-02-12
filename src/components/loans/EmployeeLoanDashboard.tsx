import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { LoanRequestForm } from "./LoanRequestForm";
import { STATUS_LABELS } from "@/lib/loanCalculations";
import { Plus, DollarSign, Calendar, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";

interface EmployeeLoanDashboardProps {
  myLoans: any[];
  repayments: any[];
  agreements: any[];
  employeeData: any;
  onCreateLoan: (data: any) => Promise<any>;
}

export function EmployeeLoanDashboard({ myLoans, repayments, agreements, employeeData, onCreateLoan }: EmployeeLoanDashboardProps) {
  const [showForm, setShowForm] = useState(false);

  const activeLoans = myLoans.filter(l => ['disbursed', 'repaying'].includes(l.status));
  const myRepayments = repayments.filter(r => activeLoans.some(l => l.id === r.loan_request_id));
  const pendingRepayments = myRepayments.filter(r => r.status === 'pending');
  const totalOutstanding = pendingRepayments.reduce((s, r) => s + Number(r.remaining_balance), 0);
  const nextDeduction = pendingRepayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const statusColor = (s: string) => {
    if (['approved', 'disbursed', 'repaying', 'closed'].includes(s)) return 'default';
    if (s === 'rejected') return 'destructive';
    if (s === 'deferred') return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className="text-xl font-bold">${totalOutstanding.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Next Deduction</p>
              <p className="text-xl font-bold">{nextDeduction ? format(new Date(nextDeduction.due_date), 'MMM dd') : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Next Amount</p>
              <p className="text-xl font-bold">{nextDeduction ? `$${Number(nextDeduction.total_amount).toFixed(2)}` : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Remaining Months</p>
              <p className="text-xl font-bold">{pendingRepayments.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Loan Requests</h3>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Apply for Loan
        </Button>
      </div>

      {/* Loan List */}
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
                    <p className="font-medium">${Number(loan.amount).toLocaleString()} · {loan.term_months} months</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {loan.submitted_at ? format(new Date(loan.submitted_at), 'MMM dd, yyyy') : 'N/A'} · EMI: ${Number(loan.estimated_monthly_installment || 0).toFixed(2)}/mo
                    </p>
                  </div>
                  <Badge variant={statusColor(loan.status) as any}>{STATUS_LABELS[loan.status] || loan.status}</Badge>
                </div>
                <LoanStatusTimeline currentStatus={loan.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Repayment Schedule */}
      {myRepayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repayment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRepayments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.month_number}</TableCell>
                    <TableCell>{format(new Date(r.due_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>${Number(r.principal_amount).toFixed(2)}</TableCell>
                    <TableCell>${Number(r.interest_amount).toFixed(2)}</TableCell>
                    <TableCell className="font-medium">${Number(r.total_amount).toFixed(2)}</TableCell>
                    <TableCell>${Number(r.remaining_balance).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'deducted' ? 'default' : r.status === 'missed' ? 'destructive' : 'outline'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <LoanRequestForm
        open={showForm}
        onOpenChange={setShowForm}
        employeeData={employeeData}
        onSubmit={onCreateLoan}
      />
    </div>
  );
}
