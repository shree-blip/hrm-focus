import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  region: string;
  status: "draft" | "processing" | "completed";
  total_gross: number | null;
  total_net: number | null;
  total_deductions: number | null;
  employee_count: number | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
}

interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_pay: number;
  net_pay: number;
  hours_worked: number | null;
  overtime_hours: number | null;
  deductions: Record<string, number>;
}

export function usePayroll() {
  const { user, isManager, isVP } = useAuth();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<"US" | "Nepal">("US");

  const fetchPayrollRuns = useCallback(async () => {
    if (!isManager) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .order("period_end", { ascending: false });

    if (!error && data) {
      setPayrollRuns(data as PayrollRun[]);
    }
    setLoading(false);
  }, [isManager]);

  const fetchPayslips = useCallback(async () => {
    if (!user) return;

    let query = supabase.from("payslips").select("*");

    // Regular users only see their own payslips
    if (!isManager) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (!error && data) {
      setPayslips(data as Payslip[]);
    }
  }, [user, isManager]);

  useEffect(() => {
    fetchPayrollRuns();
    fetchPayslips();
  }, [fetchPayrollRuns, fetchPayslips]);

  const createPayrollRun = async (periodStart: Date, periodEnd: Date) => {
    if (!isVP) {
      toast({ title: "Unauthorized", description: "Only VP can run payroll", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from("payroll_runs")
      .insert({
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        region,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create payroll run", variant: "destructive" });
      return null;
    }

    toast({ title: "Payroll Run Created", description: "Draft payroll run created successfully" });
    fetchPayrollRuns();
    return data;
  };

  const processPayroll = async (runId: string) => {
    if (!isVP) {
      toast({ title: "Unauthorized", description: "Only VP can process payroll", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("payroll_runs")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        processed_by: user?.id,
      })
      .eq("id", runId);

    if (error) {
      toast({ title: "Error", description: "Failed to process payroll", variant: "destructive" });
    } else {
      toast({ title: "Payroll Processed", description: "Payroll has been processed successfully" });
      fetchPayrollRuns();
    }
  };

  const exportPayroll = (runId?: string) => {
    const runs = runId ? payrollRuns.filter(r => r.id === runId) : payrollRuns;
    
    const headers = ["Period", "Region", "Employees", "Gross", "Net", "Deductions", "Status"];
    const rows = runs.map(run => [
      `${run.period_start} - ${run.period_end}`,
      run.region,
      run.employee_count || 0,
      run.total_gross || 0,
      run.total_net || 0,
      run.total_deductions || 0,
      run.status,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast({ title: "Export Complete", description: "Payroll data exported successfully" });
  };

  // Tax rates by region
  const getTaxRates = () => {
    if (region === "US") {
      return {
        federal: 0.22,
        state: 0.05,
        fica: 0.0765,
        medicare: 0.0145,
      };
    } else {
      return {
        incomeTax: 0.15,
        socialSecurity: 0.11,
        providentFund: 0.10,
      };
    }
  };

  return {
    payrollRuns,
    payslips,
    loading,
    region,
    setRegion,
    createPayrollRun,
    processPayroll,
    exportPayroll,
    getTaxRates,
    refetch: () => {
      fetchPayrollRuns();
      fetchPayslips();
    },
  };
}
