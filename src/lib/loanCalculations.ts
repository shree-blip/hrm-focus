// Loan calculation utilities - dynamic interest from policy, reducing balance amortization

export const SIMPLIFIED_STATUSES = [
  "draft",
  "pending_manager",
  "pending_vp",
  "approved",
  "rejected",
  "disbursed",
] as const;

export type SimplifiedLoanStatus = (typeof SIMPLIFIED_STATUSES)[number];

export const SIMPLIFIED_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_manager: "Pending Manager",
  pending_vp: "Pending VP",
  approved: "Approved",
  rejected: "Rejected",
  disbursed: "Disbursed",
};

export interface LoanPolicy {
  id: string;
  position_level: string;
  max_loan: number;
  allowed_terms: number[];
  interest_rate: number;
  min_tenure_months: number;
  allow_if_existing_loan: boolean;
}

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
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
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
