import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityAlertsProvider } from "@/components/ActivityAlertsProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Approvals from "./pages/Approvals";
import Tasks from "./pages/Tasks";
import Payroll from "./pages/Payroll";
import Performance from "./pages/Performance";
import Documents from "./pages/Documents";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Announcements from "./pages/Announcements";
import AccessControl from "./pages/AccessControl";
import LogSheet from "./pages/LogSheet";
import Support from "./pages/Support";
import Loans from "./pages/Loans";
import Invoices from "./pages/Invoices";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActivityAlertsProvider />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requiredPermission={["manage_employees", "view_employees_all", "view_employees_reports_only"]}><Employees /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute requiredPermission="approve_leave"><Approvals /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute requiredPermission={["manage_payroll", "view_payroll"]}><Payroll /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute requiredPermission="manage_onboarding"><Onboarding /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredPermission="view_reports"><Reports /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute requiredPermission={["add_announcement", "edit_announcement", "delete_announcement", "view_announcements"]}><Announcements /></ProtectedRoute>} />
            <Route path="/access-control" element={<ProtectedRoute requiredPermission="manage_access"><AccessControl /></ProtectedRoute>} />
            <Route path="/log-sheet" element={<ProtectedRoute><LogSheet /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
