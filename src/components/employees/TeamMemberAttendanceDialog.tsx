import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
}

interface AttendanceLog {
  id: string;
  clock_in: string;
  clock_out: string | null;
  clock_type: string | null;
  total_break_minutes: number | null;
  notes: string | null;
  status: string | null;
}

interface TeamMemberAttendanceDialogProps {
  employee: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeamMemberAttendanceDialog({
  employee,
  open,
  onOpenChange,
}: TeamMemberAttendanceDialogProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employee) {
      fetchAttendance();
    }
  }, [open, employee, currentWeekStart]);

  const fetchAttendance = async () => {
    if (!employee) return;
    setLoading(true);

    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id, clock_in, clock_out, clock_type, total_break_minutes, notes, status")
      .eq("employee_id", employee.id)
      .gte("clock_in", currentWeekStart.toISOString())
      .lte("clock_in", weekEnd.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      setAttendanceLogs(data);
    }
    setLoading(false);
  };

  if (!employee) return null;

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const totalHours = attendanceLogs.reduce((sum, log) => {
    if (log.clock_in && log.clock_out) {
      const clockIn = new Date(log.clock_in);
      const clockOut = new Date(log.clock_out);
      const breakMinutes = log.total_break_minutes || 0;
      const diffMs = clockOut.getTime() - clockIn.getTime() - (breakMinutes * 60 * 1000);
      return sum + diffMs / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Attendance - {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(currentWeekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className="text-2xl font-bold text-foreground">{attendanceLogs.length}</p>
              <p className="text-xs text-muted-foreground">Days Logged</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className={cn(
                "text-2xl font-bold",
                totalHours >= 40 ? "text-success" : totalHours >= 32 ? "text-warning" : "text-destructive"
              )}>
                {Math.round((totalHours / 40) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Target Met</p>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="rounded-lg border">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No attendance logs for this week
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceLogs.map((log) => {
                      const clockIn = new Date(log.clock_in);
                      const clockOut = log.clock_out ? new Date(log.clock_out) : null;
                      const breakMinutes = log.total_break_minutes || 0;
                      
                      let hours = "-";
                      if (clockOut) {
                        const diffMs = clockOut.getTime() - clockIn.getTime() - (breakMinutes * 60 * 1000);
                        hours = `${(diffMs / (1000 * 60 * 60)).toFixed(2)}h`;
                      }
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {format(clockIn, "EEE, MMM d")}
                          </TableCell>
                          <TableCell>{format(clockIn, "hh:mm a")}</TableCell>
                          <TableCell>
                            {clockOut ? format(clockOut, "hh:mm a") : "-"}
                          </TableCell>
                          <TableCell>{breakMinutes > 0 ? `${breakMinutes}m` : "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              log.clock_type === "billable" && "border-info text-info bg-info/10",
                              log.clock_type === "payroll" && "border-primary text-primary bg-primary/10"
                            )}>
                              {log.clock_type || "payroll"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{hours}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
