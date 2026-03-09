import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanPolicy, FIXED_ANNUAL_RATE, calculateEMI, generateAmortizationSchedule, getTotalInterest, getTotalPayment } from "@/lib/loanCalculations";
import { AlertTriangle, CheckCircle2, Shield, Calculator } from "lucide-react";

interface LoanRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeData: any;
  loanPolicy: LoanPolicy | null;
  onSubmit: (data: any) => Promise<any>;
}

export function LoanRequestForm({ open, onOpenChange, employeeData, loanPolicy, onSubmit }: LoanRequestFormProps) {
  const [amount, setAmount] = useState(0);
  const [termMonths, setTermMonths] = useState(0);
  const [reasonType, setReasonType] = useState('general');
  const [reasonDetails, setReasonDetails] = useState('');
  const [autoDeductionConsent, setAutoDeductionConsent] = useState(false);
  const [eSignature, setESignature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!employeeData) return null;

  const hasPolicy = !!loanPolicy;
  const allowedTerms = Array.from({ length: 24 }, (_, i) => i + 1);

  const canSubmit = hasPolicy && amount > 0 &&
    (termMonths === 0 || termMonths <= 24) &&
    autoDeductionConsent && eSignature.trim().length > 0;

  // EMI preview calculation
  const emiPreview = useMemo(() => {
    if (amount <= 0 || termMonths <= 0) return null;
    const emi = calculateEMI(amount, FIXED_ANNUAL_RATE, termMonths);
    const schedule = generateAmortizationSchedule(amount, FIXED_ANNUAL_RATE, termMonths);
    const totalInterest = getTotalInterest(schedule);
    const totalPayment = getTotalPayment(schedule);
    return { emi, schedule, totalInterest, totalPayment };
  }, [amount, termMonths]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      amount,
      term_months: termMonths || null,
      reason_type: reasonType,
      reason_details: reasonDetails,
      auto_deduction_consent: autoDeductionConsent,
      e_signature: eSignature,
    });
    setSubmitting(false);
    onOpenChange(false);
    // Reset form
    setAmount(0);
    setTermMonths(0);
    setReasonType('general');
    setReasonDetails('');
    setAutoDeductionConsent(false);
    setESignature('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Loan</DialogTitle>
          <DialogDescription>Submit a loan request for manager approval</DialogDescription>
        </DialogHeader>

        {!hasPolicy ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No loan policy found for your position level ({employeeData.position_level || 'not set'}). Contact HR.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Auto-filled employee info */}
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p><strong>Name:</strong> {employeeData.first_name} {employeeData.last_name}</p>
              <p><strong>Employee ID:</strong> {employeeData.employee_id || 'N/A'}</p>
              <p><strong>Department:</strong> {employeeData.department || 'N/A'}</p>
              <p><strong>Position Level:</strong> {employeeData.position_level || 'N/A'}</p>
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Interest: {FIXED_ANNUAL_RATE}% p.a. (fixed) · 
                Term: optional, up to 24 months
              </AlertDescription>
            </Alert>

            <div>
              <Label>Loan Amount (NPR)</Label>
              <Input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min={0}
                placeholder="Enter loan amount in NPR"
              />
            </div>

            <div>
              <Label>Term (months) <span className="text-muted-foreground text-xs">— optional</span></Label>
              <Select value={termMonths ? String(termMonths) : ''} onValueChange={(v) => setTermMonths(v ? parseInt(v) : 0)}>
                <SelectTrigger><SelectValue placeholder="Select term (optional)" /></SelectTrigger>
                <SelectContent>
                  {allowedTerms.map(m => (
                    <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason Type</Label>
              <Select value={reasonType} onValueChange={setReasonType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason Details</Label>
              <Textarea
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Brief description of loan purpose..."
                rows={2}
              />
            </div>

            {/* EMI Preview */}
            {emiPreview && (
              <div className="space-y-3 border rounded-lg p-3">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Calculator className="h-4 w-4" /> Repayment Preview
                  <Badge variant="outline" className="ml-auto text-xs">{FIXED_ANNUAL_RATE}% p.a. · Reducing Balance</Badge>
                </p>
                <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded-md text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly EMI</p>
                    <p className="text-sm font-bold text-primary">NPR {emiPreview.emi.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Interest</p>
                    <p className="text-sm font-bold">NPR {emiPreview.totalInterest.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Payment</p>
                    <p className="text-sm font-bold">NPR {emiPreview.totalPayment.toFixed(2)}</p>
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View amortization schedule
                  </summary>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs p-1">Month</TableHead>
                        <TableHead className="text-xs p-1">EMI</TableHead>
                        <TableHead className="text-xs p-1">Principal</TableHead>
                        <TableHead className="text-xs p-1">Interest</TableHead>
                        <TableHead className="text-xs p-1">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emiPreview.schedule.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell className="text-xs p-1">{row.month}</TableCell>
                          <TableCell className="text-xs p-1">NPR {row.emi.toFixed(2)}</TableCell>
                          <TableCell className="text-xs p-1">NPR {row.principal.toFixed(2)}</TableCell>
                          <TableCell className="text-xs p-1">NPR {row.interest.toFixed(2)}</TableCell>
                          <TableCell className="text-xs p-1">NPR {row.closingBalance.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </div>
            )}

            <div className="space-y-3 p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox checked={autoDeductionConsent} onCheckedChange={(c) => setAutoDeductionConsent(!!c)} id="consent" />
                <label htmlFor="consent" className="text-sm">I authorize automatic payroll deduction for loan repayment</label>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Shield className="h-3 w-3" /> E-Signature (type your full name)</Label>
                <Input value={eSignature} onChange={(e) => setESignature(e.target.value)} placeholder="Your full legal name" />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Loan Request'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
