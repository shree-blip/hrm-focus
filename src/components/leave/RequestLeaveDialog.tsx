import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info, AlertTriangle, Layers, Clock, FileText } from "lucide-react";
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
  "Leave on Lieu": {
    days: null,
    description: "Take a day off for a day you worked on a holiday/leave day",
  },
  "Other Leave": { days: null, description: "Select a reason category below" },
} as const;

// Other Leave subtypes (moved from old Leave on Leave)
const OTHER_LEAVE_SUBTYPES = {
  "Extension Request": {
    days: null,
    description: "Extend your current leave period",
  },
  "Medical Emergency": {
    days: null,
    description: "Unexpected medical situation requiring leave",
  },
  "Family Emergency": {
    days: null,
    description: "Urgent family matter requiring time off",
  },
  "Travel Complications": {
    days: null,
    description: "Unable to work due to travel issues",
  },
  "Other Emergency": { days: null, description: "Other urgent circumstances" },
} as const;

// Special leave subtypes with their allocated days
const SPECIAL_LEAVE_SUBTYPES = {
  "Wedding Leave": { days: 15, description: "For your wedding celebration" },
  "Bereavement Leave": {
    days: 15,
    description: "For loss of immediate family",
  },
  "Maternity Leave": {
    days: 98,
    description: "Maternity leave for new mothers",
  },
  "Paternity Leave": {
    days: 22,
    description: "Paternity leave for new fathers",
  },
} as const;
const isEmergencySubtype = (subtype: string) =>
  ["Medical Emergency", "Family Emergency", "Other Emergency"].includes(subtype);

type LeaveType = keyof typeof LEAVE_TYPES;
type SpecialLeaveSubtype = keyof typeof SPECIAL_LEAVE_SUBTYPES;
type OtherLeaveSubtype = keyof typeof OTHER_LEAVE_SUBTYPES;

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
 */
function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Add N business days to a start date, skipping weekends.
 */
function addBusinessDays(start: Date, businessDays: number): Date {
  const result = new Date(start);
  let remaining = businessDays;

  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }

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
  const [otherLeaveSubtype, setOtherLeaveSubtype] = useState<OtherLeaveSubtype | "">("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  // Leave on Lieu specific fields
  const [dateWorked, setDateWorked] = useState<Date>(); // The date they worked on a holiday/leave
  const [lieuLeaveDate, setLieuLeaveDate] = useState<Date>(); // The date they want to take off

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
    if (leaveType === "Other Leave") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [otherLeaveSubtype, leaveType]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setLeaveType("");
      setSpecialLeaveSubtype("");
      setOtherLeaveSubtype("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      setDateWorked(undefined);
      setLieuLeaveDate(undefined);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for Leave on Lieu
    if (leaveType === "Leave on Lieu") {
      if (!dateWorked || !lieuLeaveDate) {
        toast({
          title: "Missing Information",
          description: "Please select both the date you worked and the date you want off.",
          variant: "destructive",
        });
        return;
      }

      if (!reason) {
        toast({
          title: "Missing Information",
          description: "Please provide a brief description of the work done on that day.",
          variant: "destructive",
        });
        return;
      }

      const adjustedDateWorked = new Date(dateWorked);
      adjustedDateWorked.setHours(12, 0, 0, 0);
      const adjustedLieuDate = new Date(lieuLeaveDate);
      adjustedLieuDate.setHours(12, 0, 0, 0);

      onSubmit({
        type: `Leave on Lieu - ${format(dateWorked, "yyyy-MM-dd")}`,
        startDate: adjustedLieuDate,
        endDate: adjustedLieuDate,
        reason: `Worked on: ${format(dateWorked, "MMM d, yyyy")}. ${reason}`,
      });

      // Reset form
      setLeaveType("");
      setDateWorked(undefined);
      setLieuLeaveDate(undefined);
      setReason("");
      onOpenChange(false);

      toast({
        title: "Leave on Lieu Request Submitted",
        description: "Your lieu day request has been submitted for approval.",
      });
      return;
    }

    // Standard validation for other leave types
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

    if (leaveType === "Other Leave" && !otherLeaveSubtype) {
      toast({
        title: "Missing Information",
        description: "Please select a reason for your leave request.",
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

    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setHours(12, 0, 0, 0);
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(12, 0, 0, 0);

    // Determine the actual leave type to submit
    let actualLeaveType = leaveType as string;
    if (leaveType === "Special Leave") {
      actualLeaveType = specialLeaveSubtype as string;
    } else if (leaveType === "Other Leave") {
      actualLeaveType = `Other Leave - ${otherLeaveSubtype}`;
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
    setOtherLeaveSubtype("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
    onOpenChange(false);

    toast({
      title: "Leave Request Submitted",
      description: "Your leave request has been submitted for approval.",
    });
  };

  // Calculate business days between dates
  const getCalculatedDays = () => {
    if (startDate && endDate) {
      return getBusinessDaysBetween(startDate, endDate);
    }
    return null;
  };

  const isLeaveOnLieu = leaveType === "Leave on Lieu";
  const isOtherLeave = leaveType === "Other Leave";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {isLeaveOnLieu ? (
              <>
                <Layers className="h-5 w-5 text-orange-500" />
                Leave on Lieu Request
              </>
            ) : isOtherLeave ? (
              <>
                <FileText className="h-5 w-5 text-violet-500" />
                Other Leave Request
              </>
            ) : (
              <>
                <CalendarIcon className="h-5 w-5 text-primary" />
                Request Leave
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLeaveOnLieu
              ? "Request a day off in lieu of a day you worked on a holiday or leave day."
              : isOtherLeave
                ? "Submit an other leave request with reason for approval."
                : "Submit a new leave request for approval."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Leave Type Selection - All 4 types */}
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
              <SelectTrigger
                className={cn(
                  isLeaveOnLieu && "border-orange-500/50 ring-orange-500/20",
                  isOtherLeave && "border-violet-500/50 ring-violet-500/20",
                )}
              >
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

                {/* Leave on Lieu */}
                <SelectItem value="Leave on Lieu" className="py-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Leave on Lieu</span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                    >
                      Date based
                    </Badge>
                  </div>
                </SelectItem>

                {/* Other Leave */}
                <SelectItem value="Other Leave" className="py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" />
                    <span className="font-medium">Other</span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                    >
                      Reason based
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {leaveType && !isLeaveOnLieu && !isOtherLeave && leaveType !== "Special Leave" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {LEAVE_TYPES[leaveType]?.description}
              </p>
            )}
          </div>

          {/* ========== LEAVE ON LIEU SECTION ========== */}
          {isLeaveOnLieu && (
            <div className="space-y-4 p-4 rounded-lg border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                  Leave on Lieu Details
                </span>
              </div>

              {/* Date Worked (the holiday/leave day they worked on) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-orange-500" />
                  Date You Worked (Holiday/Leave Day)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-orange-500/30",
                        !dateWorked && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateWorked ? format(dateWorked, "PPP") : "Select the date you worked"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={dateWorked}
                      onSelect={setDateWorked}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => {
                        // Can only select past dates or today (they already worked)
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(0, 0, 0, 0);
                        return date >= tomorrow;
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Select the date you worked on a public holiday or scheduled leave day
                </p>
              </div>

              {/* Date to Take Off (the lieu day) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-orange-500" />
                  Date You Want Off (Lieu Day)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-orange-500/30",
                        !lieuLeaveDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {lieuLeaveDate ? format(lieuLeaveDate, "PPP") : "Select the date you want off"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={lieuLeaveDate}
                      onSelect={setLieuLeaveDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => {
                        // Disable weekends and past dates
                        if (date.getDay() === 0 || date.getDay() === 6) return true;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Select the working day you want to take off in lieu</p>
              </div>

              {/* Summary */}
              {dateWorked && lieuLeaveDate && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-orange-600 dark:text-orange-400">Lieu Day Summary</span>
                    <Badge className="bg-orange-500 text-white">1 day</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Worked on:</span>
                      <span className="font-medium text-foreground">{format(dateWorked, "MMM d, yyyy (EEEE)")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Day off:</span>
                      <span className="font-medium text-foreground">{format(lieuLeaveDate, "MMM d, yyyy (EEEE)")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="p-2 rounded-md bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Leave on Lieu is for employees who worked on a public holiday or during approved leave. Select the
                  date you worked and the date you'd like off.
                </p>
              </div>
            </div>
          )}

          {/* ========== OTHER LEAVE SECTION ========== */}
          {isOtherLeave && (
            <div className="space-y-3 p-4 rounded-lg border-2 border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
              <Label htmlFor="otherLeaveSubtype" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                Reason Category
              </Label>
              <Select
                value={otherLeaveSubtype}
                onValueChange={(value) => setOtherLeaveSubtype(value as OtherLeaveSubtype)}
              >
                <SelectTrigger className="border-violet-500/30">
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
              {otherLeaveSubtype && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {OTHER_LEAVE_SUBTYPES[otherLeaveSubtype].description}
                </p>
              )}

              <div className="mt-2 p-2 rounded-md bg-violet-500/10 border border-violet-500/20">
                <p className="text-xs text-violet-600 dark:text-violet-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  Other leave requests require manager approval. Please provide detailed justification.
                </p>
              </div>
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

          {/* Date Selection - NOT shown for Leave on Lieu (has its own date pickers) */}
          {!isLeaveOnLieu && (
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
                        isOtherLeave && "border-violet-500/30",
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
                        if (date.getDay() === 0 || date.getDay() === 6) return true;
                        if (isOtherLeave && isEmergencySubtype(otherLeaveSubtype)) return false; // allow past dates
                        return date < new Date();
                      }}
                    />
                  </PopoverContent>
                </Popover>
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
                        isOtherLeave && "border-violet-500/30",
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
                        if (isOtherLeave && isEmergencySubtype) return false;
                        if (date.getDay() === 0 || date.getDay() === 6) return true;
                        return false;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Weekend notice - not for Leave on Lieu */}
          {!isLeaveOnLieu && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Saturdays and Sundays are not counted as leave days.
            </p>
          )}

          {/* Days Summary - not for Leave on Lieu */}
          {!isLeaveOnLieu && startDate && endDate && getCalculatedDays() !== null && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                isOtherLeave
                  ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20"
                  : "bg-primary/5 border-primary/20",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Leave Duration</span>
                <Badge
                  variant="secondary"
                  className={cn(isOtherLeave && "bg-violet-500/20 text-violet-600 dark:text-violet-400")}
                >
                  {getCalculatedDays()} working day
                  {getCalculatedDays() !== 1 ? "s" : ""}
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
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              {isLeaveOnLieu ? "Description of Work Done" : "Reason"}
              {(isLeaveOnLieu || isOtherLeave) && (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                  Required
                </Badge>
              )}
            </Label>
            <Textarea
              id="reason"
              placeholder={
                isLeaveOnLieu
                  ? "Describe the work you performed on the holiday/leave day (e.g., 'Covered weekend shift for project deployment on Saturday Jan 15')..."
                  : isOtherLeave
                    ? "Please provide detailed justification for your leave request..."
                    : "Please provide a reason for your leave request..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={isLeaveOnLieu || isOtherLeave ? 3 : 3}
              className={cn(isLeaveOnLieu && "border-orange-500/30", isOtherLeave && "border-violet-500/30")}
            />
            {isLeaveOnLieu && (
              <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Briefly describe what work was done on the holiday/leave day
              </p>
            )}
            {isOtherLeave && (
              <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Detailed explanation required for other leave requests
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
                isLeaveOnLieu &&
                  "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white",
                isOtherLeave &&
                  "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white",
              )}
            >
              {isLeaveOnLieu ? "Submit Lieu Request" : isOtherLeave ? "Submit Other Leave" : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
