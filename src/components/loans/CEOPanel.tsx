import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { Crown, ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";

interface CEOPanelProps {
  loanRequests: any[];
  approvals: any[];
  onSubmitApproval: (loanId: string, step: string, decision: string, data?: any) => Promise<void>;
  onCreateAgreement: (loanId: string, principal: number, termMonths: number) => Promise<void>;
}

export function CEOPanel({ loanRequests, approvals, onSubmitApproval, onCreateAgreement }: CEOPanelProps) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  const ceoQueue = loanRequests.filter(l => l.status === 'ceo_review');
  const approvedLoans = loanRequests.filter(l => l.status === 'approved');

  const getApprovals = (loanId: string) => approvals.filter(a => a.loan_request_id === loanId);

  const handleDecision = async (decision: string) => {
    if (!selectedLoan) return;
    await onSubmitApproval(selectedLoan.id, 'ceo_review', decision, {
      ceo_decision_notes: decisionNotes,
      notes: decisionNotes,
    });

    if (decision === 'approved') {
      await onCreateAgreement(selectedLoan.id, Number(selectedLoan.amount), selectedLoan.term_months);
    }

    setSelectedLoan(null);
    setDecisionNotes('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Awaiting CEO Decision</p>
            <p className="text-2xl font-bold">{ceoQueue.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CEO Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {ceoQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No loans pending CEO approval</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>HR/Finance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ceoQueue.map((loan) => {
                  const loanApprovals = getApprovals(loan.id);
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">${Number(loan.amount).toLocaleString()}</TableCell>
                      <TableCell>{loan.term_months}mo</TableCell>
                      <TableCell><Badge variant="outline">{loan.reason_type}</Badge></TableCell>
                      <TableCell>
                        {loanApprovals.map((a, i) => (
                          <Badge key={i} variant={a.decision === 'approved' ? 'default' : 'destructive'} className="mr-1 text-xs">
                            {a.approval_step}: {a.decision}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setSelectedLoan(loan)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recently Approved */}
      {approvedLoans.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recently Approved</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedLoans.slice(0, 5).map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell>${Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell><Badge>Approved</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setDecisionNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CEO Final Decision</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Amount:</strong> ${Number(selectedLoan.amount).toLocaleString()}</p>
                <p><strong>Term:</strong> {selectedLoan.term_months} months</p>
                <p><strong>EMI:</strong> ${Number(selectedLoan.estimated_monthly_installment || 0).toFixed(2)}/mo</p>
                <p><strong>Position:</strong> {selectedLoan.position_level}</p>
              </div>

              <LoanStatusTimeline currentStatus={selectedLoan.status} />

              <div>
                <p className="text-sm font-medium mb-1">Prior Approvals</p>
                {getApprovals(selectedLoan.id).map((a: any, i: number) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded mb-1">
                    <strong>{a.approval_step}:</strong> {a.decision} — {a.notes || 'No notes'}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Decision Notes</p>
                <Textarea value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} placeholder="Your decision rationale..." />
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
