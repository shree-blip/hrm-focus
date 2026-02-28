import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { SIMPLIFIED_STATUS_LABELS } from "@/lib/loanCalculations";
import { ThumbsUp, ThumbsDown, Crown, Banknote } from "lucide-react";
import { format } from "date-fns";

interface VPPanelProps {
  vpQueue: any[];
  vpHistory: any[];
  onDecision: (loanId: string, decision: 'approved' | 'rejected', comment: string, disbursementDate?: string, autoPayroll?: boolean) => Promise<void>;
  onDisburse: (loanId: string, disbursementDate: string) => Promise<void>;
}

export function VPPanel({ vpQueue, vpHistory, onDecision, onDisburse }: VPPanelProps) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [disbursementDate, setDisbursementDate] = useState('');
  const [autoPayroll, setAutoPayroll] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getEmpName = (loan: any) => {
    const emp = loan.employees;
    return emp ? `${emp.first_name} ${emp.last_name}` : loan.employee_id?.substring(0, 8);
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedLoan || !comment.trim()) return;
    setSubmitting(true);
    await onDecision(selectedLoan.id, decision, comment, disbursementDate || undefined, autoPayroll);
    setSubmitting(false);
    setSelectedLoan(null);
    setComment('');
    setDisbursementDate('');
  };

  const handleDisburse = async (loan: any) => {
    const date = new Date().toISOString().split('T')[0];
    await onDisburse(loan.id, date);
  };

  const statusColor = (s: string) => {
    if (['approved', 'disbursed'].includes(s)) return 'default';
    if (s === 'rejected') return 'destructive';
    return 'outline';
  };

  const approvedNotDisbursed = vpHistory.filter(l => l.status === 'approved');

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Awaiting VP Decision</p>
            <p className="text-2xl font-bold">{vpQueue.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {vpQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpQueue.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm font-medium">{getEmpName(loan)}</TableCell>
                    <TableCell className="font-medium">${Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell><Badge variant="outline">{loan.reason_type}</Badge></TableCell>
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

      {/* Approved - Ready to Disburse */}
      {approvedNotDisbursed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Ready to Disburse</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedNotDisbursed.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm">{getEmpName(loan)}</TableCell>
                    <TableCell>${Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleDisburse(loan)}>
                        <Banknote className="h-4 w-4 mr-1" /> Disburse
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {vpHistory.filter(l => l.status !== 'approved').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpHistory.filter(l => l.status !== 'approved').map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm">{getEmpName(loan)}</TableCell>
                    <TableCell>${Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(loan.status) as any}>
                        {SIMPLIFIED_STATUS_LABELS[loan.status] || loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(loan.updated_at), 'MMM dd, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setComment(''); setDisbursementDate(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>VP Final Decision</DialogTitle>
            <DialogDescription>Approve or reject this loan request</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Employee:</strong> {getEmpName(selectedLoan)}</p>
                <p><strong>Amount:</strong> ${Number(selectedLoan.amount).toLocaleString()}</p>
                <p><strong>Term:</strong> {selectedLoan.term_months} months</p>
                <p><strong>EMI:</strong> ${Number(selectedLoan.estimated_monthly_installment || 0).toFixed(2)}/mo</p>
                <p><strong>Reason:</strong> {selectedLoan.reason_type}</p>
                <p><strong>Position:</strong> {selectedLoan.employees?.position_level || selectedLoan.position_level}</p>
              </div>

              <LoanStatusTimeline currentStatus={selectedLoan.status} />

              <div>
                <Label>Disbursement Date (if approving)</Label>
                <Input type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={autoPayroll} onCheckedChange={(c) => setAutoPayroll(!!c)} id="auto-payroll" />
                <label htmlFor="auto-payroll" className="text-sm">Enable Auto Payroll Deduction</label>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Comment <span className="text-destructive">*</span></p>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Mandatory comment..." />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleDecision('approved')} disabled={!comment.trim() || submitting} className="flex-1">
                  <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => handleDecision('rejected')} disabled={!comment.trim() || submitting} className="flex-1">
                  <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
