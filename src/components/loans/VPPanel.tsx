import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { SIMPLIFIED_STATUS_LABELS, FIXED_ANNUAL_RATE, calculateEMI, generateAmortizationSchedule, getTotalInterest, getTotalPayment } from "@/lib/loanCalculations";
import { ThumbsUp, ThumbsDown, Crown, Banknote, DollarSign, ChevronDown, ChevronUp, User, CalendarDays, Percent, FileText, MessageSquare, Calendar } from "lucide-react";
import { format } from "date-fns";

interface VPPanelProps {
  vpQueue: any[];
  vpHistory: any[];
  activeDisbursed?: any[];
  repayments?: Record<string, any[]>;
  onDecision: (loanId: string, decision: 'approved' | 'rejected', comment: string, disbursementDate?: string, autoPayroll?: boolean) => Promise<void>;
  onDisburse: (loanId: string, disbursementDate: string) => Promise<void>;
  onRecordRepayment?: (loanId: string, amount: number) => Promise<void>;
  fetchRepayments?: (loanId: string) => Promise<any[]>;
}

export function VPPanel({
  vpQueue,
  vpHistory,
  activeDisbursed = [],
  repayments = {},
  onDecision,
  onDisburse,
  onRecordRepayment,
  fetchRepayments,
}: VPPanelProps) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [disbursementDate, setDisbursementDate] = useState('');
  const [autoPayroll, setAutoPayroll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<any>(null);
  const [repaymentAmount, setRepaymentAmount] = useState(0);
  const [repaymentSubmitting, setRepaymentSubmitting] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

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

  const handleRecordRepayment = async () => {
    if (!repaymentLoan || !onRecordRepayment || repaymentAmount <= 0) return;
    setRepaymentSubmitting(true);
    await onRecordRepayment(repaymentLoan.id, repaymentAmount);
    setRepaymentSubmitting(false);
    setRepaymentLoan(null);
    setRepaymentAmount(0);
  };

  const toggleRepaymentHistory = async (loanId: string) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
      return;
    }
    setExpandedLoan(loanId);
    if (fetchRepayments && !repayments[loanId]) {
      await fetchRepayments(loanId);
    }
  };

  const statusColor = (s: string) => {
    if (['approved', 'disbursed'].includes(s)) return 'default';
    if (s === 'closed') return 'secondary';
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
            <p className="text-xs text-muted-foreground">Awaiting CEO Decision</p>
            <p className="text-2xl font-bold">{vpQueue.length}</p>
          </div>
          {activeDisbursed.length > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Active Loans</p>
              <p className="text-2xl font-bold text-green-600">{activeDisbursed.length}</p>
            </div>
          )}
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
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpQueue.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm font-medium">{getEmpName(loan)}</TableCell>
                    <TableCell className="font-medium">NPR {Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell>
                      <Badge variant={loan.status === 'pending_manager' ? 'secondary' : 'outline'}>
                        {loan.status === 'pending_manager' ? 'Awaiting Manager' : 'Awaiting You'}
                      </Badge>
                    </TableCell>
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
                    <TableCell>NPR {Number(loan.amount).toLocaleString()}</TableCell>
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

      {/* Active Loans - Repayment Tracking */}
      {activeDisbursed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Active Loans ({FIXED_ANNUAL_RATE}% p.a.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>EMI</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDisbursed.map((loan) => {
                  const balance = Number(loan.remaining_balance ?? loan.amount);
                  return (
                    <>
                      <TableRow key={loan.id}>
                        <TableCell className="text-sm font-medium">{getEmpName(loan)}</TableCell>
                        <TableCell>NPR {Number(loan.amount).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">NPR {balance.toFixed(2)}</TableCell>
                        <TableCell>{loan.term_months}mo</TableCell>
                        <TableCell>NPR {Number(loan.estimated_monthly_installment || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRepaymentLoan(loan);
                                setRepaymentAmount(Number(loan.estimated_monthly_installment || 0));
                              }}
                            >
                              <DollarSign className="h-3 w-3 mr-1" /> Record Payment
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleRepaymentHistory(loan.id)}
                            >
                              {expandedLoan === loan.id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedLoan === loan.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-2">
                            {(repayments[loan.id] || []).length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">No repayments yet</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">#</TableHead>
                                    <TableHead className="text-xs">Date</TableHead>
                                    <TableHead className="text-xs">Total</TableHead>
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
                                        {r.deducted_at ? format(new Date(r.deducted_at), "MMM dd") : "-"}
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
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {vpHistory.filter(l => !['approved', 'disbursed'].includes(l.status)).length > 0 && (
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
                {vpHistory.filter(l => !['approved', 'disbursed'].includes(l.status)).map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm">{getEmpName(loan)}</TableCell>
                    <TableCell>NPR {Number(loan.amount).toLocaleString()}</TableCell>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">
              {selectedLoan?.status === 'pending_manager' ? 'Direct CEO Review' : 'CEO Final Decision'}
            </DialogTitle>
            <DialogDescription>
              {selectedLoan?.status === 'pending_manager'
                ? 'This loan is pending manager review. You can approve or reject it directly.'
                : 'Review the details below and provide your final decision.'}
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (() => {
            const emi = calculateEMI(Number(selectedLoan.amount), FIXED_ANNUAL_RATE, selectedLoan.term_months);
            const schedule = generateAmortizationSchedule(Number(selectedLoan.amount), FIXED_ANNUAL_RATE, selectedLoan.term_months);
            const totalInterest = getTotalInterest(schedule);
            const totalPayment = getTotalPayment(schedule);

            return (
              <div className="flex flex-col gap-0">
                {/* Loan Details Section */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Loan Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Employee</p>
                        <p className="text-sm font-medium truncate">{getEmpName(selectedLoan)}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedLoan.employees?.position_level || selectedLoan.position_level || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Banknote className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold">NPR {Number(selectedLoan.amount).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Term</p>
                        <p className="text-sm font-medium">{selectedLoan.term_months} month{selectedLoan.term_months > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Percent className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Interest Rate</p>
                        <p className="text-sm font-medium">{FIXED_ANNUAL_RATE}% p.a. (fixed)</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mt-3 flex items-start gap-3 rounded-lg border p-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Reason</p>
                      <Badge variant="outline" className="mt-0.5">{selectedLoan.reason_type}</Badge>
                    </div>
                  </div>

                  {/* Manager Comment (if VP stage) */}
                  {selectedLoan.manager_comment && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Manager Comment</p>
                        <p className="text-sm break-words">{selectedLoan.manager_comment}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Repayment Summary */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Repayment Summary</p>
                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Monthly EMI</p>
                      <p className="text-sm font-bold text-primary">NPR {emi.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Total Interest</p>
                      <p className="text-sm font-bold">NPR {totalInterest.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Total Repayment</p>
                      <p className="text-sm font-bold">NPR {totalPayment.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Timeline */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status</p>
                  <LoanStatusTimeline currentStatus={selectedLoan.status} />
                </div>

                <Separator />

                {/* Decision Section */}
                <div className="px-6 py-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your Decision</p>

                  {/* Disbursement Date */}
                  <div>
                    <Label htmlFor="vp-disburse-date" className="text-sm flex items-center gap-1.5 mb-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Disbursement Date
                      <span className="text-muted-foreground text-xs font-normal">(if approving)</span>
                    </Label>
                    <Input
                      id="vp-disburse-date"
                      type="date"
                      value={disbursementDate}
                      onChange={(e) => setDisbursementDate(e.target.value)}
                    />
                  </div>

                  {/* Auto Payroll */}
                  <div className="flex items-center gap-2.5 rounded-lg border p-3">
                    <Checkbox checked={autoPayroll} onCheckedChange={(c) => setAutoPayroll(!!c)} id="auto-payroll" />
                    <label htmlFor="auto-payroll" className="text-sm cursor-pointer select-none">
                      Enable automatic payroll EMI deduction
                    </label>
                  </div>

                  {/* Comment */}
                  <div>
                    <Label htmlFor="vp-comment" className="text-sm flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comment <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="vp-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Provide your rationale for approval or rejection…"
                      rows={3}
                      className="resize-none"
                    />
                    {!comment.trim() && (
                      <p className="text-xs text-muted-foreground mt-1">A comment is required before submitting your decision.</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <DialogFooter className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision('rejected')}
                    disabled={!comment.trim() || submitting}
                    className="w-full sm:w-auto gap-1.5"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleDecision('approved')}
                    disabled={!comment.trim() || submitting}
                    className="w-full sm:w-auto gap-1.5"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Approve
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Record Repayment Dialog */}
      <Dialog open={!!repaymentLoan} onOpenChange={() => { setRepaymentLoan(null); setRepaymentAmount(0); }}>
        <DialogContent className="sm:max-w-sm p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">Record Repayment</DialogTitle>
            <DialogDescription>Record a manual repayment for this loan.</DialogDescription>
          </DialogHeader>
          {repaymentLoan && (
            <div className="flex flex-col gap-0">
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Employee</p>
                      <p className="text-sm font-medium truncate">{getEmpName(repaymentLoan)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[11px] text-muted-foreground">Loan Amount</p>
                      <p className="text-sm font-bold">NPR {Number(repaymentLoan.amount).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[11px] text-muted-foreground">Remaining</p>
                      <p className="text-sm font-bold text-primary">NPR {Number(repaymentLoan.remaining_balance ?? repaymentLoan.amount).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="px-6 py-4 space-y-3">
                <div>
                  <Label htmlFor="repay-amount" className="text-sm mb-1.5 block">
                    Repayment Amount (NPR)
                  </Label>
                  <Input
                    id="repay-amount"
                    type="number"
                    value={repaymentAmount || ''}
                    onChange={(e) => setRepaymentAmount(parseFloat(e.target.value) || 0)}
                    max={Number(repaymentLoan.remaining_balance ?? repaymentLoan.amount)}
                    min={0}
                    step="0.01"
                    placeholder={`Suggested: NPR ${Number(repaymentLoan.estimated_monthly_installment || 0).toFixed(2)}`}
                  />
                  {repaymentAmount > Number(repaymentLoan.remaining_balance ?? repaymentLoan.amount) && (
                    <p className="text-xs text-destructive mt-1">Exceeds remaining balance</p>
                  )}
                </div>
              </div>

              <DialogFooter className="px-6 pb-6 pt-2">
                <Button
                  onClick={handleRecordRepayment}
                  disabled={repaymentAmount <= 0 || repaymentAmount > Number(repaymentLoan.remaining_balance ?? repaymentLoan.amount) || repaymentSubmitting}
                  className="w-full gap-1.5"
                >
                  <DollarSign className="h-4 w-4" />
                  {repaymentSubmitting ? 'Recording…' : 'Record Repayment'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
