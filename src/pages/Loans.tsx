import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeLoanDashboard } from "@/components/loans/EmployeeLoanDashboard";
import { ManagerPanel } from "@/components/loans/ManagerPanel";
import { VPPanel } from "@/components/loans/VPPanel";
import { LoanCalculator } from "@/components/loans/LoanCalculator";
import { useLoans } from "@/hooks/useLoans";
import { Loader2 } from "lucide-react";

export default function Loans() {
  const {
    myLoans, loading, employeeData, loanPolicy,
    pendingForManager, managerHistory,
    vpQueue, vpHistory,
    isLineManager, isVP,
    createLoanRequest, managerDecision, vpDecision, disburseLoan,
  } = useLoans();

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

        <Tabs defaultValue="my-loans">
          <TabsList className="flex-wrap">
            <TabsTrigger value="my-loans">My Loans</TabsTrigger>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            {isLineManager && <TabsTrigger value="manager">Manager Review</TabsTrigger>}
            {isVP && <TabsTrigger value="vp">VP / Finance</TabsTrigger>}
          </TabsList>

          <TabsContent value="my-loans">
            <EmployeeLoanDashboard
              myLoans={myLoans}
              employeeData={employeeData}
              loanPolicy={loanPolicy}
              onCreateLoan={createLoanRequest}
            />
          </TabsContent>

          <TabsContent value="calculator">
            <div className="max-w-xl">
              <LoanCalculator
                maxAmount={loanPolicy?.max_loan ?? 2500}
                interestRate={loanPolicy?.interest_rate ?? 5}
                allowedTerms={loanPolicy?.allowed_terms}
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
                onDecision={vpDecision}
                onDisburse={disburseLoan}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
