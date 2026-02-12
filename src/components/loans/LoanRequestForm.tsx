import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoanCalculator } from "./LoanCalculator";
import { checkEligibility, getMaxLoanAmount, getMinLoanAmount } from "@/lib/loanCalculations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, AlertTriangle, CheckCircle2, Shield } from "lucide-react";

interface LoanRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeData: any;
  onSubmit: (data: any) => Promise<any>;
}

export function LoanRequestForm({ open, onOpenChange, employeeData, onSubmit }: LoanRequestFormProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(0);
  const [termMonths, setTermMonths] = useState(3);
  const [reasonType, setReasonType] = useState('general');
  const [reasonDetails, setReasonDetails] = useState('');
  const [explanation, setExplanation] = useState('');
  const [hasPriorOutstanding, setHasPriorOutstanding] = useState(false);
  const [priorAmount, setPriorAmount] = useState(0);
  const [autoDeductionConsent, setAutoDeductionConsent] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [eSignature, setESignature] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emi, setEmi] = useState(0);

  if (!employeeData) return null;

  const eligibility = checkEligibility(employeeData);
  const maxAmount = eligibility.maxAmount;
  const minAmount = getMinLoanAmount(employeeData.position_level || 'entry');

  const canSubmit = eligibility.eligible && amount > 0 && amount <= maxAmount && amount >= minAmount &&
    termMonths >= 1 && termMonths <= 6 && autoDeductionConsent && declaration && eSignature.trim() &&
    (reasonType !== 'medical' || docFile || reasonDetails);

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);

    let docPath: string | undefined;
    if (docFile) {
      setUploading(true);
      const filePath = `${user.id}/${Date.now()}-${docFile.name}`;
      const { error } = await supabase.storage.from('loan-documents').upload(filePath, docFile);
      if (!error) docPath = filePath;
      setUploading(false);
    }

    await onSubmit({
      amount,
      term_months: termMonths,
      reason_type: reasonType,
      reason_details: reasonDetails,
      explanation,
      supporting_doc_path: docPath,
      has_prior_outstanding: hasPriorOutstanding,
      prior_outstanding_amount: priorAmount,
      auto_deduction_consent: autoDeductionConsent,
      e_signature: eSignature,
    });

    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Employee Loan</DialogTitle>
        </DialogHeader>

        {/* Eligibility Check */}
        {!eligibility.eligible ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Not Eligible:</strong>
              <ul className="list-disc ml-4 mt-1">
                {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <strong>Eligible</strong> · Max loan: <Badge variant="secondary">${maxAmount.toLocaleString()}</Badge> · Position: {employeeData.position_level || 'entry'}
            </AlertDescription>
          </Alert>
        )}

        {eligibility.eligible && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Employee:</strong> {employeeData.first_name} {employeeData.last_name}</p>
                <p><strong>ID:</strong> {employeeData.employee_id || 'N/A'}</p>
                <p><strong>Department:</strong> {employeeData.department || 'N/A'}</p>
                <p><strong>Position Level:</strong> {employeeData.position_level || 'entry'}</p>
              </div>

              <div>
                <Label>Loan Amount ($)</Label>
                <Input type="number" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} min={minAmount} max={maxAmount} />
                {amount > maxAmount && <p className="text-xs text-destructive mt-1">Exceeds maximum ${maxAmount}</p>}
                {amount > 0 && amount < minAmount && <p className="text-xs text-destructive mt-1">Minimum ${minAmount}</p>}
              </div>

              <div>
                <Label>Reason Type</Label>
                <Select value={reasonType} onValueChange={setReasonType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">Medical (requires documentation)</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason Details <span className="text-xs text-muted-foreground">(confidential - HR/Finance/CEO only)</span></Label>
                <Textarea value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} placeholder="Explain the reason for your loan request..." />
              </div>

              {reasonType === 'medical' && (
                <div>
                  <Label>Supporting Documents</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Medical documentation required</p>
                </div>
              )}

              <div>
                <Label>Term (months)</Label>
                <Select value={String(termMonths)} onValueChange={(v) => setTermMonths(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6].map(m => <SelectItem key={m} value={String(m)}>{m} month{m>1?'s':''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prior Loan Outstanding?</Label>
                <div className="flex items-center gap-2">
                  <Checkbox checked={hasPriorOutstanding} onCheckedChange={(c) => setHasPriorOutstanding(!!c)} />
                  <span className="text-sm">Yes, I have an outstanding loan</span>
                </div>
                {hasPriorOutstanding && (
                  <Input type="number" value={priorAmount || ''} onChange={(e) => setPriorAmount(parseFloat(e.target.value) || 0)} placeholder="Outstanding amount ($)" />
                )}
              </div>

              <div className="space-y-3 p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox checked={autoDeductionConsent} onCheckedChange={(c) => setAutoDeductionConsent(!!c)} id="consent" />
                  <label htmlFor="consent" className="text-sm">I authorize automatic payroll deduction for loan repayment</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={declaration} onCheckedChange={(c) => setDeclaration(!!c)} id="declaration" />
                  <label htmlFor="declaration" className="text-sm">I declare all information provided is accurate and complete</label>
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

            {/* Calculator */}
            <div>
              <LoanCalculator
                maxAmount={maxAmount}
                defaultAmount={amount || 500}
                defaultTerm={termMonths}
                onValuesChange={(a, t, e) => { setAmount(a); setTermMonths(t); setEmi(e); }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
