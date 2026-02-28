import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Languages } from "lucide-react";
import { calculateEMI, generateAmortizationSchedule, getTotalInterest, getTotalPayment } from "@/lib/loanCalculations";

const LABELS_EN = {
  title: "Loan Calculator",
  amount: "Amount ($)",
  term: "Term (months)",
  monthlyEMI: "Monthly EMI",
  totalInterest: "Total Interest",
  totalPayment: "Total Payment",
  schedule: "Estimated Amortization Schedule",
  scheduleNote: "Final schedule confirmed by HR/Finance",
  month: "Month",
  opening: "Opening",
  emi: "EMI",
  principal: "Principal",
  interest: "Interest",
  closing: "Closing",
  max: "Max",
  interestBadge: "Reducing Balance",
  months: "months",
};

const LABELS_NP = {
  title: "ऋण क्याल्कुलेटर",
  amount: "रकम ($)",
  term: "अवधि (महिना)",
  monthlyEMI: "मासिक किस्ता",
  totalInterest: "कुल ब्याज",
  totalPayment: "कुल भुक्तानी",
  schedule: "अनुमानित ऋण तालिका",
  scheduleNote: "अन्तिम तालिका HR/Finance बाट पुष्टि हुन्छ",
  month: "महिना",
  opening: "सुरुको बाँकी",
  emi: "किस्ता",
  principal: "सावाँ",
  interest: "ब्याज",
  closing: "अन्तिम बाँकी",
  max: "अधिकतम",
  interestBadge: "घट्दो शेषमा",
  months: "महिना",
};

interface LoanCalculatorProps {
  maxAmount?: number;
  interestRate?: number;
  allowedTerms?: number[];
}

export function LoanCalculator({ maxAmount = 2500, interestRate = 5, allowedTerms }: LoanCalculatorProps) {
  const [amount, setAmount] = useState(500);
  const [term, setTerm] = useState(3);
  const [lang, setLang] = useState<'en' | 'np'>('en');

  const L = lang === 'np' ? LABELS_NP : LABELS_EN;
  const terms = allowedTerms || [1, 2, 3, 4, 5, 6];

  const emi = calculateEMI(amount, interestRate, term);
  const schedule = generateAmortizationSchedule(amount, interestRate, term);
  const totalInterest = getTotalInterest(schedule);
  const totalPayment = getTotalPayment(schedule);

  const handleAmountChange = (val: number) => {
    setAmount(Math.min(Math.max(0, val), maxAmount));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          {L.title}
          <Badge variant="outline" className="ml-auto text-xs">{interestRate}% p.a. · {L.interestBadge}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(l => l === 'en' ? 'np' : 'en')}
            className="ml-1"
          >
            <Languages className="h-4 w-4 mr-1" />
            {lang === 'en' ? 'NP' : 'EN'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{L.amount}</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
              max={maxAmount}
              min={0}
            />
            <p className="text-xs text-muted-foreground mt-1">{L.max}: ${maxAmount.toLocaleString()}</p>
          </div>
          <div>
            <Label>{L.term}</Label>
            <Select value={String(term)} onValueChange={(v) => setTerm(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {terms.map(m => (
                  <SelectItem key={m} value={String(m)}>{m} {L.months}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{L.monthlyEMI}</p>
            <p className="text-lg font-bold text-primary">${emi.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{L.totalInterest}</p>
            <p className="text-lg font-bold">${totalInterest.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{L.totalPayment}</p>
            <p className="text-lg font-bold">${totalPayment.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">{L.schedule}</p>
          <p className="text-xs text-muted-foreground mb-2 italic">{L.scheduleNote}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{L.month}</TableHead>
                <TableHead className="text-xs">{L.opening}</TableHead>
                <TableHead className="text-xs">{L.emi}</TableHead>
                <TableHead className="text-xs">{L.principal}</TableHead>
                <TableHead className="text-xs">{L.interest}</TableHead>
                <TableHead className="text-xs">{L.closing}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="text-xs">{row.month}</TableCell>
                  <TableCell className="text-xs">${row.openingBalance.toFixed(2)}</TableCell>
                  <TableCell className="text-xs font-medium">${row.emi.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">${row.principal.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">${row.interest.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">${row.closingBalance.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
