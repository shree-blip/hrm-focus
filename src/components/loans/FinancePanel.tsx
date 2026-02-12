import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, TrendingDown, Download, PiggyBank, ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";

interface FinancePanelProps {
  loanRequests: any[];
  budgets: any[];
  repayments: any[];
  onSubmitApproval: (loanId: string, step: string, decision: string, data?: any) => Promise<void>;
  onSetBudget: (year: number, month: number, budget: number) => Promise<void>;
  onExportDeductions: (month?: number, year?: number) => void;
  onCreateAgreement: (loanId: string, principal: number, termMonths: number) => Promise<void>;
  onCreateRepaymentSchedule: (loanId: string, agreementId: string, employeeId: string, userId: string, schedule: any[]) => Promise<void>;
}

export function FinancePanel({
  loanRequests, budgets, repayments, onSubmitApproval, onSetBudget, onExportDeductions, onCreateAgreement, onCreateRepaymentSchedule,
}: FinancePanelProps) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [budgetAvailable, setBudgetAvailable] = useState(false);
  const [cashflowApproved, setCashflowApproved] = useState(false);
  const [notes, setNotes] = useState('');

  const financeQueue = loanRequests.filter(l => l.status === 'finance_check');
  const currentBudget = budgets.find(b => b.year === new Date().getFullYear() && b.month === new Date().getMonth() + 1);
  const totalAllocated = currentBudget?.allocated_amount || 0;
  const totalBudget = currentBudget?.total_budget || 0;

  const pendingDeductions = repayments.filter(r => r.status === 'pending');
  const totalPendingAmount = pendingDeductions.reduce((s, r) => s + Number(r.total_amount), 0);

  const handleDecision = async (decision: string) => {
    if (!selectedLoan) return;
    await onSubmitApproval(selectedLoan.id, 'finance_check', decision, {
      budget_available: budgetAvailable,
      cashflow_approved: cashflowApproved,
      notes,
    });
    setSelectedLoan(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Monthly Budget</p>
              <p className="text-xl font-bold">${totalBudget.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Allocated</p>
              <p className="text-xl font-bold">${totalAllocated.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold">${(totalBudget - totalAllocated).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Download className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Deductions</p>
              <p className="text-xl font-bold">${totalPendingAmount.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set Monthly Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div>
              <Label>Year</Label>
              <Input type="number" value={budgetYear} onChange={(e) => setBudgetYear(parseInt(e.target.value))} className="w-24" />
            </div>
            <div>
              <Label>Month</Label>
              <Input type="number" value={budgetMonth} onChange={(e) => setBudgetMonth(parseInt(e.target.value))} min={1} max={12} className="w-20" />
            </div>
            <div>
              <Label>Budget ($)</Label>
              <Input type="number" value={budgetAmount || ''} onChange={(e) => setBudgetAmount(parseFloat(e.target.value) || 0)} className="w-32" />
            </div>
            <Button onClick={() => onSetBudget(budgetYear, budgetMonth, budgetAmount)}>Set Budget</Button>
          </div>
        </CardContent>
      </Card>

      {/* Finance Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex justify-between">
            <span>Finance Review Queue</span>
            <Button size="sm" variant="outline" onClick={() => onExportDeductions()}>
              <Download className="h-4 w-4 mr-1" /> Export Deductions
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {financeQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No loans pending finance review</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>EMI</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeQueue.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-xs">{loan.employee_id?.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">${Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell>${Number(loan.estimated_monthly_installment || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => setSelectedLoan(loan)}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finance Review</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Amount:</strong> ${Number(selectedLoan.amount).toLocaleString()}</p>
                <p><strong>Term:</strong> {selectedLoan.term_months} months</p>
                <p><strong>EMI:</strong> ${Number(selectedLoan.estimated_monthly_installment || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={budgetAvailable} onCheckedChange={(c) => setBudgetAvailable(!!c)} />
                  <span className="text-sm">Budget Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={cashflowApproved} onCheckedChange={(c) => setCashflowApproved(!!c)} />
                  <span className="text-sm">Cashflow Approved</span>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleDecision('approved')} className="flex-1"><ThumbsUp className="h-4 w-4 mr-1" /> Approve</Button>
                <Button variant="destructive" onClick={() => handleDecision('rejected')} className="flex-1"><ThumbsDown className="h-4 w-4 mr-1" /> Reject</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
