import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoanPolicy } from "@/lib/loanCalculations";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";

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
  const maxAmount = loanPolicy?.max_loan ?? 0;
  const allowedTerms = loanPolicy?.allowed_terms ?? [];

  const canSubmit = hasPolicy && amount > 0 && amount <= maxAmount &&
    termMonths > 0 && allowedTerms.includes(termMonths) &&
    autoDeductionConsent && eSignature.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      amount,
      term_months: termMonths,
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
                Max loan: <Badge variant="secondary">${maxAmount.toLocaleString()}</Badge> · 
                Interest: {loanPolicy.interest_rate}% p.a. · 
                Terms: {allowedTerms.join(', ')} months
              </AlertDescription>
            </Alert>

            <div>
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                max={maxAmount}
                min={0}
              />
              {amount > maxAmount && <p className="text-xs text-destructive mt-1">Exceeds max ${maxAmount}</p>}
            </div>

            <div>
              <Label>Term (months)</Label>
              <Select value={termMonths ? String(termMonths) : ''} onValueChange={(v) => setTermMonths(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
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
