import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { STATUS_LABELS } from "@/lib/loanCalculations";
import { format } from "date-fns";
import { ClipboardCheck, Users, AlertCircle, ThumbsUp, ThumbsDown, Clock } from "lucide-react";

interface HRReviewPanelProps {
  loanRequests: any[];
  waitingList: any[];
  onSubmitApproval: (loanId: string, step: string, decision: string, data?: any) => Promise<void>;
  onUpdateStatus: (loanId: string, status: string) => Promise<void>;
}

export function HRReviewPanel({ loanRequests, waitingList, onSubmitApproval, onUpdateStatus }: HRReviewPanelProps) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [checklist, setChecklist] = useState({
    eligibility_verified: false,
    position_verified: false,
    outstanding_checked: false,
    repayment_finalized: false,
    prioritization_applied: false,
  });
  const [recommendation, setRecommendation] = useState('');
  const [notes, setNotes] = useState('');

  const hrQueue = loanRequests.filter(l => l.status === 'hr_review');
  const deferredLoans = loanRequests.filter(l => l.status === 'deferred');

  const handleDecision = async (decision: string) => {
    if (!selectedLoan) return;
    await onSubmitApproval(selectedLoan.id, 'hr_review', decision, {
      ...checklist,
      hr_recommendation: recommendation,
      notes,
    });
    setSelectedLoan(null);
    resetForm();
  };

  const resetForm = () => {
    setChecklist({ eligibility_verified: false, position_verified: false, outstanding_checked: false, repayment_finalized: false, prioritization_applied: false });
    setRecommendation('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold">{hrQueue.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Waiting List</p>
              <p className="text-2xl font-bold">{waitingList.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Deferred</p>
              <p className="text-2xl font-bold">{deferredLoans.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">HR Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {hrQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No loans pending HR review</p>
          ) : (
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
                {hrQueue.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm">{loan.employee_id?.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">${Number(loan.amount).toLocaleString()}</TableCell>
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
          )}
        </CardContent>
      </Card>

      {/* Waiting List */}
      {waitingList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Waiting List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan ID</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reconfirm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitingList.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-xs">{w.loan_request_id.substring(0, 8)}...</TableCell>
                    <TableCell><Badge>{w.priority_score}</Badge></TableCell>
                    <TableCell>{w.reason_type}</TableCell>
                    <TableCell><Badge variant="outline">{w.status}</Badge></TableCell>
                    <TableCell>{w.reconfirm_required ? <Badge variant="destructive">Needs Reconfirm</Badge> : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>HR Review</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Amount:</strong> ${Number(selectedLoan.amount).toLocaleString()}</p>
                <p><strong>Term:</strong> {selectedLoan.term_months} months</p>
                <p><strong>Position:</strong> {selectedLoan.position_level}</p>
                <p><strong>Reason Type:</strong> {selectedLoan.reason_type}</p>
                <p><strong>Prior Outstanding:</strong> {selectedLoan.has_prior_outstanding ? `Yes - $${selectedLoan.prior_outstanding_amount}` : 'No'}</p>
              </div>

              <LoanStatusTimeline currentStatus={selectedLoan.status} />

              <div className="space-y-2">
                <p className="text-sm font-medium">HR Checklist</p>
                {Object.entries(checklist).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox checked={val} onCheckedChange={(c) => setChecklist(prev => ({ ...prev, [key]: !!c }))} />
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium mb-1">HR Recommendation</p>
                <Textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Your recommendation..." />
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Notes</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleDecision('approved')} className="flex-1"><ThumbsUp className="h-4 w-4 mr-1" /> Recommend</Button>
                <Button variant="destructive" onClick={() => handleDecision('rejected')} className="flex-1"><ThumbsDown className="h-4 w-4 mr-1" /> Reject</Button>
                <Button variant="outline" onClick={() => handleDecision('deferred')}><Clock className="h-4 w-4 mr-1" /> Defer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
