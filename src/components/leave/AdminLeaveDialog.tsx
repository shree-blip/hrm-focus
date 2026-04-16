import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Shield, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";

const LEAVE_TYPE_OPTIONS = [
  "Annual Leave",
  "Other Leave - Sick Leave",
  "Other Leave - Extension Request",
  "Other Leave - Medical Emergency",
  "Other Leave - Family Emergency",
  "Other Leave - Travel Complications",
  "Other Leave - Other Emergency",
  "Leave in Lieu",
  "Wedding Leave",
  "Bereavement Leave",
  "Maternity Leave",
  "Paternity Leave",
];

function getDeductionInfo(leaveType: string): { balance: string; description: string } {
  if (leaveType === "Annual Leave" || leaveType.startsWith("Other Leave")) {
    return { balance: "Annual Leave", description: "Deducted from the employee's Annual Leave balance." };
  }
  if (leaveType === "Leave in Lieu" || leaveType.startsWith("Leave on Lieu") || leaveType.startsWith("Leave on Leave")) {
    return { balance: "Leave in Lieu", description: "Deducted from the employee's Leave in Lieu balance." };
  }
  if (["Wedding Leave", "Bereavement Leave", "Maternity Leave", "Paternity Leave"].includes(leaveType)) {
    return { balance: "none", description: "Special leave — tracked separately, not deducted from Annual Leave." };
  }
  return { balance: "Annual Leave", description: "Deducted from the employee's Annual Leave balance." };
}

interface AdminLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: {
    user_id: string;
    leave_type: string;
    start_date: Date;
    end_date: Date;
    reason: string;
    days: number;
    is_half_day: boolean;
    half_day_period: string | null;
  }) => Promise<void>;
}

function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function AdminLeaveDialog({ open, onOpenChange, onSubmit }: AdminLeaveDialogProps) {
  const [employees, setEmployees] = useState<{ user_id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<string>("first_half");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmployees();
    } else {
      setSelectedUserId("");
      setLeaveType("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      setIsHalfDay(false);
      setHalfDayPeriod("first_half");
    }
  }, [open]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .not("user_id", "is", null)
      .order("first_name");

    if (data) {
      setEmployees(
        data
          .filter((p) => p.user_id)
          .map((p) => ({
            user_id: p.user_id!,
            name: `${p.first_name} ${p.last_name}`,
          }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId || !leaveType || !startDate || !reason) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    if (isHalfDay) {
      setSubmitting(true);
      await onSubmit({
        user_id: selectedUserId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: startDate,
        reason,
        days: 0.5,
        is_half_day: true,
        half_day_period: halfDayPeriod,
      });
      setSubmitting(false);
      onOpenChange(false);
      return;
    }

    if (!endDate) {
      toast({ title: "Missing Information", description: "Please select an end date.", variant: "destructive" });
      return;
    }

    const days = getBusinessDaysBetween(startDate, endDate);
    if (days === 0) {
      toast({ title: "Invalid Dates", description: "Selected dates fall on weekends.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    await onSubmit({
      user_id: selectedUserId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      days,
      is_half_day: false,
      half_day_period: null,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Assign Leave (Admin)
          </DialogTitle>
          <DialogDescription>Apply leave on behalf of an employee.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Leave Type */}
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Half Day Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="admin-half-day"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="admin-half-day" className="cursor-pointer">Half-Day Leave</Label>
              {isHalfDay && <Badge variant="secondary" className="text-xs">0.5 day</Badge>}
            </div>
            {isHalfDay && (
              <RadioGroup value={halfDayPeriod} onValueChange={setHalfDayPeriod} className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="first_half" id="admin-first-half" />
                  <Label htmlFor="admin-first-half" className="cursor-pointer text-sm">First Half (Morning)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="second_half" id="admin-second-half" />
                  <Label htmlFor="admin-second-half" className="cursor-pointer text-sm">Second Half (Afternoon)</Label>
                </div>
              </RadioGroup>
            )}
          </div>

          {/* Dates */}
          <div className={cn("grid gap-4", isHalfDay ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-2">
              <Label>{isHalfDay ? "Date" : "Start Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {!isHalfDay && (
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Days summary */}
          {startDate && (isHalfDay || endDate) && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Leave Duration</span>
                <Badge variant="secondary">
                  {isHalfDay ? "0.5" : endDate ? getBusinessDaysBetween(startDate, endDate) : 0} day{isHalfDay ? "" : "s"}
                </Badge>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="Reason for leave assignment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
            <Info className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              This leave will be auto-approved. {leaveType ? getDeductionInfo(leaveType).description : "Select a leave type to see deduction details."}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Assigning..." : "Assign Leave"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
