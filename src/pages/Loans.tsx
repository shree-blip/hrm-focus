import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeLoanDashboard } from "@/components/loans/EmployeeLoanDashboard";
import { ManagerPanel } from "@/components/loans/ManagerPanel";
import { VPPanel } from "@/components/loans/VPPanel";
import { LoanCalculator } from "@/components/loans/LoanCalculator";
import { useLoans } from "@/hooks/useLoans";
import { FIXED_ANNUAL_RATE } from "@/lib/loanCalculations";
import { Loader2 } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";

export default function Loans() {
  const [activeTab, setActiveTab] = usePersistentState("loans:activeTab", "my-loans");
  const {
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
    createLoanRequest,
    managerDecision,
    vpDecision,
    disburseLoan,
    deleteLoanRequest,
    recordRepayment,
    fetchRepayments,
  } = useLoans();

  // Normalize tab if user doesn't have permission for the current tab
  let normalizedActiveTab = activeTab;
  if (!isVP && activeTab === "vp") normalizedActiveTab = "my-loans";
  if (!isLineManager && activeTab === "manager") normalizedActiveTab = "my-loans";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Employee Loans</h1>
          <p className="text-muted-foreground">Manage loan requests and approvals</p>
        </div>

        <Tabs value={normalizedActiveTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="my-loans">My Loans</TabsTrigger>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            {isLineManager && <TabsTrigger value="manager">Manager Review</TabsTrigger>}
            {isVP && <TabsTrigger value="vp">CEO / Finance</TabsTrigger>}
          </TabsList>

          <TabsContent value="my-loans">
            <EmployeeLoanDashboard
              myLoans={myLoans}
              employeeData={employeeData}
              loanPolicy={loanPolicy}
              onCreateLoan={createLoanRequest}
              onDeleteLoan={deleteLoanRequest}
              fetchRepayments={fetchRepayments}
              repayments={repayments}
              isVP={isVP}
            />
          </TabsContent>

          <TabsContent value="calculator">
            <div className="max-w-xl">
              <LoanCalculator
                interestRate={FIXED_ANNUAL_RATE}
              />
            </div>
          </TabsContent>

          {isLineManager && (
            <TabsContent value="manager">
              <ManagerPanel
                pendingRequests={pendingForManager}
                history={managerHistory}
                onDecision={managerDecision}
              />
            </TabsContent>
          )}

          {isVP && (
            <TabsContent value="vp">
              <VPPanel
                vpQueue={vpQueue}
                vpHistory={vpHistory}
                activeDisbursed={activeDisbursed}
                repayments={repayments}
                onDecision={vpDecision}
                onDisburse={disburseLoan}
                onRecordRepayment={recordRepayment}
                fetchRepayments={fetchRepayments}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
