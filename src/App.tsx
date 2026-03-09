import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityAlertsProvider } from "@/components/ActivityAlertsProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-load all page components for code-splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Employees = lazy(() => import("./pages/Employees"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Leave = lazy(() => import("./pages/Leave"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Performance = lazy(() => import("./pages/Performance"));
const Documents = lazy(() => import("./pages/Documents"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Reports = lazy(() => import("./pages/Reports"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const LogSheet = lazy(() => import("./pages/LogSheet"));
const Support = lazy(() => import("./pages/Support"));
const Loans = lazy(() => import("./pages/Loans"));
const Invoices = lazy(() => import("./pages/Invoices"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — avoid refetches on tab switches
      gcTime: 10 * 60 * 1000,     // 10 min garbage collection
      refetchOnWindowFocus: false, // prevent refetch storms on alt-tab
      retry: 1,                    // single retry instead of default 3
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActivityAlertsProvider />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requiredPermission={["manage_employees", "view_employees_all", "view_employees_reports_only"]}><Employees /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute requiredPermission={["view_attendance_all", "view_attendance_reports_only", "view_own_attendance"]}><Attendance /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute requiredPermission={["view_leave", "approve_leave"]}><Leave /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute requiredPermission="approve_leave"><Approvals /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requiredPermission={["manage_tasks", "view_tasks"]}><Tasks /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute requiredPermission={["manage_payroll", "view_payroll"]}><Payroll /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute requiredPermission="view_performance"><Performance /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute requiredPermission={["manage_documents", "view_documents"]}><Documents /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute requiredPermission="manage_onboarding"><Onboarding /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredPermission="view_reports"><Reports /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute requiredPermission={["add_announcement", "edit_announcement", "delete_announcement", "view_announcements"]}><Announcements /></ProtectedRoute>} />
            <Route path="/access-control" element={<ProtectedRoute requiredPermission="manage_access"><AccessControl /></ProtectedRoute>} />
            <Route path="/log-sheet" element={<ProtectedRoute requiredPermission="view_log_sheet"><LogSheet /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute requiredPermission={["manage_support", "view_support", "view_bug_reports", "view_grievances", "view_asset_requests"]}><Support /></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute requiredPermission={["manage_loans", "view_loans"]}><Loans /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requiredPermission={["view_invoices", "manage_invoices"]}><Invoices /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
