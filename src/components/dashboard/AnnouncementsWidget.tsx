import { Megaphone, Pin, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const announcements = [
  {
    id: 1,
    title: "Year-End Closing Procedures",
    content: "All timesheets must be submitted by December 30th for Q4 processing.",
    date: "Dec 24",
    pinned: true,
    type: "important",
  },
  {
    id: 2,
    title: "Office Holiday Hours",
    content: "The office will be closed December 25-26 for the holidays.",
    date: "Dec 23",
    pinned: false,
    type: "info",
  },
  {
    id: 3,
    title: "New Tax Software Training",
    content: "Mandatory training session scheduled for January 3rd, 2025.",
    date: "Dec 20",
    pinned: false,
    type: "event",
  },
];

export function AnnouncementsWidget() {
  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "450ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {announcements.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg bg-accent/30 border border-border hover:border-primary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.pinned && <Pin className="h-3 w-3 text-primary" />}
                  <h4 className="font-medium text-sm">{item.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.content}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${
                  item.type === "important"
                    ? "border-destructive/50 text-destructive"
                    : item.type === "event"
                    ? "border-info/50 text-info"
                    : "border-muted-foreground/50"
                }`}
              >
                {item.type}
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {item.date}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
