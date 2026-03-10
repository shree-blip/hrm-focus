/**
 * MyPayslips — Dedicated employee-only page for viewing / downloading payslip PDFs.
 *
 * This page is intentionally lightweight: it wraps the existing <MyPayslipsTab>
 * component inside a DashboardLayout so employees get a clean, focused view
 * without any of the VP payroll management UI.
 */
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MyPayslipsTab } from "@/components/payroll/MyPayslipsTab";
import { usePayslips } from "@/hooks/usePayslips";

const MyPayslips = () => {
  const { downloadPayslip } = usePayslips();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">My Payslips</h1>
          <p className="text-muted-foreground mt-1">
            View and download your payslip PDFs.
          </p>
        </div>

        <MyPayslipsTab downloadPayslip={downloadPayslip} />
      </div>
    </DashboardLayout>
  );
};

export default MyPayslips;
