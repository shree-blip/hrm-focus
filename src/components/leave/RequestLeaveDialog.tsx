import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Leave type configurations
const LEAVE_TYPES = {
  "Annual Leave": { days: 12, description: "Regular annual leave allocation" },
  "Special Leave": { days: null, description: "Select a category below" },
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

interface RequestLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: { type: string; startDate: Date; endDate: Date; reason: string }) => void;
}

export function RequestLeaveDialog({ open, onOpenChange, onSubmit }: RequestLeaveDialogProps) {
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [specialLeaveSubtype, setSpecialLeaveSubtype] = useState<SpecialLeaveSubtype | "">("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  // Auto-calculate end date based on leave type selection
  useEffect(() => {
    if (startDate && leaveType === "Special Leave" && specialLeaveSubtype) {
      const daysToAdd = SPECIAL_LEAVE_SUBTYPES[specialLeaveSubtype].days - 1;
      setEndDate(addDays(startDate, daysToAdd));
    }
  }, [startDate, leaveType, specialLeaveSubtype]);

  // Reset special leave subtype when leave type changes
  useEffect(() => {
    if (leaveType !== "Special Leave") {
      setSpecialLeaveSubtype("");
    }
  }, [leaveType]);

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

    if (endDate < startDate) {
      toast({
        title: "Invalid Dates",
        description: "End date must be after start date.",
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
    const actualLeaveType = leaveType === "Special Leave" ? specialLeaveSubtype : leaveType;

    onSubmit({
      type: actualLeaveType,
      startDate: adjustedStartDate,
      endDate: adjustedEndDate,
      reason,
    });

    // Reset form
    setLeaveType("");
    setSpecialLeaveSubtype("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
    onOpenChange(false);

    toast({
      title: "Leave Request Submitted",
      description: "Your leave request has been submitted for approval.",
    });
  };

  // Get the allocated days for the selected leave type
  const getAllocatedDays = () => {
    if (leaveType === "Special Leave" && specialLeaveSubtype) {
      return SPECIAL_LEAVE_SUBTYPES[specialLeaveSubtype].days;
    }
    if (leaveType && LEAVE_TYPES[leaveType].days) {
      return LEAVE_TYPES[leaveType].days;
    }
    return null;
  };

  // Calculate days between dates for Annual Leave
  const getCalculatedDays = () => {
    if (startDate && endDate) {
      return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Request Leave</DialogTitle>
          <DialogDescription>Submit a new leave request for approval.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Leave Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Annual Leave">
                  <div className="flex items-center gap-2">
                    <span>Annual Leave</span>
                    <Badge variant="secondary" className="text-xs">
                      12 days/year
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="Special Leave">
                  <div className="flex items-center gap-2">
                    <span>Special Leave</span>
                    <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">
                      Category based
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {leaveType && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {LEAVE_TYPES[leaveType].description}
              </p>
            )}
          </div>

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
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
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
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
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
                    disabled={(date) => (startDate ? date < startDate : false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Days Summary */}
          {startDate && (leaveType === "Annual Leave" ? endDate && getCalculatedDays() : getAllocatedDays()) && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Leave Duration</span>
                <Badge variant="secondary">
                  {leaveType === "Annual Leave" ? getCalculatedDays() : getAllocatedDays()} day
                  {(leaveType === "Annual Leave" ? getCalculatedDays() : getAllocatedDays()) !== 1 ? "s" : ""}
                </Badge>
              </div>
              {endDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  From {format(startDate, "MMM d, yyyy")} to {format(endDate, "MMM d, yyyy")}
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
