import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockWidget } from "@/components/dashboard/ClockWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { LeaveWidget } from "@/components/dashboard/LeaveWidget";
import { TeamWidget } from "@/components/dashboard/TeamWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AnnouncementsWidget } from "@/components/dashboard/AnnouncementsWidget";
import { CompanyCalendar } from "@/components/dashboard/CompanyCalendar";
import { NewAnnouncementPopup } from "@/components/dashboard/NewAnnouncementPopup";
import { PersonalReportsWidget } from "@/components/dashboard/PersonalReportsWidget";
import { TeamReportsWidget } from "@/components/dashboard/TeamReportsWidget";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAttendance } from "@/hooks/useAttendance";
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const Index = () => {
  const { profile, role, isManager } = useAuth();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { tasks } = useTasks();
  const { requests } = useLeaveRequests();
  const { monthlyHours } = useAttendance();

  const firstName = profile?.first_name || "User";
  const pendingTasks = tasks.filter(t => t.status !== "done").length;
  const dueTodayTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today && t.status !== "done";
  }).length;
  const pendingLeaveRequests = requests.filter(r => r.status === "pending").length;

  // Role-based greeting
  const getRoleLabel = () => {
    if (role === "vp") return "VP";
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    return "";
  };

  return (
    <DashboardLayout>
      {/* New Announcement Popup - shows on first login of the day */}
      <NewAnnouncementPopup />

      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome back, {firstName}
          </h1>
          {role && role !== "employee" && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {getRoleLabel()}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          {isManager 
            ? "Here's what's happening with your team today." 
            : "Here's your personal dashboard overview."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isManager ? (
          <StatCard
            title="Total Employees"
            value={employees.length.toString()}
            change="View directory"
            changeType="neutral"
            icon={Users}
            iconColor="bg-primary/10 text-primary"
            delay={100}
            onClick={() => navigate("/employees")}
          />
        ) : (
          <StatCard
            title="My Profile"
            value={profile ? `${profile.first_name} ${profile.last_name}` : "Loading..."}
            change={profile?.department || "View profile"}
            changeType="neutral"
            icon={Users}
            iconColor="bg-primary/10 text-primary"
            delay={100}
            onClick={() => navigate("/profile")}
          />
        )}
        <StatCard
          title="Hours This Month"
          value={`${monthlyHours}h`}
          change="View attendance"
          changeType="neutral"
          icon={Clock}
          iconColor="bg-success/10 text-success"
          delay={150}
          onClick={() => navigate("/attendance")}
        />
        <StatCard
          title={isManager ? "Team Tasks" : "My Tasks"}
          value={pendingTasks.toString()}
          change={`${dueTodayTasks} due today`}
          changeType={dueTodayTasks > 0 ? "negative" : "neutral"}
          icon={CheckCircle2}
          iconColor="bg-warning/10 text-warning"
          delay={200}
          onClick={() => navigate("/tasks")}
        />
        <StatCard
          title={isManager ? "Leave Requests" : "My Leave"}
          value={requests.length.toString()}
          change={isManager ? `${pendingLeaveRequests} pending approval` : "View leave balance"}
          changeType={isManager && pendingLeaveRequests > 0 ? "neutral" : "positive"}
          icon={Calendar}
          iconColor="bg-info/10 text-info"
          delay={250}
          onClick={() => navigate("/leave")}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Custom Reports based on role */}
          {isManager ? <TeamReportsWidget /> : <PersonalReportsWidget />}
          
          <PerformanceChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TasksWidget />
            <LeaveWidget />
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          <ClockWidget />
          <CompanyCalendar />
          <TeamWidget />
          <AnnouncementsWidget />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
