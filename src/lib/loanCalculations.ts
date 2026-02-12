// Loan calculation utilities - 5% annual interest, reducing balance amortization

export const ANNUAL_INTEREST_RATE = 5;
export const MAX_TERM_MONTHS = 6;

export const POSITION_CAPS: Record<string, { min: number; max: number }> = {
  entry: { min: 0, max: 500 },
  mid: { min: 500, max: 1500 },
  senior: { min: 1500, max: 2500 },
  management: { min: 1500, max: 2500 },
};

export const LOAN_STATUSES = [
  'draft', 'submitted', 'hr_review', 'finance_check', 'ceo_review',
  'approved', 'rejected', 'deferred', 'agreement_signing', 'disbursed', 'repaying', 'closed',
] as const;

export type LoanStatus = typeof LOAN_STATUSES[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  hr_review: 'HR Review',
  finance_check: 'Finance Check',
  ceo_review: 'CEO Review',
  approved: 'Approved',
  rejected: 'Rejected',
  deferred: 'Deferred',
  agreement_signing: 'Agreement Signing',
  disbursed: 'Disbursed',
  repaying: 'Repaying',
  closed: 'Closed',
};

export interface AmortizationRow {
  month: number;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

export function calculateEMI(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(emi * 100) / 100;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
): AmortizationRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const emi = calculateEMI(principal, annualRate, termMonths);
  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const interest = Math.round(balance * monthlyRate * 100) / 100;
    const principalPart = i === termMonths ? balance : Math.round((emi - interest) * 100) / 100;
    const closingBalance = Math.max(0, Math.round((balance - principalPart) * 100) / 100);

    schedule.push({
      month: i,
      openingBalance: Math.round(balance * 100) / 100,
      emi: i === termMonths ? Math.round((principalPart + interest) * 100) / 100 : emi,
      principal: principalPart,
      interest,
      closingBalance,
    });

    balance = closingBalance;
  }

  return schedule;
}

export function getTotalInterest(schedule: AmortizationRow[]): number {
  return Math.round(schedule.reduce((sum, row) => sum + row.interest, 0) * 100) / 100;
}

export function getTotalPayment(schedule: AmortizationRow[]): number {
  return Math.round(schedule.reduce((sum, row) => sum + row.emi, 0) * 100) / 100;
}

export function getMaxLoanAmount(positionLevel: string): number {
  return POSITION_CAPS[positionLevel]?.max ?? 500;
}

export function getMinLoanAmount(positionLevel: string): number {
  return POSITION_CAPS[positionLevel]?.min ?? 0;
}

export function checkEligibility(employee: {
  employment_type?: string;
  probation_completed?: boolean;
  position_level?: string;
  status?: string;
}): { eligible: boolean; reasons: string[]; maxAmount: number } {
  const reasons: string[] = [];

  if (employee.employment_type !== 'full_time') {
    reasons.push('Must be a full-time employee');
  }
  if (!employee.probation_completed) {
    reasons.push('Probation period must be completed');
  }
  if (employee.status !== 'active') {
    reasons.push('Employee must be active');
  }

  const maxAmount = getMaxLoanAmount(employee.position_level || 'entry');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAmount,
  };
}

export function computeSeparationPayoff(
  outstandingBalance: number,
  annualRate: number,
  separationDate: Date,
  lastPaymentDate: Date,
): { totalDue: number; accruedInterest: number } {
  const daysDiff = Math.max(0, (separationDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = annualRate / 100 / 365;
  const accruedInterest = Math.round(outstandingBalance * dailyRate * daysDiff * 100) / 100;
  return {
    totalDue: Math.round((outstandingBalance + accruedInterest) * 100) / 100,
    accruedInterest,
  };
}
