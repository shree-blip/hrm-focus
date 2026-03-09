import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { SIMPLIFIED_STATUS_LABELS, FIXED_ANNUAL_RATE, calculateEMI, generateAmortizationSchedule, getTotalInterest, getTotalPayment } from "@/lib/loanCalculations";
import { ThumbsUp, ThumbsDown, User, Banknote, CalendarDays, Percent, FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { usePersistentState } from "@/hooks/usePersistentState";

interface ManagerPanelProps {
  pendingRequests: any[];
  history: any[];
  onDecision: (loanId: string, decision: 'approved' | 'rejected', comment: string) => Promise<void>;
}

export function ManagerPanel({ pendingRequests, history, onDecision }: ManagerPanelProps) {
  const [activeTab, setActiveTab] = usePersistentState("loans:managerPanelTab", "pending");
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getEmpName = (loan: any) => {
    const emp = loan.employees;
    return emp ? `${emp.first_name} ${emp.last_name}` : loan.employee_id?.substring(0, 8);
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedLoan || !comment.trim()) return;
    setSubmitting(true);
    await onDecision(selectedLoan.id, decision, comment);
    setSubmitting(false);
    setSelectedLoan(null);
    setComment('');
  };

  const statusColor = (s: string) => {
    if (['approved', 'disbursed'].includes(s)) return 'default';
    if (s === 'rejected') return 'destructive';
    return 'outline';
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="pending">Pending Requests ({pendingRequests.length})</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="pending">
        {pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No pending loan requests
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="text-sm font-medium">{getEmpName(loan)}</TableCell>
                      <TableCell className="font-medium">NPR {Number(loan.amount).toLocaleString()}</TableCell>
                      <TableCell>{loan.term_months}mo</TableCell>
                      <TableCell><Badge variant="outline">{loan.reason_type}</Badge></TableCell>
                      <TableCell className="text-xs">{loan.submitted_at ? format(new Date(loan.submitted_at), 'MMM dd') : '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setSelectedLoan(loan)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history">
        {history.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No history</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="text-sm">{getEmpName(loan)}</TableCell>
                      <TableCell>NPR {Number(loan.amount).toLocaleString()}</TableCell>
                      <TableCell>{loan.term_months}mo</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(loan.status) as any}>
                          {SIMPLIFIED_STATUS_LABELS[loan.status] || loan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(loan.created_at), 'MMM dd, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Review Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setComment(''); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">Review Loan Request</DialogTitle>
            <DialogDescription>Review the details below and provide your decision.</DialogDescription>
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
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your Decision</p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="manager-comment" className="text-sm flex items-center gap-1.5 mb-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comment <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="manager-comment"
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
    </Tabs>
  );
}
