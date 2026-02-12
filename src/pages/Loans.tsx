import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeLoanDashboard } from "@/components/loans/EmployeeLoanDashboard";
import { HRReviewPanel } from "@/components/loans/HRReviewPanel";
import { FinancePanel } from "@/components/loans/FinancePanel";
import { CEOPanel } from "@/components/loans/CEOPanel";
import { LoanCalculator } from "@/components/loans/LoanCalculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLoans } from "@/hooks/useLoans";
import { Loader2, Calculator, Shield } from "lucide-react";
import { format } from "date-fns";

export default function Loans() {
  const {
    myLoans, loanRequests, repayments, approvals, agreements, budgets,
    waitingList, auditLogs, defaultEvents, loading, employeeData,
    isLoanOfficer, isHR, isFinance, isCEO,
    createLoanRequest, updateLoanStatus, submitApproval,
    createAgreement, signAgreement, setBudget,
    createRepaymentSchedule, exportPayrollDeductions, logAudit,
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
          <p className="text-muted-foreground">Manage loan requests, approvals, and repayments</p>
        </div>

        <Tabs defaultValue="my-loans">
          <TabsList className="flex-wrap">
            <TabsTrigger value="my-loans">My Loans</TabsTrigger>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            {isHR && <TabsTrigger value="hr-review">HR Review</TabsTrigger>}
            {isFinance && <TabsTrigger value="finance">Finance</TabsTrigger>}
            {isCEO && <TabsTrigger value="ceo">CEO Approval</TabsTrigger>}
            {isLoanOfficer && <TabsTrigger value="audit">Audit Trail</TabsTrigger>}
            {isLoanOfficer && <TabsTrigger value="defaults">Defaults</TabsTrigger>}
          </TabsList>

          <TabsContent value="my-loans">
            <EmployeeLoanDashboard
              myLoans={myLoans}
              repayments={repayments}
              agreements={agreements}
              employeeData={employeeData}
              onCreateLoan={createLoanRequest}
            />
          </TabsContent>

          <TabsContent value="calculator">
            <div className="max-w-xl">
              <LoanCalculator maxAmount={employeeData?.position_level ? ({ entry: 500, mid: 1500, senior: 2500, management: 2500 }[employeeData.position_level as string] ?? 500) : 500} />
            </div>
          </TabsContent>

          {isHR && (
            <TabsContent value="hr-review">
              <HRReviewPanel
                loanRequests={loanRequests}
                waitingList={waitingList}
                onSubmitApproval={submitApproval}
                onUpdateStatus={updateLoanStatus}
              />
            </TabsContent>
          )}

          {isFinance && (
            <TabsContent value="finance">
              <FinancePanel
                loanRequests={loanRequests}
                budgets={budgets}
                repayments={repayments}
                onSubmitApproval={submitApproval}
                onSetBudget={setBudget}
                onExportDeductions={exportPayrollDeductions}
                onCreateAgreement={createAgreement}
                onCreateRepaymentSchedule={createRepaymentSchedule}
              />
            </TabsContent>
          )}

          {isCEO && (
            <TabsContent value="ceo">
              <CEOPanel
                loanRequests={loanRequests}
                approvals={approvals}
                onSubmitApproval={submitApproval}
                onCreateAgreement={createAgreement}
              />
            </TabsContent>
          )}

          {isLoanOfficer && (
            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Audit Trail</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Loan</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">{format(new Date(log.created_at), 'MMM dd HH:mm')}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{log.action}</Badge></TableCell>
                          <TableCell className="text-xs">{log.loan_request_id?.substring(0, 8) || '-'}</TableCell>
                          <TableCell className="text-xs">{log.document_accessed || '-'}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{JSON.stringify(log.details)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isLoanOfficer && (
            <TabsContent value="defaults">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Default Events & Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  {defaultEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No default events recorded</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>HR Flag</TableHead>
                          <TableHead>Resolved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {defaultEvents.map((de) => (
                          <TableRow key={de.id}>
                            <TableCell className="text-xs">{format(new Date(de.created_at), 'MMM dd, yyyy')}</TableCell>
                            <TableCell><Badge variant="destructive" className="text-xs">{de.event_type}</Badge></TableCell>
                            <TableCell className="text-xs">{de.description || '-'}</TableCell>
                            <TableCell>{de.flagged_for_hr ? <Badge variant="outline">Flagged</Badge> : '-'}</TableCell>
                            <TableCell>{de.resolved ? <Badge>Resolved</Badge> : <Badge variant="destructive">Open</Badge>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
