import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info, AlertTriangle, Layers, Clock } from "lucide-react";
import { format, addDays, isWeekend, isSaturday, isSunday } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// Main Leave type configurations
const LEAVE_TYPES = {
  "Annual Leave": { days: 12, description: "Regular annual leave allocation" },
  "Special Leave": { days: null, description: "Select a category below" },
  "Leave on Leave": { days: null, description: "Request additional leave while on existing leave" },
} as const;

// Leave on Leave subtypes
const LEAVE_ON_LEAVE_SUBTYPES = {
  "Extension Request": { days: null, description: "Extend your current leave period" },
  "Medical Emergency": { days: null, description: "Unexpected medical situation during leave" },
  "Family Emergency": { days: null, description: "Urgent family matter requiring extended time" },
  "Travel Complications": { days: null, description: "Unable to return due to travel issues" },
  "Other Emergency": { days: null, description: "Other urgent circumstances" },
} as const;

// Special leave subtypes with their allocated days
const SPECIAL_LEAVE_SUBTYPES = {
  "Wedding Leave": { days: 15, description: "For your wedding celebration" },
  "Bereavement Leave": { days: 15, description: "For loss of immediate family" },
  "Maternity Leave": { days: 98, description: "Maternity leave for new mothers" },
  "Paternity Leave": { days: 22, description: "Paternity leave for new fathers" },
} as const;

type LeaveType = keyof typeof LEAVE_TYPES;
type SpecialLeaveSubtype = keyof typeof SPECIAL_LEAVE_SUBTYPES;
type LeaveOnLeaveSubtype = keyof typeof LEAVE_ON_LEAVE_SUBTYPES;

interface CurrentLeave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
}

interface RequestLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: { type: string; startDate: Date; endDate: Date; reason: string }) => void;
  isOnLeave?: boolean;
  currentLeave?: CurrentLeave | null;
}

/**
 * Count business days (excluding Saturday & Sunday) between two dates (inclusive).
 * Example: Feb 20 (Thu) to Feb 23 (Sun) = 2 business days (Thu + Fri)
 */
function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Add N business days to a start date, skipping weekends.
 * Returns the end date (the Nth business day from start, inclusive of start).
 * Example: addBusinessDays(Monday, 5) => Friday (same week)
 */
function addBusinessDays(start: Date, businessDays: number): Date {
  const result = new Date(start);
  // We already count the start date as day 1 (if it's a weekday)
  let remaining = businessDays;

  // If start is a weekend, move to next Monday first
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }

  // Start date counts as day 1
  remaining--;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  return result;
}

export function RequestLeaveDialog({
  open,
  onOpenChange,
  onSubmit,
  isOnLeave = false,
  currentLeave = null,
}: RequestLeaveDialogProps) {
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [specialLeaveSubtype, setSpecialLeaveSubtype] = useState<SpecialLeaveSubtype | "">("");
  const [leaveOnLeaveSubtype, setLeaveOnLeaveSubtype] = useState<LeaveOnLeaveSubtype | "">("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  // Auto-calculate end date based on leave type selection (using business days)
  useEffect(() => {
    if (startDate && leaveType === "Special Leave" && specialLeaveSubtype) {
      const allocatedDays = SPECIAL_LEAVE_SUBTYPES[specialLeaveSubtype].days;
      const calculatedEndDate = addBusinessDays(startDate, allocatedDays);
      setEndDate(calculatedEndDate);
    }
  }, [startDate, leaveType, specialLeaveSubtype]);

  // Reset subtypes when leave type changes
  useEffect(() => {
    if (leaveType !== "Special Leave") {
      setSpecialLeaveSubtype("");
    }
    if (leaveType !== "Leave on Leave") {
      setLeaveOnLeaveSubtype("");
    }
  }, [leaveType]);

  // Pre-fill start date for "Leave on Leave" when user is currently on leave
  useEffect(() => {
    if (leaveType === "Leave on Leave" && isOnLeave && currentLeave && open) {
      const dayAfterCurrentLeave = addDays(new Date(currentLeave.end_date), 1);
      setStartDate(dayAfterCurrentLeave);
    }
  }, [leaveType, isOnLeave, currentLeave, open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setLeaveType("");
      setSpecialLeaveSubtype("");
      setLeaveOnLeaveSubtype("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaveType || !startDate || !endDate || !reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (leaveType === "Special Leave" && !specialLeaveSubtype) {
      toast({
        title: "Missing Information",
        description: "Please select a special leave category.",
        variant: "destructive",
      });
      return;
    }

    if (leaveType === "Leave on Leave" && !leaveOnLeaveSubtype) {
      toast({
        title: "Missing Information",
        description: "Please select a reason for your leave on leave request.",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Invalid Dates",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }

    // Validate that the selected range has at least 1 business day
    const businessDays = getBusinessDaysBetween(startDate, endDate);
    if (businessDays === 0) {
      toast({
        title: "Invalid Date Range",
        description:
          "Your selected dates fall entirely on weekends. Please select dates that include at least one working day.",
        variant: "destructive",
      });
      return;
    }

    // Create dates at noon to avoid timezone issues
    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setHours(12, 0, 0, 0);
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(12, 0, 0, 0);

    // Determine the actual leave type to submit
    let actualLeaveType = leaveType;
    if (leaveType === "Special Leave") {
      actualLeaveType = specialLeaveSubtype as LeaveType;
    } else if (leaveType === "Leave on Leave") {
      actualLeaveType = `Leave on Leave - ${leaveOnLeaveSubtype}` as LeaveType;
    }

    onSubmit({
      type: actualLeaveType,
      startDate: adjustedStartDate,
      endDate: adjustedEndDate,
      reason,
    });

    // Reset form
    setLeaveType("");
    setSpecialLeaveSubtype("");
    setLeaveOnLeaveSubtype("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
    onOpenChange(false);

    toast({
      title: leaveType === "Leave on Leave" ? "Leave on Leave Request Submitted" : "Leave Request Submitted",
      description:
        leaveType === "Leave on Leave"
          ? "Your leave on leave request has been submitted for priority review."
          : "Your leave request has been submitted for approval.",
    });
  };

  // Get the allocated days for the selected leave type
  const getAllocatedDays = () => {
    if (leaveType === "Special Leave" && specialLeaveSubtype) {
      return SPECIAL_LEAVE_SUBTYPES[specialLeaveSubtype].days;
    }
    if (leaveType === "Annual Leave") {
      return LEAVE_TYPES["Annual Leave"].days;
    }
    return null;
  };

  // Calculate business days between dates (excluding Sat & Sun)
  const getCalculatedDays = () => {
    if (startDate && endDate) {
      return getBusinessDaysBetween(startDate, endDate);
    }
    return null;
  };

  const isLeaveOnLeave = leaveType === "Leave on Leave";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {isLeaveOnLeave ? (
              <>
                <Layers className="h-5 w-5 text-orange-500" />
                Leave on Lieu Request
              </>
            ) : (
              <>
                <CalendarIcon className="h-5 w-5 text-primary" />
                Request Leave
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLeaveOnLeave
              ? "Request additional time off while on existing approved leave."
              : "Submit a new leave request for approval."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Leave Type Selection - All 3 types always visible */}
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
              <SelectTrigger className={cn(isLeaveOnLeave && "border-orange-500/50 ring-orange-500/20")}>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {/* Annual Leave */}
                <SelectItem value="Annual Leave">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span>Annual Leave</span>
                    <Badge variant="secondary" className="text-xs">
                      12 days/year
                    </Badge>
                  </div>
                </SelectItem>

                {/* Special Leave */}
                <SelectItem value="Special Leave">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-warning" />
                    <span>Special Leave</span>
                    <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">
                      Category based
                    </Badge>
                  </div>
                </SelectItem>

                <Separator className="my-1" />

                {/* Leave on Leave - Always visible */}
                <SelectItem value="Leave on Leave" className="py-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Leave on Lieu</span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                    >
                      Priority
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {leaveType && leaveType !== "Leave on Leave" && leaveType !== "Special Leave" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {LEAVE_TYPES[leaveType]?.description}
              </p>
            )}
          </div>

          {/* Leave on Leave Subtype Selection */}
          {leaveType === "Leave on Leave" && (
            <div className="space-y-3 p-4 rounded-lg border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
              <Label htmlFor="leaveOnLeaveSubtype" className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-orange-500" />
                Reason for Leave on Lieu
              </Label>
              <Select
                value={leaveOnLeaveSubtype}
                onValueChange={(value) => setLeaveOnLeaveSubtype(value as LeaveOnLeaveSubtype)}
              >
                <SelectTrigger className="border-orange-500/30">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Extension Request">
                    <div className="flex items-center gap-2">
                      <span>Extension Request</span>
                      <Badge variant="outline" className="text-xs">
                        Common
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Medical Emergency">
                    <div className="flex items-center gap-2">
                      <span>Medical Emergency</span>
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                        Urgent
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Family Emergency">
                    <div className="flex items-center gap-2">
                      <span>Family Emergency</span>
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                        Urgent
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Travel Complications">
                    <div className="flex items-center gap-2">
                      <span>Travel Complications</span>
                      <Badge variant="outline" className="text-xs">
                        Logistics
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Other Emergency">
                    <div className="flex items-center gap-2">
                      <span>Other Emergency</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {leaveOnLeaveSubtype && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {LEAVE_ON_LEAVE_SUBTYPES[leaveOnLeaveSubtype].description}
                </p>
              )}

              {/* Info box for Leave on Leave */}
              <div className="mt-2 p-2 rounded-md bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  Leave on Lieu requests are flagged for priority manager review. Please provide detailed justification.
                </p>
              </div>

              {/* Show current leave info if user is on leave */}
              {isOnLeave && currentLeave && (
                <Alert className="mt-3 bg-orange-500/5 border-orange-500/20">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <AlertTitle className="text-orange-600 dark:text-orange-400 text-sm font-semibold">
                    Your Current Leave
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 text-xs">
                        {currentLeave.leave_type}
                      </Badge>
                      <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 text-xs">
                        Until {format(new Date(currentLeave.end_date), "MMM d, yyyy")}
                      </Badge>
                      <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 text-xs">
                        {currentLeave.days} days
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Special Leave Subtype Selection */}
          {leaveType === "Special Leave" && (
            <div className="space-y-2 p-4 rounded-lg border border-warning/20 bg-warning/5">
              <Label htmlFor="specialLeaveSubtype">Special Leave Category</Label>
              <Select
                value={specialLeaveSubtype}
                onValueChange={(value) => setSpecialLeaveSubtype(value as SpecialLeaveSubtype)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wedding Leave">
                    <div className="flex items-center gap-2">
                      <span>Wedding Leave</span>
                      <Badge variant="outline" className="text-xs">
                        15 days
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Bereavement Leave">
                    <div className="flex items-center gap-2">
                      <span>Bereavement Leave</span>
                      <Badge variant="outline" className="text-xs">
                        15 days
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Maternity Leave">
                    <div className="flex items-center gap-2">
                      <span>Maternity Leave</span>
                      <Badge variant="outline" className="text-xs">
                        98 days
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="Paternity Leave">
                    <div className="flex items-center gap-2">
                      <span>Paternity Leave</span>
                      <Badge variant="outline" className="text-xs">
                        22 days
                      </Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {specialLeaveSubtype && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {SPECIAL_LEAVE_SUBTYPES[specialLeaveSubtype].description}
                </p>
              )}
            </div>
          )}

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                      isLeaveOnLeave && "border-orange-500/30",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => {
                      // Disable weekends
                      if (date.getDay() === 0 || date.getDay() === 6) return true;
                      // If Leave on Leave and user is on leave, must start after current leave ends
                      if (isLeaveOnLeave && isOnLeave && currentLeave) {
                        const dayAfterCurrentLeave = addDays(new Date(currentLeave.end_date), 1);
                        return date < dayAfterCurrentLeave;
                      }
                      return date < new Date();
                    }}
                  />
                </PopoverContent>
              </Popover>
              {isLeaveOnLeave && isOnLeave && currentLeave && (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Starts after: {format(new Date(currentLeave.end_date), "MMM d, yyyy")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                      isLeaveOnLeave && "border-orange-500/30",
                    )}
                    disabled={leaveType === "Special Leave" && !!specialLeaveSubtype && !!startDate}
                  >
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
                    disabled={(date) => {
                      if (startDate && date < startDate) return true;
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Weekend notice */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            Saturdays and Sundays are not counted as leave days.
          </p>

          {/* Days Summary */}
          {startDate && endDate && getCalculatedDays() !== null && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                isLeaveOnLeave
                  ? "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/20"
                  : "bg-primary/5 border-primary/20",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isLeaveOnLeave ? "Additional Leave Duration" : "Leave Duration"}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(isLeaveOnLeave && "bg-orange-500/20 text-orange-600 dark:text-orange-400")}
                >
                  {getCalculatedDays()} working day{getCalculatedDays() !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {format(startDate, "MMM d, yyyy")} to {format(endDate, "MMM d, yyyy")}
                {(() => {
                  const totalCalendarDays =
                    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const businessDays = getCalculatedDays() || 0;
                  const weekendDays = totalCalendarDays - businessDays;
                  return weekendDays > 0 ? ` (${weekendDays} weekend day${weekendDays !== 1 ? "s" : ""} excluded)` : "";
                })()}
              </p>

              {/* Show total if Leave on Leave and user is on leave */}
              {isLeaveOnLeave && isOnLeave && currentLeave && (
                <div className="mt-2 pt-2 border-t border-orange-500/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Current leave:</span>
                    <span className="font-medium">{currentLeave.days} days</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Additional request:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      +{getCalculatedDays()} days
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Total if approved:</span>
                    <Badge className="bg-orange-500 text-white">
                      {currentLeave.days + (getCalculatedDays() || 0)} days
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              Reason
              {isLeaveOnLeave && (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                  Required
                </Badge>
              )}
            </Label>
            <Textarea
              id="reason"
              placeholder={
                isLeaveOnLeave
                  ? "Please provide detailed justification for your leave on lieu request. Include any relevant circumstances, documentation references, and expected return date..."
                  : "Please provide a reason for your leave request..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={isLeaveOnLeave ? 4 : 3}
              className={cn(isLeaveOnLeave && "border-orange-500/30")}
            />
            {isLeaveOnLeave && (
              <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Detailed explanation required for Leave on Lieu requests
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                isLeaveOnLeave &&
                  "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white",
              )}
            >
              {isLeaveOnLeave ? "Submit Leave on Lieu" : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
