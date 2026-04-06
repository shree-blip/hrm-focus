import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockWidget } from "@/components/dashboard/ClockWidget";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTimeTracker } from "@/contexts/TimeTrackerContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Users, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { useMemo, lazy, Suspense } from "react";

import { ChartSkeleton, WidgetCardSkeleton } from "@/components/dashboard/DashboardSkeleton";

const PerformanceChart = lazy(() =>
  import("@/components/dashboard/PerformanceChart").then((m) => ({ default: m.PerformanceChart })),
);
const CompanyCalendar = lazy(() =>
  import("@/components/dashboard/CompanyCalendar").then((m) => ({ default: m.CompanyCalendar })),
);
const RealTimeAttendanceWidget = lazy(() =>
  import("@/components/dashboard/RealTimeAttendanceWidget").then((m) => ({ default: m.RealTimeAttendanceWidget })),
);
const TasksWidget = lazy(() =>
  import("@/components/dashboard/TasksWidget").then((m) => ({ default: m.TasksWidget })),
);
const LeaveWidget = lazy(() =>
  import("@/components/dashboard/LeaveWidget").then((m) => ({ default: m.LeaveWidget })),
);
const AnnouncementsWidget = lazy(() =>
  import("@/components/dashboard/AnnouncementsWidget").then((m) => ({ default: m.AnnouncementsWidget })),
);
const DailyTimelineWidget = lazy(() =>
  import("@/components/dashboard/DailyTimelineWidget").then((m) => ({ default: m.DailyTimelineWidget })),
);
const GlobalTimeZoneWidget = lazy(() =>
  import("@/components/dashboard/GlobalTimeZoneWidget").then((m) => ({ default: m.GlobalTimeZoneWidget })),
);
const PersonalReportsWidget = lazy(() =>
  import("@/components/dashboard/PersonalReportsWidget").then((m) => ({ default: m.PersonalReportsWidget })),
);
const TeamReportsWidget = lazy(() =>
  import("@/components/dashboard/TeamReportsWidget").then((m) => ({ default: m.TeamReportsWidget })),
);

const Index = () => {
  const { profile, role, isManager } = useAuth();
  const navigate = useNavigate();
  
  const isMobile = useIsMobile();
  const { employees } = useEmployees();
  const { tasks } = useTasks();
  const { requests, ownRequests, teamLeaves } = useLeaveRequests();
  const { monthlyHours } = useTimeTracker();


  const firstName = profile?.first_name || "User";
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;
  const dueTodayTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today && t.status !== "done";
  }).length;

  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const pendingLeaves = useMemo(() => {
    const allLeaves = isManager ? requests : ownRequests;
    return allLeaves.filter((r) => r.status === "pending");
  }, [requests, ownRequests, isManager]);

  const pendingLeaveRequests = useMemo(() => {
    const allLeaves = isManager ? requests : ownRequests;
    return allLeaves.filter((r) => r.status === "pending").length;
  }, [requests, ownRequests, isManager]);

  const onLeaveToday = useMemo(() => {
    const source = teamLeaves.length > 0 ? teamLeaves : requests;
    return source.filter((r) => r.status === "approved" && r.start_date <= todayStr && r.end_date >= todayStr);
  }, [teamLeaves, requests, todayStr]);

  const leaveChangeText = useMemo(() => {
    if (isManager) {
      if (pendingLeaveRequests > 0) return `${pendingLeaveRequests} pending approval`;
      if (onLeaveToday.length > 0) {
        const names = onLeaveToday.map((r) => (r.profile ? `${r.profile.first_name}` : "Someone")).slice(0, 3);
        const extra = onLeaveToday.length > 3 ? ` +${onLeaveToday.length - 3} more` : "";
        return `On leave: ${names.join(", ")}${extra}`;
      }
      return "No one on leave today";
    }

    if (onLeaveToday.some((r) => r.user_id === profile?.user_id)) return "You're on leave today";
    if (onLeaveToday.length > 0) {
      const names = onLeaveToday.map((r) => (r.profile ? `${r.profile.first_name}` : "Someone")).slice(0, 3);
      const extra = onLeaveToday.length > 3 ? ` +${onLeaveToday.length - 3} more` : "";
      return `On leave: ${names.join(", ")}${extra}`;
    }
    return "View leave balance";
  }, [isManager, pendingLeaveRequests, onLeaveToday, profile]);

  const getRoleLabel = () => {
    if (role === "vp") return "CEO";
    if (role === "admin") return "Admin";
    if (role === "supervisor") return "Supervisor";
    return "";
  };

  const handleViewCalendar = () => {
    const calendarElement = document.getElementById("company-calendar");
    if (calendarElement) calendarElement.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <DashboardLayout>
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

      {isMobile && (
        <div className="space-y-6 mb-6">
          <ClockWidget />
          <Suspense fallback={<WidgetCardSkeleton delay={100} />}>
            <RealTimeAttendanceWidget />
          </Suspense>
          <Suspense fallback={<WidgetCardSkeleton delay={150} />}>
            <DailyTimelineWidget onViewAll={handleViewCalendar} />
          </Suspense>
          <Suspense fallback={<WidgetCardSkeleton delay={200} />}>
            <GlobalTimeZoneWidget />
          </Suspense>
        </div>
      )}

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
          value={pendingLeaves.length.toString()}
          change={leaveChangeText}
          changeType={isManager && pendingLeaves.length > 0 ? "negative" : onLeaveToday.length > 0 ? "neutral" : "positive"}
          icon={Calendar}
          iconColor="bg-info/10 text-info"
          delay={250}
          onClick={() => navigate("/leave")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<WidgetCardSkeleton delay={300} />}>
            {isManager ? <TeamReportsWidget /> : <PersonalReportsWidget />}
          </Suspense>
          <Suspense fallback={<ChartSkeleton delay={350} />}>
            <PerformanceChart />
          </Suspense>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Suspense fallback={<WidgetCardSkeleton delay={400} />}>
              <TasksWidget />
            </Suspense>
            <Suspense fallback={<WidgetCardSkeleton delay={400} />}>
              <LeaveWidget />
            </Suspense>
          </div>
          <div id="company-calendar">
            <Suspense fallback={<WidgetCardSkeleton delay={450} />}>
              <CompanyCalendar />
            </Suspense>
          </div>
        </div>

        {!isMobile && (
          <div className="space-y-6">
            <ClockWidget />
            <Suspense fallback={<WidgetCardSkeleton delay={100} />}>
              <RealTimeAttendanceWidget />
            </Suspense>
            <Suspense fallback={<WidgetCardSkeleton delay={150} />}>
              <DailyTimelineWidget onViewAll={handleViewCalendar} />
            </Suspense>
            <Suspense fallback={<WidgetCardSkeleton delay={200} />}>
              <GlobalTimeZoneWidget />
            </Suspense>
            <Suspense fallback={<WidgetCardSkeleton delay={250} />}>
              <AnnouncementsWidget />
            </Suspense>
          </div>
        )}

        {isMobile && (
          <div className="space-y-6">
            <Suspense fallback={<WidgetCardSkeleton delay={250} />}>
              <AnnouncementsWidget />
            </Suspense>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Index;
