import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { LoanRequestForm } from "./LoanRequestForm";
import { SIMPLIFIED_STATUS_LABELS, LoanPolicy } from "@/lib/loanCalculations";
import { Plus } from "lucide-react";
import { format } from "date-fns";

interface EmployeeLoanDashboardProps {
  myLoans: any[];
  employeeData: any;
  loanPolicy: LoanPolicy | null;
  onCreateLoan: (data: any) => Promise<any>;
}

export function EmployeeLoanDashboard({ myLoans, employeeData, loanPolicy, onCreateLoan }: EmployeeLoanDashboardProps) {
  const [showForm, setShowForm] = useState(false);

  const statusColor = (s: string) => {
    if (['approved', 'disbursed'].includes(s)) return 'default';
    if (s === 'rejected') return 'destructive';
    return 'outline';
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
                    <p className="font-medium">${Number(loan.amount).toLocaleString()} · {loan.term_months} months</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {loan.submitted_at ? format(new Date(loan.submitted_at), 'MMM dd, yyyy') : 'N/A'}
                      {loan.estimated_monthly_installment ? ` · EMI: $${Number(loan.estimated_monthly_installment).toFixed(2)}/mo` : ''}
                    </p>
                  </div>
                  <Badge variant={statusColor(loan.status) as any}>
                    {SIMPLIFIED_STATUS_LABELS[loan.status] || loan.status}
                  </Badge>
                </div>
                <LoanStatusTimeline currentStatus={loan.status} />
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
