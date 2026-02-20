import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockWidget } from "@/components/dashboard/ClockWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { LeaveWidget } from "@/components/dashboard/LeaveWidget";
import { TeamWidget } from "@/components/dashboard/TeamWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AnnouncementsWidget } from "@/components/dashboard/AnnouncementsWidget";
import { CompanyCalendar } from "@/components/dashboard/CompanyCalendar";
import { DailyTimelineWidget } from "@/components/dashboard/DailyTimelineWidget";
import { RealTimeAttendanceWidget } from "@/components/dashboard/RealTimeAttendanceWidget";

import { PersonalReportsWidget } from "@/components/dashboard/PersonalReportsWidget";
import { TeamReportsWidget } from "@/components/dashboard/TeamReportsWidget";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAttendance } from "@/hooks/useAttendance";
import { Users, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";

const Index = () => {
  const { profile, role, isManager } = useAuth();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { tasks } = useTasks();
  const { requests, ownRequests, teamLeaves } = useLeaveRequests();
  const { monthlyHours } = useAttendance();

  const firstName = profile?.first_name || "User";
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;
  const dueTodayTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today && t.status !== "done";
  }).length;

  // Get today's date string for comparisons
  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Filter: only approved leaves that are currently active or upcoming (end_date >= today)
  const activeAndUpcomingLeaves = useMemo(() => {
    const allLeaves = isManager ? requests : ownRequests;
    return allLeaves.filter((r) => {
      // Only approved leaves that haven't ended yet
      if (r.status === "approved" && r.end_date >= todayStr) return true;
      // Also include pending leaves (they're upcoming)
      if (r.status === "pending") return true;
      return false;
    });
  }, [requests, ownRequests, isManager, todayStr]);

  // Pending leave requests count (for manager approval badge)
  const pendingLeaveRequests = useMemo(() => {
    const allLeaves = isManager ? requests : ownRequests;
    return allLeaves.filter((r) => r.status === "pending").length;
  }, [requests, ownRequests, isManager]);

  // People on leave TODAY (approved leaves where today falls between start and end date)
  const onLeaveToday = useMemo(() => {
    // Use teamLeaves (all approved leaves across the org) for better visibility
    const source = teamLeaves.length > 0 ? teamLeaves : requests;
    return source.filter((r) => {
      return r.status === "approved" && r.start_date <= todayStr && r.end_date >= todayStr;
    });
  }, [teamLeaves, requests, todayStr]);

  // Build the leave stat card subtitle
  const leaveChangeText = useMemo(() => {
    if (isManager) {
      if (pendingLeaveRequests > 0) {
        return `${pendingLeaveRequests} pending approval`;
      }
      if (onLeaveToday.length > 0) {
        const names = onLeaveToday.map((r) => (r.profile ? `${r.profile.first_name}` : "Someone")).slice(0, 3); // Show max 3 names
        const extra = onLeaveToday.length > 3 ? ` +${onLeaveToday.length - 3} more` : "";
        return `On leave: ${names.join(", ")}${extra}`;
      }
      return "No one on leave today";
    } else {
      if (onLeaveToday.some((r) => r.user_id === profile?.user_id)) {
        return "You're on leave today";
      }
      return "View leave balance";
    }
  }, [isManager, pendingLeaveRequests, onLeaveToday, profile]);

  const getRoleLabel = () => {
    if (role === "vp") return "VP";
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    return "";
  };

  const handleViewCalendar = () => {
    const calendarElement = document.getElementById("company-calendar");
    if (calendarElement) {
      calendarElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Welcome back, {firstName}</h1>
          {role && role !== "employee" && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {getRoleLabel()}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          {isManager ? "Here's what's happening with your team today." : "Here's your personal dashboard overview."}
        </p>
      </div>

      {/* Mobile-Only: Clock & Timeline at Top */}
      <div className="lg:hidden space-y-6 mb-6">
        <ClockWidget />
        <RealTimeAttendanceWidget />
        <DailyTimelineWidget onViewAll={handleViewCalendar} />
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
          value={activeAndUpcomingLeaves.length.toString()}
          change={leaveChangeText}
          changeType={
            isManager && pendingLeaveRequests > 0 ? "negative" : onLeaveToday.length > 0 ? "neutral" : "positive"
          }
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
          {isManager ? <TeamReportsWidget /> : <PersonalReportsWidget />}
          <PerformanceChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TasksWidget />
            <LeaveWidget />
          </div>
          <div id="company-calendar">
            <CompanyCalendar />
          </div>
        </div>

        {/* Right Column - 1/3 width (Desktop only for Clock & Timeline) */}
        <div className="space-y-6">
          {/* Hidden on mobile since we show them at top */}
          <div className="hidden lg:block">
            <ClockWidget />
          </div>
          <div className="hidden lg:block">
            <RealTimeAttendanceWidget />
          </div>
          <div className="hidden lg:block">
            <DailyTimelineWidget onViewAll={handleViewCalendar} />
          </div>
          {/* <TeamWidget /> */}
          <AnnouncementsWidget />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
