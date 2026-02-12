import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { calculateEMI, generateAmortizationSchedule } from "@/lib/loanCalculations";

export function useLoans() {
  const { user, isAdmin, isVP } = useAuth();
  const [loanRequests, setLoanRequests] = useState<any[]>([]);
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [defaultEvents, setDefaultEvents] = useState<any[]>([]);
  const [loanRoles, setLoanRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);

  const isLoanOfficer = isAdmin || isVP || loanRoles.length > 0;
  const isHR = isAdmin || isVP || loanRoles.includes('hr_reviewer');
  const isFinance = isAdmin || isVP || loanRoles.includes('finance_reviewer');
  const isCEO = isVP || loanRoles.includes('ceo_approver');

  const fetchLoanRoles = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_officer_roles')
      .select('loan_role')
      .eq('user_id', user.id);
    if (data) setLoanRoles(data.map((r: any) => r.loan_role));
  }, [user]);

  const fetchEmployeeData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('employees')
      .select('*, profiles!employees_profile_id_fkey(user_id)')
      .eq('profiles.user_id', user.id)
      .limit(1);
    if (data && data.length > 0) setEmployeeData(data[0]);
  }, [user]);

  const fetchMyLoans = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMyLoans(data);
  }, [user]);

  const fetchAllLoanRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setLoanRequests(data);
  }, [user]);

  const fetchRepayments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_repayments')
      .select('*')
      .order('due_date', { ascending: true });
    if (data) setRepayments(data);
  }, [user]);

  const fetchApprovals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_approvals')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setApprovals(data);
  }, [user]);

  const fetchAgreements = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_agreements')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAgreements(data);
  }, [user]);

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_monthly_budgets')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (data) setBudgets(data);
  }, [user]);

  const fetchWaitingList = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_waiting_list')
      .select('*')
      .order('priority_score', { ascending: false });
    if (data) setWaitingList(data);
  }, [user]);

  const fetchAuditLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAuditLogs(data);
  }, [user]);

  const fetchDefaultEvents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('loan_default_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDefaultEvents(data);
  }, [user]);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchLoanRoles(),
      fetchEmployeeData(),
      fetchMyLoans(),
      fetchAllLoanRequests(),
      fetchRepayments(),
      fetchApprovals(),
      fetchAgreements(),
      fetchBudgets(),
      fetchWaitingList(),
      fetchAuditLogs(),
      fetchDefaultEvents(),
    ]);
    setLoading(false);
  }, [fetchLoanRoles, fetchEmployeeData, fetchMyLoans, fetchAllLoanRequests, fetchRepayments, fetchApprovals, fetchAgreements, fetchBudgets, fetchWaitingList, fetchAuditLogs, fetchDefaultEvents]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('loan-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_requests' }, () => { fetchMyLoans(); fetchAllLoanRequests(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_repayments' }, () => fetchRepayments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMyLoans, fetchAllLoanRequests, fetchRepayments]);

  const logAudit = async (loanRequestId: string | null, action: string, details?: any, documentAccessed?: string) => {
    if (!user) return;
    await supabase.from('loan_audit_logs').insert({
      loan_request_id: loanRequestId,
      user_id: user.id,
      action,
      details: details || {},
      document_accessed: documentAccessed || null,
    });
  };

  const createLoanRequest = async (data: {
    amount: number;
    term_months: number;
    reason_type: string;
    reason_details?: string;
    explanation?: string;
    supporting_doc_path?: string;
    has_prior_outstanding: boolean;
    prior_outstanding_amount: number;
    auto_deduction_consent: boolean;
    e_signature: string;
  }) => {
    if (!user || !employeeData) return null;

    const emi = calculateEMI(data.amount, 5, data.term_months);

    const { data: lr, error } = await supabase.from('loan_requests').insert({
      user_id: user.id,
      employee_id: employeeData.id,
      org_id: employeeData.org_id,
      amount: data.amount,
      term_months: data.term_months,
      interest_rate: 5,
      reason_type: data.reason_type,
      estimated_monthly_installment: emi,
      auto_deduction_consent: data.auto_deduction_consent,
      declaration_signed: true,
      e_signature: data.e_signature,
      signed_at: new Date().toISOString(),
      has_prior_outstanding: data.has_prior_outstanding,
      prior_outstanding_amount: data.prior_outstanding_amount,
      position_level: employeeData.position_level,
      max_eligible_amount: employeeData.position_level ? (
        { entry: 500, mid: 1500, senior: 2500, management: 2500 }[employeeData.position_level as string] ?? 500
      ) : 500,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    // Store confidential details separately
    if (lr) {
      await supabase.from('loan_request_confidential').insert({
        loan_request_id: lr.id,
        reason_details: data.reason_details,
        explanation: data.explanation,
        supporting_doc_path: data.supporting_doc_path,
      });

      await logAudit(lr.id, 'loan_submitted', { amount: data.amount, term: data.term_months });

      // Create HR review step
      await supabase.from('loan_requests').update({ status: 'hr_review' }).eq('id', lr.id);
    }

    toast({ title: "Loan Request Submitted", description: "Your request is now under HR review." });
    await refetchAll();
    return lr;
  };

  const updateLoanStatus = async (loanId: string, newStatus: string, notes?: string) => {
    if (!user) return;
    const { error } = await supabase.from('loan_requests')
      .update({ status: newStatus })
      .eq('id', loanId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await logAudit(loanId, `status_changed_to_${newStatus}`, { notes });
    toast({ title: "Status Updated", description: `Loan status changed to ${newStatus}` });
    await refetchAll();
  };

  const submitApproval = async (loanId: string, step: string, decision: string, data?: any) => {
    if (!user) return;
    const { error } = await supabase.from('loan_approvals').insert({
      loan_request_id: loanId,
      approval_step: step,
      reviewer_id: user.id,
      decision,
      ...data,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Progress workflow
    const nextStatus: Record<string, string> = {
      hr_review: decision === 'approved' ? 'finance_check' : decision,
      finance_check: decision === 'approved' ? 'ceo_review' : decision,
      ceo_review: decision === 'approved' ? 'approved' : decision,
    };
    if (nextStatus[step]) {
      await updateLoanStatus(loanId, nextStatus[step], data?.notes);
    }
  };

  const createAgreement = async (loanId: string, principal: number, termMonths: number) => {
    if (!user) return;
    const schedule = generateAmortizationSchedule(principal, 5, termMonths);
    const emi = calculateEMI(principal, 5, termMonths);
    const now = new Date();
    const firstDeductionMonth = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`;

    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 15);

    const { error } = await supabase.from('loan_agreements').insert({
      loan_request_id: loanId,
      principal,
      interest_rate: 5,
      term_months: termMonths,
      monthly_installment: emi,
      repayment_schedule: schedule as any,
      first_deduction_month: firstDeductionMonth,
      disbursement_sla_deadline: slaDeadline.toISOString().split('T')[0],
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await updateLoanStatus(loanId, 'agreement_signing');
    await logAudit(loanId, 'agreement_created', { principal, termMonths, emi });
  };

  const signAgreement = async (agreementId: string, signatureType: 'employee' | 'hr' | 'ceo', signature: string) => {
    if (!user) return;
    const updates: any = {};
    if (signatureType === 'employee') {
      updates.employee_signature = signature;
      updates.employee_signed_at = new Date().toISOString();
    } else if (signatureType === 'hr') {
      updates.hr_signature = signature;
      updates.hr_signed_at = new Date().toISOString();
    } else {
      updates.ceo_signature = signature;
      updates.ceo_signed_at = new Date().toISOString();
    }

    await supabase.from('loan_agreements').update(updates).eq('id', agreementId);
    await logAudit(null, `agreement_signed_by_${signatureType}`, { agreementId });
    toast({ title: "Agreement Signed", description: `${signatureType} signature recorded.` });
    await refetchAll();
  };

  const setBudget = async (year: number, month: number, totalBudget: number) => {
    if (!user) return;
    const orgId = employeeData?.org_id;
    const { error } = await supabase.from('loan_monthly_budgets').upsert({
      org_id: orgId,
      year,
      month,
      total_budget: totalBudget,
      set_by: user.id,
    }, { onConflict: 'org_id,year,month' });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Budget Set", description: `Budget for ${month}/${year} set to $${totalBudget}` });
    await refetchAll();
  };

  const createRepaymentSchedule = async (loanId: string, agreementId: string, employeeId: string, userId: string, schedule: any[]) => {
    const rows = schedule.map((row: any, i: number) => {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return {
        loan_request_id: loanId,
        agreement_id: agreementId,
        employee_id: employeeId,
        user_id: userId,
        month_number: row.month,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: row.principal,
        interest_amount: row.interest,
        total_amount: row.emi,
        remaining_balance: row.closingBalance,
        status: 'pending',
      };
    });

    const { error } = await supabase.from('loan_repayments').insert(rows);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    await refetchAll();
  };

  const exportPayrollDeductions = (month?: number, year?: number) => {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    const pending = repayments.filter(r => {
      const d = new Date(r.due_date);
      return d.getMonth() + 1 === m && d.getFullYear() === y && r.status === 'pending';
    });

    const headers = ['employee_id', 'deduction_amount', 'month', 'remaining_balance'];
    const rows = pending.map(r => [r.employee_id, r.total_amount, `${y}-${String(m).padStart(2, '0')}`, r.remaining_balance].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-deductions-${y}-${String(m).padStart(2, '0')}.csv`;
    a.click();
    toast({ title: "Export Complete", description: "Payroll deductions exported." });
  };

  return {
    myLoans, loanRequests, repayments, approvals, agreements, budgets,
    waitingList, auditLogs, defaultEvents, loading, employeeData,
    loanRoles, isLoanOfficer, isHR, isFinance, isCEO,
    createLoanRequest, updateLoanStatus, submitApproval,
    createAgreement, signAgreement, setBudget,
    createRepaymentSchedule, exportPayrollDeductions,
    logAudit, refetchAll,
  };
}
