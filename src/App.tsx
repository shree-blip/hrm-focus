import { lazy, Suspense, startTransition, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityAlertsProvider } from "@/components/ActivityAlertsProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TimeTrackerProvider } from "@/contexts/TimeTrackerContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "./components/dashboard/Themecontext";

// ─────────────────────────────────────────────────────────
// 1. EAGER IMPORTS — Core pages users hit on every session.
//    No lazy loading = instant navigation, zero spinner.
// ─────────────────────────────────────────────────────────
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";

// ─────────────────────────────────────────────────────────
// 2. LAZY IMPORTS — Heavier / less-visited pages.
//    Loaded on-demand with chunk-error retry.
// ─────────────────────────────────────────────────────────

/**
 * Lazy-load with a single automatic retry on chunk failures.
 * After a deploy invalidates old chunks, users get one seamless
 * reload instead of a blank screen.
 */
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      const isChunkError =
        err?.message?.includes("Failed to fetch dynamically imported module") ||
        err?.message?.includes("Importing a module script failed") ||
        err?.message?.includes("Loading chunk") ||
        err?.message?.includes("Loading CSS chunk");

      if (isChunkError && !sessionStorage.getItem("chunk_retry")) {
        sessionStorage.setItem("chunk_retry", "1");
        window.location.reload();
        return new Promise(() => {}); // hang until reload completes
      }
      sessionStorage.removeItem("chunk_retry");
      throw err;
    }),
  );
}

const Employees = lazyRetry(() => import("./pages/Employees"));
const Attendance = lazyRetry(() => import("./pages/Attendance"));
const Leave = lazyRetry(() => import("./pages/Leave"));
const Approvals = lazyRetry(() => import("./pages/Approvals"));
const Tasks = lazyRetry(() => import("./pages/Tasks"));
const Payroll = lazyRetry(() => import("./pages/Payroll"));
const Performance = lazyRetry(() => import("./pages/Performance"));
const Documents = lazyRetry(() => import("./pages/Documents"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const Reports = lazyRetry(() => import("./pages/Reports"));
const Announcements = lazyRetry(() => import("./pages/Announcements"));
const AccessControl = lazyRetry(() => import("./pages/AccessControl"));
const LogSheet = lazyRetry(() => import("./pages/LogSheet"));
const Support = lazyRetry(() => import("./pages/Support"));
const Loans = lazyRetry(() => import("./pages/Loans"));
const Invoices = lazyRetry(() => import("./pages/Invoices"));
const MyPayslips = lazyRetry(() => import("./pages/MyPayslips"));
const MyOnboarding = lazyRetry(() => import("./pages/MyOnboarding"));
const MyOffboarding = lazyRetry(() => import("./pages/MyOffboarding"));
const TimezoneManagement = lazyRetry(() => import("./pages/TimezoneManagement"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

// ─────────────────────────────────────────────────────────
// 3. PREFETCH MAP — Call prefetchRoute("employees") on
//    hover/focus of nav links to start loading the chunk
//    before the user clicks.
//
//    Usage in your sidebar / nav component:
//      import { prefetchRoute } from "@/App";
//      <Link to="/employees" onMouseEnter={() => prefetchRoute("employees")}>
// ─────────────────────────────────────────────────────────
const prefetchMap: Record<string, () => Promise<any>> = {
  employees: () => import("./pages/Employees"),
  attendance: () => import("./pages/Attendance"),
  leave: () => import("./pages/Leave"),
  approvals: () => import("./pages/Approvals"),
  tasks: () => import("./pages/Tasks"),
  payroll: () => import("./pages/Payroll"),
  performance: () => import("./pages/Performance"),
  documents: () => import("./pages/Documents"),
  onboarding: () => import("./pages/Onboarding"),
  reports: () => import("./pages/Reports"),
  announcements: () => import("./pages/Announcements"),
  "access-control": () => import("./pages/AccessControl"),
  "log-sheet": () => import("./pages/LogSheet"),
  support: () => import("./pages/Support"),
  loans: () => import("./pages/Loans"),
  invoices: () => import("./pages/Invoices"),
  "my-payslips": () => import("./pages/MyPayslips"),
  "my-onboarding": () => import("./pages/MyOnboarding"),
  "my-offboarding": () => import("./pages/MyOffboarding"),
  "timezone-management": () => import("./pages/TimezoneManagement"),
};

/**
 * Call on mouseEnter / focus of nav links to warm the chunk cache.
 * Browsers cache the import, so the actual navigation is near-instant.
 */
export function prefetchRoute(key: string) {
  const loader = prefetchMap[key];
  if (loader) {
    loader().catch(() => {
      /* silent — the real load will handle errors */
    });
  }
}

// ─────────────────────────────────────────────────────────
// 4. QUERY CLIENT
// ─────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─────────────────────────────────────────────────────────
// 5. PAGE LOADER — Only shown for lazy routes
// ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// ─────────────────────────────────────────────────────────
// 6. APP
// ─────────────────────────────────────────────────────────
const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <TimeTrackerProvider>
                <ActivityAlertsProvider />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* ── Public (eager) ── */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/login" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* ── Core protected (eager — no loading spinner) ── */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Index />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <ProtectedRoute>
                          <Notifications />
                        </ProtectedRoute>
                      }
                    />

                    {/* ── Lazy protected routes ── */}
                    <Route
                      path="/employees"
                      element={
                        <ProtectedRoute
                          requiredPermission={["manage_employees", "view_employees_all", "view_employees_reports_only"]}
                        >
                          <Employees />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/attendance"
                      element={
                        <ProtectedRoute
                          requiredPermission={[
                            "view_attendance_all",
                            "view_attendance_reports_only",
                            "view_own_attendance",
                          ]}
                        >
                          <Attendance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/leave"
                      element={
                        <ProtectedRoute requiredPermission={["view_leave", "approve_leave"]}>
                          <Leave />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/approvals"
                      element={
                        <ProtectedRoute requiredPermission="approve_leave">
                          <Approvals />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tasks"
                      element={
                        <ProtectedRoute requiredPermission={["manage_tasks", "view_tasks"]}>
                          <Tasks />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/payroll"
                      element={
                        <ProtectedRoute requiredPermission={["manage_payroll", "view_payroll", "view_payslips"]}>
                          <Payroll />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-payslips"
                      element={
                        <ProtectedRoute requiredPermission="view_payslips">
                          <MyPayslips />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/performance"
                      element={
                        <ProtectedRoute requiredPermission="view_performance">
                          <Performance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/documents"
                      element={
                        <ProtectedRoute requiredPermission={["manage_documents", "view_documents"]}>
                          <Documents />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute requiredPermission="manage_onboarding">
                          <Onboarding />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-onboarding"
                      element={
                        <ProtectedRoute requiredPermission="view_onboarding">
                          <MyOnboarding />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-offboarding"
                      element={
                        <ProtectedRoute requiredPermission="view_onboarding">
                          <MyOffboarding />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute requiredPermission="view_reports">
                          <Reports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/announcements"
                      element={
                        <ProtectedRoute
                          requiredPermission={[
                            "add_announcement",
                            "edit_announcement",
                            "delete_announcement",
                            "view_announcements",
                          ]}
                        >
                          <Announcements />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/access-control"
                      element={
                        <ProtectedRoute requiredPermission="manage_access">
                          <AccessControl />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/log-sheet"
                      element={
                        <ProtectedRoute requiredPermission="view_log_sheet">
                          <LogSheet />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/support"
                      element={
                        <ProtectedRoute
                          requiredPermission={[
                            "manage_support",
                            "view_support",
                            "view_bug_reports",
                            "view_grievances",
                            "view_asset_requests",
                          ]}
                        >
                          <Support />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/loans"
                      element={
                        <ProtectedRoute requiredPermission={["manage_loans", "view_loans"]}>
                          <Loans />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/invoices"
                      element={
                        <ProtectedRoute requiredPermission={["view_invoices", "manage_invoices"]}>
                          <Invoices />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/timezone-management"
                      element={
                        <ProtectedRoute requiredPermission="manage_access">
                          <TimezoneManagement />
                        </ProtectedRoute>
                      }
                    />

                    {/* ── Catch-all ── */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </TimeTrackerProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
