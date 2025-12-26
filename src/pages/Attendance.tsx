import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Play,
  Square,
  Coffee,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const todayLogs = [
  { id: 1, name: "Sarah Johnson", initials: "SJ", clockIn: "08:45 AM", clockOut: "-", status: "working", hours: "4h 15m" },
  { id: 2, name: "Michael Chen", initials: "MC", clockIn: "09:00 AM", clockOut: "-", status: "break", hours: "3h 45m" },
  { id: 3, name: "Emily Davis", initials: "ED", clockIn: "08:30 AM", clockOut: "05:30 PM", status: "completed", hours: "8h 00m" },
  { id: 4, name: "Lisa Park", initials: "LP", clockIn: "09:15 AM", clockOut: "-", status: "working", hours: "3h 45m" },
  { id: 5, name: "James Wilson", initials: "JW", clockIn: "-", clockOut: "-", status: "absent", hours: "-" },
];

const weeklyData = [
  { day: "Mon", hours: 8.5, target: 8 },
  { day: "Tue", hours: 9.0, target: 8 },
  { day: "Wed", hours: 7.5, target: 8 },
  { day: "Thu", hours: 8.0, target: 8 },
  { day: "Fri", hours: 6.0, target: 8 },
  { day: "Sat", hours: 0, target: 0 },
  { day: "Sun", hours: 0, target: 0 },
];

const Attendance = () => {
  const [clockStatus, setClockStatus] = useState<"out" | "in" | "break">("out");
  const currentDate = new Date();

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Track time and manage attendance records
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Clock In/Out Card */}
        <Card className="lg:col-span-1 animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              My Time Clock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 rounded-xl bg-secondary/50 border border-border">
              <p className="text-5xl font-display font-bold tracking-wider">
                {currentDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-muted-foreground mt-2">
                {currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-3",
                  clockStatus === "in" && "border-success text-success bg-success/10",
                  clockStatus === "out" && "border-muted-foreground",
                  clockStatus === "break" && "border-warning text-warning bg-warning/10"
                )}
              >
                {clockStatus === "in" && "Currently Working"}
                {clockStatus === "out" && "Not Clocked In"}
                {clockStatus === "break" && "On Break"}
              </Badge>
            </div>

            <div className="flex gap-3">
              {clockStatus === "out" ? (
                <Button onClick={() => setClockStatus("in")} className="flex-1 gap-2" size="lg">
                  <Play className="h-4 w-4" />
                  Clock In
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setClockStatus(clockStatus === "break" ? "in" : "break")}
                    variant={clockStatus === "break" ? "default" : "secondary"}
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <Coffee className="h-4 w-4" />
                    {clockStatus === "break" ? "Resume" : "Break"}
                  </Button>
                  <Button
                    onClick={() => setClockStatus("out")}
                    variant="destructive"
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <Square className="h-4 w-4" />
                    Clock Out
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Overview */}
        <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Weekly Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">Dec 23 - Dec 29</span>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weeklyData.map((day, index) => (
                <div key={day.day} className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{day.day}</p>
                  <div
                    className={cn(
                      "relative h-24 rounded-lg bg-secondary/50 flex items-end justify-center pb-2 overflow-hidden",
                      index < 5 && day.hours === 0 && "border-2 border-dashed border-destructive/30"
                    )}
                  >
                    {day.hours > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary/80 transition-all duration-500"
                        style={{ height: `${(day.hours / 10) * 100}%` }}
                      />
                    )}
                    <span className={cn(
                      "relative z-10 text-sm font-semibold",
                      day.hours > 0 ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {day.hours > 0 ? `${day.hours}h` : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-display font-bold">39.0h</p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-success">97.5%</p>
                <p className="text-sm text-muted-foreground">Target Met</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold">1h</p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Attendance Table */}
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <Tabs defaultValue="today">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">Team Attendance</CardTitle>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Employee</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hours Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayLogs.map((log, index) => (
                <TableRow key={log.id} className="animate-fade-in" style={{ animationDelay: `${400 + index * 50}ms` }}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {log.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{log.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{log.clockIn}</TableCell>
                  <TableCell>{log.clockOut}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        log.status === "working" && "border-success text-success bg-success/10",
                        log.status === "break" && "border-warning text-warning bg-warning/10",
                        log.status === "completed" && "border-primary text-primary bg-primary/10",
                        log.status === "absent" && "border-destructive text-destructive bg-destructive/10"
                      )}
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{log.hours}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Attendance;
