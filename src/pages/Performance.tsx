import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Award, Target, Users, Star, ArrowUp, ArrowDown, Minus, Loader2 } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const radarData = [
  { skill: "Technical", value: 85 },
  { skill: "Communication", value: 78 },
  { skill: "Leadership", value: 72 },
  { skill: "Problem Solving", value: 88 },
  { skill: "Time Mgmt", value: 82 },
  { skill: "Teamwork", value: 90 },
];

const monthlyKPIs = [
  { month: "Jul", utilization: 82, satisfaction: 85 },
  { month: "Aug", utilization: 84, satisfaction: 87 },
  { month: "Sep", utilization: 86, satisfaction: 86 },
  { month: "Oct", utilization: 85, satisfaction: 88 },
  { month: "Nov", utilization: 87, satisfaction: 89 },
  { month: "Dec", utilization: 88, satisfaction: 90 },
];

const Performance = () => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { tasks, loading: tasksLoading } = useTasks();
  const { isManager } = useAuth();

  // Calculate team performance from real data
  const teamPerformance = useMemo(() => {
    if (!employees || employees.length === 0) return [];

    return employees
      .filter((emp) => emp.status === "active")
      .map((employee) => {
        // Count tasks assigned to this employee
        const employeeTasks = tasks.filter(
          (task) => task.assignee_id === employee.profile_id
        );
        const completedTasks = employeeTasks.filter(
          (task) => task.status === "done"
        ).length;
        const totalTasks = employeeTasks.length;

        // Calculate utilization based on completed vs total tasks (simulated)
        const utilization = totalTasks > 0 
          ? Math.min(Math.round((completedTasks / Math.max(totalTasks, 1)) * 100 + 70), 100)
          : Math.floor(Math.random() * 20) + 75; // Random between 75-95 if no tasks

        // Simulated rating (in real app, this would come from a reviews table)
        const rating = (Math.random() * 1.5 + 3.5).toFixed(1);

        // Determine trend based on task completion
        const trend = completedTasks > totalTasks / 2 ? "up" : totalTasks === 0 ? "same" : "down";

        const getInitials = (firstName: string, lastName: string) => {
          return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
        };

        return {
          id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          initials: getInitials(employee.first_name, employee.last_name),
          role: employee.job_title || "Employee",
          utilization,
          tasks: totalTasks,
          completedTasks,
          rating: parseFloat(rating as string),
          trend,
        };
      })
      .slice(0, 10); // Limit to top 10
  }, [employees, tasks]);

  // Calculate KPI summary stats
  const kpiStats = useMemo(() => {
    const avgUtilization = teamPerformance.length > 0
      ? Math.round(teamPerformance.reduce((sum, m) => sum + m.utilization, 0) / teamPerformance.length)
      : 0;

    const totalCompleted = teamPerformance.reduce((sum, m) => sum + m.completedTasks, 0);

    const avgRating = teamPerformance.length > 0
      ? (teamPerformance.reduce((sum, m) => sum + m.rating, 0) / teamPerformance.length).toFixed(1)
      : "0.0";

    const topPerformers = teamPerformance.filter((m) => m.utilization >= 90).length;

    return { avgUtilization, totalCompleted, avgRating, topPerformers };
  }, [teamPerformance]);

  const loading = employeesLoading || tasksLoading;

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Performance</h1>
          <p className="text-muted-foreground mt-1">
            Track team performance and development goals
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Utilization</p>
                <p className="text-2xl font-display font-bold mt-1">{kpiStats.avgUtilization}%</p>
                <p className="text-xs text-success mt-1">↑ Based on task completion</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-display font-bold mt-1">{kpiStats.totalCompleted}</p>
                <p className="text-xs text-muted-foreground mt-1">This period</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Rating</p>
                <p className="text-2xl font-display font-bold mt-1 flex items-center gap-1">
                  {kpiStats.avgRating} <Star className="h-5 w-5 text-warning fill-warning" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">Team average</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Award className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Performers</p>
                <p className="text-2xl font-display font-bold mt-1">{kpiStats.topPerformers}</p>
                <p className="text-xs text-success mt-1">Above 90% utilization</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* KPI Trends */}
        <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              KPI Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyKPIs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[70, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="utilization"
                    stroke="hsl(192, 82%, 28%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(192, 82%, 28%)", strokeWidth: 2, r: 4 }}
                    name="Utilization %"
                  />
                  <Line
                    type="monotone"
                    dataKey="satisfaction"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 2, r: 4 }}
                    name="Satisfaction %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Utilization</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="text-sm text-muted-foreground">Client Satisfaction</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills Radar */}
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg">Team Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Skills"
                    dataKey="value"
                    stroke="hsl(192, 82%, 28%)"
                    fill="hsl(192, 82%, 28%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Table */}
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg">Team Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {teamPerformance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No team members found
            </div>
          ) : (
            <div className="space-y-4">
              {teamPerformance.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all animate-fade-in"
                  style={{ animationDelay: `${500 + index * 50}ms` }}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      {member.trend === "up" && <ArrowUp className="h-4 w-4 text-success" />}
                      {member.trend === "down" && <ArrowDown className="h-4 w-4 text-destructive" />}
                      {member.trend === "same" && <Minus className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Utilization</p>
                      <div className="flex items-center gap-2">
                        <Progress value={member.utilization} className="w-20 h-2" />
                        <span className="text-sm font-medium">{member.utilization}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Tasks</p>
                      <p className="font-medium">{member.tasks}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Rating</p>
                      <p className="font-medium flex items-center gap-1">
                        {member.rating}
                        <Star className="h-3 w-3 text-warning fill-warning" />
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Performance;
