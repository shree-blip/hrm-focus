import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { calculateEMI, LoanPolicy } from "@/lib/loanCalculations";

export function useLoans() {
  const { user, isAdmin, isVP, isLineManager } = useAuth();
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [pendingForManager, setPendingForManager] = useState<any[]>([]);
  const [managerHistory, setManagerHistory] = useState<any[]>([]);
  const [vpQueue, setVpQueue] = useState<any[]>([]);
  const [vpHistory, setVpHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loanPolicy, setLoanPolicy] = useState<LoanPolicy | null>(null);

  const fetchEmployeeData = useCallback(async () => {
    if (!user) return;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profileData) return;

    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('profile_id', profileData.id)
      .maybeSingle();
    
    if (data) {
      setEmployeeData(data);
      if (data.position_level) {
        const { data: policy } = await supabase
          .from('loan_policies')
          .select('*')
          .eq('position_level', data.position_level)
          .maybeSingle();
        if (policy) {
          setLoanPolicy({
            ...policy,
            max_loan: Number(policy.max_loan),
            interest_rate: Number(policy.interest_rate),
            allowed_terms: policy.allowed_terms as number[],
          });
        }
      }
    }
  }, [user]);

  const fetchMyLoans = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('loan_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching my loans:', error.message);
      return;
    }
    if (data) setMyLoans(data);
  }, [user]);

  // Manager sees loans routed to them via manager_user_id
  const fetchManagerQueue = useCallback(async () => {
    if (!user || !isLineManager) return;

    const { data: pending, error: pendingErr } = await supabase
      .from('loan_requests')
      .select('*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)')
      .eq('manager_user_id', user.id)
      .eq('status', 'pending_manager')
      .order('created_at', { ascending: false });
    if (pendingErr) console.error('Error fetching manager pending:', pendingErr.message);
    if (pending) setPendingForManager(pending);

    const { data: history, error: histErr } = await supabase
      .from('loan_requests')
      .select('*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)')
      .eq('manager_user_id', user.id)
      .neq('status', 'pending_manager')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (histErr) console.error('Error fetching manager history:', histErr.message);
    if (history) setManagerHistory(history);
  }, [user, isLineManager]);

  // VP sees loans routed to them via vp_user_id
  const fetchVPQueue = useCallback(async () => {
    if (!user || !isVP) return;

    const { data: pending, error: vpPendErr } = await supabase
      .from('loan_requests')
      .select('*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)')
      .eq('vp_user_id', user.id)
      .eq('status', 'pending_vp')
      .order('created_at', { ascending: false });
    if (vpPendErr) console.error('Error fetching VP queue:', vpPendErr.message);
    if (pending) setVpQueue(pending);

    const { data: history, error: vpHistErr } = await supabase
      .from('loan_requests')
      .select('*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)')
      .eq('vp_user_id', user.id)
      .in('status', ['approved', 'rejected', 'disbursed'])
      .order('created_at', { ascending: false });
    if (vpHistErr) console.error('Error fetching VP history:', vpHistErr.message);
    if (history) setVpHistory(history);
  }, [user, isVP]);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchEmployeeData(),
      fetchMyLoans(),
      fetchManagerQueue(),
      fetchVPQueue(),
    ]);
    setLoading(false);
  }, [fetchEmployeeData, fetchMyLoans, fetchManagerQueue, fetchVPQueue]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('loan-changes-simplified')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_requests' }, () => {
        fetchMyLoans();
        fetchManagerQueue();
        fetchVPQueue();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMyLoans, fetchManagerQueue, fetchVPQueue]);

  const logAudit = async (loanRequestId: string | null, action: string, details?: any) => {
    if (!user) return;
    await supabase.from('loan_audit_logs').insert({
      loan_request_id: loanRequestId,
      user_id: user.id,
      action,
      details: details || {},
    });
  };

  // Resolve manager_user_id and vp_user_id from the employee's team structure
  const resolveApprovers = async (empData: any) => {
    let managerUserId: string | null = null;
    let vpUserId: string | null = null;

    // Get line manager's user_id
    if (empData.line_manager_id) {
      const { data: mgrEmp } = await supabase
        .from('employees')
        .select('profile_id')
        .eq('id', empData.line_manager_id)
        .maybeSingle();
      if (mgrEmp?.profile_id) {
        const { data: mgrProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', mgrEmp.profile_id)
          .maybeSingle();
        if (mgrProfile) managerUserId = mgrProfile.user_id;
      }
    } else if (empData.manager_id) {
      // Fallback to manager_id if no line_manager_id
      const { data: mgrEmp } = await supabase
        .from('employees')
        .select('profile_id')
        .eq('id', empData.manager_id)
        .maybeSingle();
      if (mgrEmp?.profile_id) {
        const { data: mgrProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', mgrEmp.profile_id)
          .maybeSingle();
        if (mgrProfile) managerUserId = mgrProfile.user_id;
      }
    }

    // Get VP user_id from user_roles
    const { data: vpRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'vp')
      .limit(1)
      .maybeSingle();
    if (vpRole) vpUserId = vpRole.user_id;

    return { managerUserId, vpUserId };
  };

  const createLoanRequest = async (data: {
    amount: number;
    term_months: number;
    reason_type: string;
    reason_details?: string;
    auto_deduction_consent: boolean;
    e_signature: string;
  }) => {
    if (!user || !employeeData || !loanPolicy) return null;

    const emi = calculateEMI(data.amount, loanPolicy.interest_rate, data.term_months);
    const { managerUserId, vpUserId } = await resolveApprovers(employeeData);

    if (!managerUserId) {
      toast({ title: "Error", description: "No Line Manager assigned. Please contact HR.", variant: "destructive" });
      return null;
    }

    const { data: lr, error } = await supabase.from('loan_requests').insert({
      user_id: user.id,
      employee_id: employeeData.id,
      org_id: employeeData.org_id,
      amount: data.amount,
      term_months: data.term_months,
      interest_rate: loanPolicy.interest_rate,
      reason_type: data.reason_type,
      estimated_monthly_installment: emi,
      auto_deduction_consent: data.auto_deduction_consent,
      declaration_signed: true,
      e_signature: data.e_signature,
      signed_at: new Date().toISOString(),
      position_level: employeeData.position_level,
      max_eligible_amount: loanPolicy.max_loan,
      status: 'pending_manager',
      submitted_at: new Date().toISOString(),
      manager_user_id: managerUserId,
      vp_user_id: vpUserId,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    if (lr && data.reason_details) {
      await supabase.from('loan_request_confidential').insert({
        loan_request_id: lr.id,
        reason_details: data.reason_details,
      });
    }

    if (lr) {
      await logAudit(lr.id, 'loan_submitted', { amount: data.amount, term: data.term_months });
    }

    toast({ title: "Loan Request Submitted", description: "Your request has been sent to your Line Manager." });
    await refetchAll();
    return lr;
  };

  const managerDecision = async (loanId: string, decision: 'approved' | 'rejected', comment: string) => {
    if (!user) return;
    const newStatus = decision === 'approved' ? 'pending_vp' : 'rejected';

    const updates: any = { status: newStatus, manager_comment: comment, manager_approved_at: new Date().toISOString() };

    const { error } = await supabase.from('loan_requests')
      .update(updates)
      .eq('id', loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from('loan_approvals').insert({
      loan_request_id: loanId,
      approval_step: 'manager_review',
      reviewer_id: user.id,
      decision,
      notes: comment,
    });

    await logAudit(loanId, `manager_${decision}`, { comment });
    toast({ title: decision === 'approved' ? "Forwarded to VP" : "Loan Rejected", description: comment });
    await refetchAll();
  };

  const vpDecision = async (loanId: string, decision: 'approved' | 'rejected', comment: string, disbursementDate?: string, autoPayroll?: boolean) => {
    if (!user) return;
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    const updates: any = { status: newStatus };
    if (decision === 'approved' && autoPayroll !== undefined) {
      updates.auto_deduction_consent = autoPayroll;
    }

    const { error } = await supabase.from('loan_requests')
      .update(updates)
      .eq('id', loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from('loan_approvals').insert({
      loan_request_id: loanId,
      approval_step: 'vp_review',
      reviewer_id: user.id,
      decision,
      notes: comment,
    });

    await logAudit(loanId, `vp_${decision}`, { comment, disbursementDate, autoPayroll });
    toast({ title: decision === 'approved' ? "Loan Approved" : "Loan Rejected", description: comment });
    await refetchAll();
  };

  const disburseLoan = async (loanId: string, disbursementDate: string) => {
    if (!user) return;
    const { error } = await supabase.from('loan_requests')
      .update({ status: 'disbursed' })
      .eq('id', loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await logAudit(loanId, 'loan_disbursed', { disbursementDate });
    toast({ title: "Loan Disbursed" });
    await refetchAll();
  };

  return {
    myLoans, loading, employeeData, loanPolicy,
    pendingForManager, managerHistory,
    vpQueue, vpHistory,
    isLineManager, isVP,
    createLoanRequest, managerDecision, vpDecision, disburseLoan,
    refetchAll,
  };
}
