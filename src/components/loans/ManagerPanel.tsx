import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoanStatusTimeline } from "./LoanStatusTimeline";
import { SIMPLIFIED_STATUS_LABELS } from "@/lib/loanCalculations";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";

interface ManagerPanelProps {
  pendingRequests: any[];
  history: any[];
  onDecision: (loanId: string, decision: 'approved' | 'rejected', comment: string) => Promise<void>;
}

export function ManagerPanel({ pendingRequests, history, onDecision }: ManagerPanelProps) {
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
    <Tabs defaultValue="pending">
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
                      <TableCell>${Number(loan.amount).toLocaleString()}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Loan Request</DialogTitle>
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
                <p className="text-sm font-medium mb-1">Comment <span className="text-destructive">*</span></p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Mandatory comment for your decision..."
                />
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
    </Tabs>
  );
}
