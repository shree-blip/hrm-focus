import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockWidget } from "@/components/dashboard/ClockWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { LeaveWidget } from "@/components/dashboard/LeaveWidget";
import { TeamWidget } from "@/components/dashboard/TeamWidget";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AnnouncementsWidget } from "@/components/dashboard/AnnouncementsWidget";
import { CompanyCalendar } from "@/components/dashboard/CompanyCalendar";
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Welcome back, Ganesh
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your team today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Employees"
          value="48"
          change="+3 this month"
          changeType="positive"
          icon={Users}
          iconColor="bg-primary/10 text-primary"
          delay={100}
        />
        <StatCard
          title="Hours Tracked Today"
          value="312h"
          change="85% utilization"
          changeType="positive"
          icon={Clock}
          iconColor="bg-success/10 text-success"
          delay={150}
        />
        <StatCard
          title="Pending Tasks"
          value="23"
          change="5 due today"
          changeType="neutral"
          icon={CheckCircle2}
          iconColor="bg-warning/10 text-warning"
          delay={200}
        />
        <StatCard
          title="Leave Requests"
          value="4"
          change="2 pending approval"
          changeType="neutral"
          icon={Calendar}
          iconColor="bg-info/10 text-info"
          delay={250}
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
