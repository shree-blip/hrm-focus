import { Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Holiday {
  date: Date;
  name: string;
  type: "public" | "company" | "optional";
}

const holidays: Holiday[] = [
  { date: new Date(2024, 11, 25), name: "Christmas Day", type: "public" },
  { date: new Date(2024, 11, 26), name: "Boxing Day", type: "public" },
  { date: new Date(2025, 0, 1), name: "New Year's Day", type: "public" },
  { date: new Date(2025, 0, 15), name: "Maghe Sankranti", type: "public" },
  { date: new Date(2025, 1, 14), name: "Valentine's Day", type: "optional" },
  { date: new Date(2025, 2, 8), name: "Maha Shivaratri", type: "public" },
  { date: new Date(2025, 2, 14), name: "Holi", type: "public" },
  { date: new Date(2025, 3, 14), name: "Nepali New Year", type: "public" },
  { date: new Date(2025, 4, 1), name: "May Day", type: "public" },
  { date: new Date(2025, 4, 29), name: "Republic Day", type: "public" },
  { date: new Date(2025, 6, 4), name: "Independence Day (US)", type: "public" },
  { date: new Date(2025, 9, 23), name: "Dashain", type: "public" },
  { date: new Date(2025, 10, 1), name: "Tihar", type: "public" },
  { date: new Date(2025, 10, 27), name: "Thanksgiving (US)", type: "public" },
  { date: new Date(2025, 11, 25), name: "Christmas Day", type: "public" },
];

export function CompanyCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const getHolidaysForMonth = (date: Date) => {
    return holidays.filter(
      h => h.date.getMonth() === date.getMonth() && h.date.getFullYear() === date.getFullYear()
    );
  };

  const isHoliday = (date: Date) => {
    return holidays.some(
      h => h.date.toDateString() === date.toDateString()
    );
  };

  const getHolidayInfo = (date: Date) => {
    return holidays.find(h => h.date.toDateString() === date.toDateString());
  };

  const selectedHoliday = selectedDate ? getHolidayInfo(selectedDate) : null;
  const currentMonthHolidays = selectedDate ? getHolidaysForMonth(selectedDate) : [];

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Company Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border"
          modifiers={{
            holiday: (date) => isHoliday(date),
          }}
          modifiersStyles={{
            holiday: {
              backgroundColor: "hsl(var(--primary) / 0.15)",
              color: "hsl(var(--primary))",
              fontWeight: "bold",
            },
          }}
        />

        {selectedHoliday && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="font-medium text-sm">{selectedHoliday.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedHoliday.date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <Badge variant="outline" className="mt-2 text-xs">
              {selectedHoliday.type === "public" ? "Public Holiday" : 
               selectedHoliday.type === "company" ? "Company Holiday" : "Optional Holiday"}
            </Badge>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Upcoming Holidays</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {currentMonthHolidays.length > 0 ? (
              currentMonthHolidays.map((holiday, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-accent/30">
                  <span>{holiday.name}</span>
                  <span className="text-muted-foreground">
                    {holiday.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No holidays this month</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
