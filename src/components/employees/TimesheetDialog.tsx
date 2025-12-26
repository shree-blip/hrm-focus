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

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: string;
  initials: string;
  phone: string;
}

interface TimesheetDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock timesheet data
const generateTimesheetData = (employeeId: number) => {
  const today = new Date();
  const data = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    data.push({
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      clockIn: isWeekend ? "-" : "09:00 AM",
      clockOut: isWeekend ? "-" : "05:30 PM",
      breakTime: isWeekend ? "-" : "30 min",
      totalHours: isWeekend ? 0 : 8,
      status: isWeekend ? "weekend" : "complete",
    });
  }
  
  return data;
};

export function TimesheetDialog({
  employee,
  open,
  onOpenChange,
}: TimesheetDialogProps) {
  if (!employee) return null;

  const timesheetData = generateTimesheetData(employee.id);
  const totalWeekHours = timesheetData.reduce((sum, day) => sum + day.totalHours, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Timesheet - {employee.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className="text-2xl font-bold text-foreground">{totalWeekHours}h</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className="text-2xl font-bold text-foreground">160h</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/30 text-center">
              <p className="text-2xl font-bold text-success">92%</p>
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
            </div>
          </div>

          {/* Timesheet Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheetData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell>{row.clockIn}</TableCell>
                    <TableCell>{row.clockOut}</TableCell>
                    <TableCell>{row.breakTime}</TableCell>
                    <TableCell>{row.totalHours > 0 ? `${row.totalHours}h` : "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "complete"
                            ? "border-success/50 text-success bg-success/10"
                            : "border-muted-foreground/50 text-muted-foreground"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
