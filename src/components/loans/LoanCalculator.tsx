import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { calculateEMI, generateAmortizationSchedule, getTotalInterest, getTotalPayment, ANNUAL_INTEREST_RATE } from "@/lib/loanCalculations";

interface LoanCalculatorProps {
  maxAmount?: number;
  defaultAmount?: number;
  defaultTerm?: number;
  onValuesChange?: (amount: number, term: number, emi: number) => void;
}

export function LoanCalculator({ maxAmount = 2500, defaultAmount, defaultTerm, onValuesChange }: LoanCalculatorProps) {
  const [amount, setAmount] = useState(defaultAmount || 500);
  const [term, setTerm] = useState(defaultTerm || 3);

  const emi = calculateEMI(amount, ANNUAL_INTEREST_RATE, term);
  const schedule = generateAmortizationSchedule(amount, ANNUAL_INTEREST_RATE, term);
  const totalInterest = getTotalInterest(schedule);
  const totalPayment = getTotalPayment(schedule);

  const handleAmountChange = (val: number) => {
    const clamped = Math.min(Math.max(0, val), maxAmount);
    setAmount(clamped);
    onValuesChange?.(clamped, term, calculateEMI(clamped, ANNUAL_INTEREST_RATE, term));
  };

  const handleTermChange = (val: string) => {
    const t = parseInt(val);
    setTerm(t);
    onValuesChange?.(amount, t, calculateEMI(amount, ANNUAL_INTEREST_RATE, t));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          Loan Calculator
          <Badge variant="outline" className="ml-auto text-xs">5% p.a. · Reducing Balance</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Amount ($)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
              max={maxAmount}
              min={0}
            />
            <p className="text-xs text-muted-foreground mt-1">Max: ${maxAmount.toLocaleString()}</p>
          </div>
          <div>
            <Label>Term (months)</Label>
            <Select value={String(term)} onValueChange={handleTermChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6].map(m => (
                  <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Monthly EMI</p>
            <p className="text-lg font-bold text-primary">${emi.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Interest</p>
            <p className="text-lg font-bold">${totalInterest.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Payment</p>
            <p className="text-lg font-bold">${totalPayment.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Estimated Amortization Schedule</p>
          <p className="text-xs text-muted-foreground mb-2 italic">Final schedule confirmed by HR/Finance</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Month</TableHead>
                <TableHead className="text-xs">Opening</TableHead>
                <TableHead className="text-xs">EMI</TableHead>
                <TableHead className="text-xs">Principal</TableHead>
                <TableHead className="text-xs">Interest</TableHead>
                <TableHead className="text-xs">Closing</TableHead>
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
