import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Award, Target, Users, Star, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
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

const teamPerformance = [
  { name: "Sarah Johnson", initials: "SJ", role: "Staff Accountant", utilization: 92, tasks: 28, rating: 4.8, trend: "up" },
  { name: "Michael Chen", initials: "MC", role: "Tax Associate", utilization: 88, tasks: 24, rating: 4.6, trend: "up" },
  { name: "Emily Davis", initials: "ED", role: "Lead Bookkeeper", utilization: 85, tasks: 32, rating: 4.7, trend: "same" },
  { name: "Lisa Park", initials: "LP", role: "Tax Lead", utilization: 90, tasks: 30, rating: 4.9, trend: "up" },
  { name: "James Wilson", initials: "JW", role: "Intern", utilization: 75, tasks: 15, rating: 4.2, trend: "down" },
];

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
                <p className="text-2xl font-display font-bold mt-1">88%</p>
                <p className="text-xs text-success mt-1">↑ 3% from last month</p>
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
                <p className="text-2xl font-display font-bold mt-1">156</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
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
                  4.6 <Star className="h-5 w-5 text-warning fill-warning" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">Client satisfaction</p>
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
                <p className="text-2xl font-display font-bold mt-1">12</p>
                <p className="text-xs text-success mt-1">Above 90% target</p>
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
          <div className="space-y-4">
            {teamPerformance.map((member, index) => (
              <div
                key={member.name}
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
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Performance;
