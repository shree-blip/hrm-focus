import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, Award, Target, Users, Star, ArrowUp, ArrowDown, Minus,
  Loader2, Plus, MessageSquarePlus, FileText, Eye,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

import { usePerformance, type PeriodType } from "@/hooks/usePerformance";
import { usePerformanceReviews } from "@/hooks/usePerformanceReviews";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";

import { SubmitReviewDialog } from "@/components/performance/SubmitReviewDialog";
import { ViewReviewDialog } from "@/components/performance/ViewReviewDialog";
import { GiveFeedbackDialog } from "@/components/performance/GiveFeedbackDialog";
import { SetGoalDialog } from "@/components/performance/SetGoalDialog";
import { GoalsList } from "@/components/performance/GoalsList";

// ---- Period picker options ----
const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
];

const Performance = () => {
  const { isManager, isVP, isAdmin, user } = useAuth();
  const canManage = isManager || isVP || isAdmin;

  // Period filter
  const [period, setPeriod] = useState<PeriodType>("this-month");

  // Performance scores
  const { scores, kpis, loading: perfLoading, dateRange } = usePerformance(period);

  // Reviews, feedback, goals
  const {
    reviews, feedback, goals, loading: reviewsLoading,
    createReview, acknowledgeReview,
    createFeedback,
    createGoal, updateGoal, deleteGoal,
  } = usePerformanceReviews();

  // Employee list for dialogs
  const { employees } = useEmployees();
  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === "active").map(e => ({
      id: e.id, first_name: e.first_name, last_name: e.last_name,
    })),
    [employees]
  );

  // Dialog states
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [viewReview, setViewReview] = useState<typeof reviews[0] | null>(null);

  // Radar chart data from team averages
  const radarData = useMemo(() => {
    if (scores.length === 0) return [];
    const avgOf = (fn: (s: typeof scores[0]) => number) =>
      Math.round(scores.reduce((a, s) => a + fn(s), 0) / scores.length);
    return [
      { metric: "Utilization", value: avgOf(s => s.utilization) },
      { metric: "Task Delivery", value: avgOf(s => s.taskDelivery) },
      { metric: "Quality", value: avgOf(s => s.qualityScore) },
      { metric: "Reliability", value: avgOf(s => s.reliability) },
      { metric: "Score", value: avgOf(s => s.performanceScore) },
    ];
  }, [scores]);

  // Bar chart: top 10 employees by score
  const barData = useMemo(
    () => scores.slice(0, 10).map(s => ({
      name: s.employeeName.split(" ")[0],
      score: s.performanceScore,
      utilization: s.utilization,
      taskDelivery: s.taskDelivery,
    })),
    [scores]
  );

  // Check if the current user's employee record matches a review's employee_id
  const myEmployeeId = useMemo(() => {
    const me = employees.find(e => e.user_id === user?.id || e.profile_id === user?.id);
    return me?.id;
  }, [employees, user]);

  const loading = perfLoading || reviewsLoading;

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Performance</h1>
          <p className="text-muted-foreground mt-1">
            Real performance scores based on attendance, tasks &amp; reviews
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={v => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <>
              <Button size="sm" onClick={() => setShowReviewDialog(true)}>
                <FileText className="h-4 w-4 mr-1" /> Review
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowGoalDialog(true)}>
                <Target className="h-4 w-4 mr-1" /> Goal
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowFeedbackDialog(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-1" /> Feedback
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KPICard
          delay={100}
          title="Avg. Utilization"
          value={`${kpis.avgUtilization}%`}
          subtitle="Hours worked / expected"
          icon={<Target className="h-6 w-6 text-primary" />}
          iconBg="bg-primary/10"
        />
        <KPICard
          delay={150}
          title="Tasks Completed"
          value={kpis.totalTasksCompleted.toString()}
          subtitle={`${dateRange.start.toLocaleDateString()} – ${dateRange.end.toLocaleDateString()}`}
          icon={<TrendingUp className="h-6 w-6 text-success" />}
          iconBg="bg-success/10"
        />
        <KPICard
          delay={200}
          title="Avg. Score"
          value={kpis.avgScore.toString()}
          subtitle="Weighted composite /100"
          icon={<Award className="h-6 w-6 text-warning" />}
          iconBg="bg-warning/10"
        />
        <KPICard
          delay={250}
          title="Top Performers"
          value={kpis.topPerformers.toString()}
          subtitle={`Score ≥ 80 of ${kpis.totalEmployees}`}
          icon={<Users className="h-6 w-6 text-info" />}
          iconBg="bg-info/10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
        </TabsList>

        {/* ---- OVERVIEW TAB ---- */}
        <TabsContent value="overview" className="space-y-6">
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar chart */}
            <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Top Performance Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {barData.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="score" fill="hsl(192, 82%, 28%)" radius={[4, 4, 0, 0]} name="Score" />
                        <Bar dataKey="utilization" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Utilization" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">No data for this period</p>
                )}
              </CardContent>
            </Card>

            {/* Radar chart */}
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg">Team Averages</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Avg"
                          dataKey="value"
                          stroke="hsl(192, 82%, 28%)"
                          fill="hsl(192, 82%, 28%)"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Performance Table */}
          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
            <CardHeader>
              <CardTitle className="font-display text-lg">Employee Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No employees found for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Employee</th>
                        <th className="pb-2 font-medium text-center">Score</th>
                        <th className="pb-2 font-medium text-center hidden sm:table-cell">Utilization</th>
                        <th className="pb-2 font-medium text-center hidden md:table-cell">Task Delivery</th>
                        <th className="pb-2 font-medium text-center hidden md:table-cell">Quality</th>
                        <th className="pb-2 font-medium text-center hidden lg:table-cell">Reliability</th>
                        <th className="pb-2 font-medium text-center">Tasks</th>
                        <th className="pb-2 font-medium text-center hidden sm:table-cell">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s, idx) => (
                        <tr
                          key={s.employeeId}
                          className="border-b last:border-0 hover:bg-accent/30 transition-colors animate-fade-in"
                          style={{ animationDelay: `${500 + idx * 30}ms` }}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                  {s.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate flex items-center gap-1">
                                  {s.employeeName}
                                  {s.trend === "up" && <ArrowUp className="h-3.5 w-3.5 text-success" />}
                                  {s.trend === "down" && <ArrowDown className="h-3.5 w-3.5 text-destructive" />}
                                  {s.trend === "same" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{s.jobTitle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <ScoreBadge score={s.performanceScore} />
                          </td>
                          <td className="py-3 text-center hidden sm:table-cell">
                            <div className="flex items-center justify-center gap-1.5">
                              <Progress value={s.utilization} className="w-14 h-2" />
                              <span className="text-xs w-8">{s.utilization}%</span>
                            </div>
                          </td>
                          <td className="py-3 text-center hidden md:table-cell">
                            <span className="text-xs">{s.taskDelivery}%</span>
                          </td>
                          <td className="py-3 text-center hidden md:table-cell">
                            {s.avgQuality !== null ? (
                              <span className="text-xs flex items-center justify-center gap-0.5">
                                {s.avgQuality.toFixed(1)} <Star className="h-3 w-3 text-warning fill-warning" />
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 text-center hidden lg:table-cell">
                            <span className="text-xs">{s.reliability}%</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-xs">{s.tasksCompleted}/{s.tasksTotal}</span>
                          </td>
                          <td className="py-3 text-center hidden sm:table-cell">
                            <span className="text-xs">{s.hoursWorked}h</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- REVIEWS TAB ---- */}
        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Performance Reviews</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => setShowReviewDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Review
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No reviews yet</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/20 transition-colors cursor-pointer"
                      onClick={() => setViewReview(r)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{r.employee_name}</p>
                          <ReviewStatusBadge status={r.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.period_start} → {r.period_end} • by {r.reviewer_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {r.final_score !== null && (
                          <ScoreBadge score={r.final_score} />
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 360 Feedback list */}
          {feedback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">360° Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {feedback.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{f.to_name}</p>
                          <Badge variant="outline" className="text-xs capitalize">{f.category}</Badge>
                        </div>
                        {f.comment && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.comment}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">by {f.from_name}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= f.rating ? "text-warning fill-warning" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---- GOALS TAB ---- */}
        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Performance Goals</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => setShowGoalDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Goal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <GoalsList
                goals={goals}
                onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                onComplete={(id) => updateGoal(id, { status: "completed", progress: 100 })}
                onCancel={(id) => updateGoal(id, { status: "cancelled" })}
                onDelete={deleteGoal}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SubmitReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        employees={activeEmployees}
        onSubmit={createReview}
      />
      <ViewReviewDialog
        open={!!viewReview}
        onOpenChange={open => { if (!open) setViewReview(null); }}
        review={viewReview}
        onAcknowledge={acknowledgeReview}
        canAcknowledge={viewReview ? viewReview.employee_id === myEmployeeId : false}
      />
      <GiveFeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        employees={activeEmployees}
        onSubmit={createFeedback}
      />
      <SetGoalDialog
        open={showGoalDialog}
        onOpenChange={setShowGoalDialog}
        employees={activeEmployees}
        onSubmit={createGoal}
      />
    </DashboardLayout>
  );
};

// ---- Small components ----

function KPICard({ delay, title, value, subtitle, icon, iconBg }: {
  delay: number; title: string; value: string; subtitle: string;
  icon: React.ReactNode; iconBg: string;
}) {
  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-display font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    : score >= 60
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  return <Badge className={`${color} font-mono`}>{score}</Badge>;
}

function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    acknowledged: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };
  return <Badge className={map[status] || ""}>{status}</Badge>;
}

export default Performance;
