import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { calculateEMI, generateAmortizationSchedule, FIXED_ANNUAL_RATE, LoanPolicy } from "@/lib/loanCalculations";

export function useLoans() {
  const { user, isAdmin, isVP, isLineManager } = useAuth();
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [pendingForManager, setPendingForManager] = useState<any[]>([]);
  const [managerHistory, setManagerHistory] = useState<any[]>([]);
  const [vpQueue, setVpQueue] = useState<any[]>([]);
  const [vpHistory, setVpHistory] = useState<any[]>([]);
  const [activeDisbursed, setActiveDisbursed] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loanPolicy, setLoanPolicy] = useState<LoanPolicy | null>(null);

  const fetchEmployeeData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: profileData } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();

      if (!profileData) return;

      const { data } = await supabase.from("employees").select("*").eq("profile_id", profileData.id).maybeSingle();

      if (data) {
        setEmployeeData(data);
        if (data.position_level) {
          const { data: policy } = await supabase
            .from("loan_policies")
            .select("*")
            .eq("position_level", data.position_level)
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
    } catch (err) {
      console.error("Error fetching employee data:", err);
    }
  }, [user]);

  const fetchMyLoans = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("loan_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching my loans:", error.message);
        return;
      }
      if (data) setMyLoans(data);
    } catch (err) {
      console.error("Unexpected error fetching my loans:", err);
    }
  }, [user]);

  const fetchManagerQueue = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch loans assigned to this user as manager (works for any role)
      const { data: pending, error: pendingErr } = await supabase
        .from("loan_requests")
        .select(
          "*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)",
        )
        .eq("manager_user_id", user.id)
        .eq("status", "pending_manager")
        .order("created_at", { ascending: false });
      if (pendingErr) {
        console.error("Error fetching manager pending:", pendingErr.message);
      }
      if (pending) setPendingForManager(pending);

      const { data: history, error: histErr } = await supabase
        .from("loan_requests")
        .select(
          "*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)",
        )
        .eq("manager_user_id", user.id)
        .neq("status", "pending_manager")
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (histErr) {
        console.error("Error fetching manager history:", histErr.message);
      }
      if (history) setManagerHistory(history);
    } catch (err) {
      console.error("Unexpected error in fetchManagerQueue:", err);
    }
  }, [user]);

  const fetchVPQueue = useCallback(async () => {
    if (!user || !isVP) return;
    try {
      // VP sees both pending_manager and pending_vp loans for full pipeline oversight
      const { data: pending, error: vpPendErr } = await supabase
        .from("loan_requests")
        .select(
          "*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)",
        )
        .in("status", ["pending_manager", "pending_vp"])
        .order("created_at", { ascending: false });
      if (vpPendErr) {
        console.error("Error fetching VP queue:", vpPendErr.message);
      }
      if (pending) setVpQueue(pending);

      const { data: history, error: vpHistErr } = await supabase
        .from("loan_requests")
        .select(
          "*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)",
        )
        .in("status", ["approved", "rejected", "disbursed", "closed"])
        .order("created_at", { ascending: false });
      if (vpHistErr) {
        console.error("Error fetching VP history:", vpHistErr.message);
      }
      if (history) setVpHistory(history);

      // Fetch active disbursed loans (for repayment tracking)
      const { data: disbursed, error: disbErr } = await supabase
        .from("loan_requests")
        .select(
          "*, employees!loan_requests_employee_id_fkey(first_name, last_name, employee_id, department, position_level)",
        )
        .eq("status", "disbursed")
        .order("created_at", { ascending: false });
      if (disbErr) {
        console.error("Error fetching disbursed loans:", disbErr.message);
      }
      if (disbursed) setActiveDisbursed(disbursed);
    } catch (err) {
      console.error("Unexpected error in fetchVPQueue:", err);
    }
  }, [user, isVP]);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEmployeeData(), fetchMyLoans(), fetchManagerQueue(), fetchVPQueue()]);
    setLoading(false);
  }, [fetchEmployeeData, fetchMyLoans, fetchManagerQueue, fetchVPQueue]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("loan-changes-simplified")
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests" }, () => {
        fetchMyLoans();
        fetchManagerQueue();
        fetchVPQueue();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_repayments" }, () => {
        fetchMyLoans();
        fetchVPQueue();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyLoans, fetchManagerQueue, fetchVPQueue]);

  const logAudit = async (loanRequestId: string | null, action: string, details?: any) => {
    if (!user) return;
    await supabase.from("loan_audit_logs").insert({
      loan_request_id: loanRequestId,
      user_id: user.id,
      action,
      details: details || {},
    });
  };

  const resolveVP = async (): Promise<string | null> => {
    const { data, error } = await supabase.rpc("get_vp_user_id");
    if (error) {
      console.error("Error resolving VP:", error.message);
      return null;
    }
    return data as string | null;
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

    const emi = data.term_months
      ? calculateEMI(data.amount, FIXED_ANNUAL_RATE, data.term_months)
      : null;

    // VP is resolved best-effort; the DB trigger also auto-fills it on insert
    const vpUserId = await resolveVP();

    const { data: lr, error } = await supabase
      .from("loan_requests")
      .insert({
        user_id: user.id,
        employee_id: employeeData.id,
        org_id: employeeData.org_id,
        amount: data.amount,
        term_months: data.term_months,
        interest_rate: FIXED_ANNUAL_RATE,
        reason_type: data.reason_type,
        estimated_monthly_installment: emi,
        auto_deduction_consent: data.auto_deduction_consent,
        declaration_signed: true,
        e_signature: data.e_signature,
        signed_at: new Date().toISOString(),
        position_level: employeeData.position_level,
        max_eligible_amount: loanPolicy.max_loan,
        status: "pending_manager",
        submitted_at: new Date().toISOString(),
        ...(vpUserId ? { vp_user_id: vpUserId } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating loan request:", error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    // If no manager was assigned (employee has no line_manager/manager),
    // skip manager step and go directly to VP review
    if (lr && !lr.manager_user_id) {
      await supabase
        .from("loan_requests")
        .update({ status: "pending_vp" })
        .eq("id", lr.id);
      lr.status = "pending_vp";
    }

    if (lr && data.reason_details) {
      await supabase.from("loan_request_confidential").insert({
        loan_request_id: lr.id,
        reason_details: data.reason_details,
      });
    }

    if (lr) {
      await logAudit(lr.id, "loan_submitted", { amount: data.amount, term: data.term_months });

      // Notify VP (in-app + email)
      try {
        const { data: empProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .single();
        const empName = empProfile ? `${empProfile.first_name} ${empProfile.last_name}` : "An employee";
        const empEmail = empProfile?.email || "";

        // In-app notification
        await supabase.rpc("create_notification", {
          p_user_id: vpUserId,
          p_title: "💰 New Loan Request",
          p_message: `${empName} submitted a loan request for ${data.amount.toLocaleString()} (${data.term_months} months).`,
          p_type: "loan",
          p_link: "/loans",
        });

        // Email notification to VP
        await supabase.functions.invoke("send-loan-notification", {
          body: {
            event_type: "submitted",
            employee_name: empName,
            employee_email: empEmail,
            amount: data.amount,
            term_months: data.term_months,
            emi,
            reason_type: data.reason_type,
          },
        });
      } catch (err) {
        console.error("Error sending loan notification:", err);
      }
    }

    toast({
      title: "Loan Request Submitted",
      description: lr?.manager_user_id
        ? "Your request has been sent to your manager for approval."
        : "Your request has been sent directly to the VP for approval.",
    });
    await refetchAll();
    return lr;
  };

  const managerDecision = async (loanId: string, decision: "approved" | "rejected", comment: string) => {
    if (!user) return;
    const newStatus = decision === "approved" ? "pending_vp" : "rejected";

    const updates: any = { status: newStatus, manager_comment: comment, manager_approved_at: new Date().toISOString() };

    const { error } = await supabase.from("loan_requests").update(updates).eq("id", loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("loan_approvals").insert({
      loan_request_id: loanId,
      approval_step: "manager_review",
      reviewer_id: user.id,
      decision,
      notes: comment,
    });

    await logAudit(loanId, `manager_${decision}`, { comment });

    // Notify the loan requester about the manager's decision
    try {
      const loan = pendingForManager.find((l) => l.id === loanId);
      if (loan) {
        await supabase.rpc("create_notification", {
          p_user_id: loan.user_id,
          p_title: decision === "approved" ? "✅ Loan Forwarded to VP" : "❌ Loan Rejected",
          p_message: decision === "approved"
            ? `Your loan request has been approved by your manager and forwarded to the VP. Comment: ${comment}`
            : `Your loan request has been rejected by your manager. Reason: ${comment}`,
          p_type: "loan",
          p_link: "/loans",
        });
      }
    } catch (err) {
      console.error("Error sending loan decision notification:", err);
    }

    toast({ title: decision === "approved" ? "Forwarded to VP" : "Loan Rejected", description: comment });
    await refetchAll();
  };

  const vpDecision = async (
    loanId: string,
    decision: "approved" | "rejected",
    comment: string,
    disbursementDate?: string,
    autoPayroll?: boolean,
  ) => {
    if (!user) return;
    const newStatus = decision === "approved" ? "approved" : "rejected";

    const updates: any = { status: newStatus };
    if (decision === "approved" && autoPayroll !== undefined) {
      updates.auto_deduction_consent = autoPayroll;
    }

    const { error } = await supabase.from("loan_requests").update(updates).eq("id", loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("loan_approvals").insert({
      loan_request_id: loanId,
      approval_step: "vp_review",
      reviewer_id: user.id,
      decision,
      notes: comment,
    });

    await logAudit(loanId, `vp_${decision}`, { comment, disbursementDate, autoPayroll });

    // Notify the employee and their manager about the VP decision
    try {
      const loan = vpQueue.find((l) => l.id === loanId);
      if (loan) {
        // Get VP profile for email signature
        const { data: vpProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();
        const vpName = vpProfile ? `${vpProfile.first_name} ${vpProfile.last_name}` : "CEO";

        // Notify employee (in-app)
        await supabase.rpc("create_notification", {
          p_user_id: loan.user_id,
          p_title: decision === "approved" ? "✅ Loan Approved" : "❌ Loan Rejected",
          p_message: decision === "approved"
            ? `Your loan request has been approved by the VP. Comment: ${comment}`
            : `Your loan request has been rejected by the VP. Reason: ${comment}`,
          p_type: "loan",
          p_link: "/loans",
        });

        // Notify employee (email)
        const { data: employeeProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", loan.user_id)
          .single();

        if (employeeProfile?.email) {
          const employeeName = `${employeeProfile.first_name} ${employeeProfile.last_name}`;
          await supabase.functions.invoke("send-loan-notification", {
            body: {
              event_type: decision,
              employee_name: employeeName,
              employee_email: employeeProfile.email,
              amount: loan.amount,
              term_months: loan.term_months,
              emi: loan.estimated_monthly_installment,
              reason_type: loan.reason_type,
              comment,
              vp_name: vpName,
            },
          });
        }

        // Notify manager if they exist
        if (loan.manager_user_id && loan.manager_user_id !== user.id) {
          await supabase.rpc("create_notification", {
            p_user_id: loan.manager_user_id,
            p_title: decision === "approved" ? "✅ Loan Approved by VP" : "❌ Loan Rejected by VP",
            p_message: `The loan request from ${loan.employees?.first_name || "an employee"} ${loan.employees?.last_name || ""} has been ${decision} by the VP.`,
            p_type: "loan",
            p_link: "/loans",
          });
        }
      }
    } catch (err) {
      console.error("Error sending VP loan decision notification:", err);
    }

    toast({ title: decision === "approved" ? "Loan Approved" : "Loan Rejected", description: comment });
    await refetchAll();
  };

  const disburseLoan = async (loanId: string, disbursementDate: string) => {
    if (!user) return;

    // Find the loan to get amount/term for amortization schedule
    const allLoans = [...vpHistory, ...vpQueue, ...activeDisbursed];
    const loan = allLoans.find((l) => l.id === loanId);
    let amortizationSchedule = null;
    let remainingBalance = loan?.amount || 0;

    if (loan) {
      amortizationSchedule = generateAmortizationSchedule(
        Number(loan.amount),
        FIXED_ANNUAL_RATE,
        loan.term_months,
      );
      remainingBalance = Number(loan.amount);
    }

    const { error } = await supabase
      .from("loan_requests")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        remaining_balance: remainingBalance,
        amortization_schedule: amortizationSchedule,
      })
      .eq("id", loanId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await logAudit(loanId, "loan_disbursed", { disbursementDate, remainingBalance });
    toast({ title: "Loan Disbursed", description: "Amortization schedule has been stored." });
    await refetchAll();
  };

  const deleteLoanRequest = async (loanId: string) => {
    if (!user) return;

    const { error } = await supabase.from("loan_requests").delete().eq("id", loanId).eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Loan Deleted", description: "Loan request has been removed." });
    await refetchAll();
  };

  const recordRepayment = async (loanId: string, amount: number) => {
    if (!user) return;

    // Fetch current loan to compute remaining balance
    const { data: loan } = await supabase
      .from("loan_requests")
      .select("amount")
      .eq("id", loanId)
      .single();

    const currentBalance = Number(loan?.amount ?? 0);
    const newBalance = Math.max(0, currentBalance - amount);

    const { data, error } = await supabase.from("loan_repayments").insert({
      loan_request_id: loanId,
      total_amount: amount,
      principal_amount: amount,
      interest_amount: 0,
      remaining_balance: newBalance,
      due_date: new Date().toISOString().split("T")[0],
      month_number: 0,
      status: "paid",
      user_id: user.id,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Update loan remaining_balance
    const updates: any = { remaining_balance: newBalance };
    if (newBalance <= 0) {
      updates.status = "closed";
    }
    await supabase.from("loan_requests").update(updates).eq("id", loanId);

    if (newBalance <= 0) {
      toast({ title: "Loan Closed", description: "All repayments complete. Loan has been automatically closed." });
    } else {
      toast({
        title: "Repayment Recorded",
        description: `Remaining balance: NPR ${newBalance.toFixed(2)}`,
      });
    }

    await refetchAll();
  };

  const fetchRepayments = async (loanId: string) => {
    const { data, error } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_request_id", loanId)
      .order("month_number", { ascending: true });

    if (error) {
      console.error("Error fetching repayments:", error.message);
      return [];
    }

    if (data) {
      setRepayments((prev) => ({ ...prev, [loanId]: data }));
    }
    return data || [];
  };

  return {
    myLoans,
    loading,
    employeeData,
    loanPolicy,
    pendingForManager,
    managerHistory,
    vpQueue,
    vpHistory,
    activeDisbursed,
    repayments,
    isLineManager,
    isVP,
    hasManagerData: pendingForManager.length > 0 || managerHistory.length > 0,
    createLoanRequest,
    managerDecision,
    vpDecision,
    disburseLoan,
    deleteLoanRequest,
    recordRepayment,
    fetchRepayments,
    refetchAll,
  };
}
