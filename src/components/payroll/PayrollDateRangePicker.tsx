import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth, isBefore, isAfter, differenceInDays } from "date-fns";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface PayrollDateRangePickerProps {
  value: { from: Date; to: Date } | null;
  onChange: (range: { from: Date; to: Date } | null) => void;
}

export function PayrollDateRangePicker({ value, onChange }: PayrollDateRangePickerProps) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
    } else if (range?.from) {
      onChange({ from: range.from, to: range.from });
    } else {
      onChange(null);
    }
  };

  const rangeValid = value
    ? !isAfter(value.to, yesterday) && !isAfter(value.from, value.to) && differenceInDays(value.to, value.from) <= 31
    : false;

  const rangeTooLong = value ? differenceInDays(value.to, value.from) > 31 : false;
  const endInFuture = value ? isAfter(value.to, yesterday) : false;

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value
              ? `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`
              : "Select pay period"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value ? { from: value.from, to: value.to } : undefined}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={(date) => isAfter(date, yesterday)}
            defaultMonth={startOfMonth(subMonths(new Date(), 1))}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {value && rangeValid && (
        <div className="rounded-lg bg-secondary/50 p-3 text-sm">
          <p><strong>Pay Period:</strong> {differenceInDays(value.to, value.from) + 1} days</p>
          <p className="text-muted-foreground mt-1">
            Salary prorated: (Monthly Gross ÷ Standard Hours) × Payable Hours
          </p>
        </div>
      )}

      {endInFuture && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          End date must be before today.
        </div>
      )}
      {rangeTooLong && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          Pay period cannot exceed 31 days.
        </div>
      )}
    </div>
  );
}
