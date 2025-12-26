import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockWidget } from "@/components/dashboard/ClockWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { LeaveWidget } from "@/components/dashboard/LeaveWidget";
import { TeamWidget } from "@/components/dashboard/TeamWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AnnouncementsWidget } from "@/components/dashboard/AnnouncementsWidget";
import { CompanyCalendar } from "@/components/dashboard/CompanyCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const Index = () => {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { tasks } = useTasks();
  const { requests } = useLeaveRequests();

  const firstName = profile?.first_name || "User";
  const pendingTasks = tasks.filter(t => t.status !== "done").length;
  const dueTodayTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today && t.status !== "done";
  }).length;
  const pendingLeaveRequests = requests.filter(r => r.status === "pending").length;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your team today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Employees"
          value={employees.length.toString()}
          change="+3 this month"
          changeType="positive"
          icon={Users}
          iconColor="bg-primary/10 text-primary"
          delay={100}
          onClick={() => navigate("/employees")}
        />
        <StatCard
          title="Hours Tracked Today"
          value="--"
          change="View attendance"
          changeType="neutral"
          icon={Clock}
          iconColor="bg-success/10 text-success"
          delay={150}
          onClick={() => navigate("/attendance")}
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasks.toString()}
          change={`${dueTodayTasks} due today`}
          changeType={dueTodayTasks > 0 ? "negative" : "neutral"}
          icon={CheckCircle2}
          iconColor="bg-warning/10 text-warning"
          delay={200}
          onClick={() => navigate("/tasks")}
        />
        <StatCard
          title="Leave Requests"
          value={requests.length.toString()}
          change={`${pendingLeaveRequests} pending approval`}
          changeType={pendingLeaveRequests > 0 ? "neutral" : "positive"}
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
