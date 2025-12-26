import { useState } from "react";
import { Megaphone, Pin, CalendarDays, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: number;
  title: string;
  content: string;
  fullContent?: string;
  date: string;
  pinned: boolean;
  type: "important" | "info" | "event";
}

const announcements: Announcement[] = [
  {
    id: 1,
    title: "Year-End Closing Procedures",
    content: "All timesheets must be submitted by December 30th for Q4 processing.",
    fullContent: "All timesheets must be submitted by December 30th for Q4 processing. This is crucial for our annual financial reporting. Please ensure all your hours are accurately logged, project codes are correct, and any outstanding expenses are submitted. Late submissions may delay year-end bonuses and could affect tax reporting. Contact the HR team if you have any questions or need assistance.",
    date: "Dec 24",
    pinned: true,
    type: "important",
  },
  {
    id: 2,
    title: "Office Holiday Hours",
    content: "The office will be closed December 25-26 for the holidays.",
    fullContent: "The office will be closed December 25-26 for the holidays. During this time, emergency support will be available via email. Normal business hours will resume on December 27th. We wish everyone a wonderful holiday season with their families. If you need access to the office during the closure, please contact the facilities team in advance for arrangements.",
    date: "Dec 23",
    pinned: false,
    type: "info",
  },
  {
    id: 3,
    title: "New Tax Software Training",
    content: "Mandatory training session scheduled for January 3rd, 2025.",
    fullContent: "Mandatory training session scheduled for January 3rd, 2025. All accounting and tax team members are required to attend. The training will cover the new TaxPro 2025 software features, updated compliance requirements, and workflow improvements. Session times: 9:00 AM - 12:00 PM (Nepal Team) and 2:00 PM - 5:00 PM (US Team). Virtual attendance options are available. Please confirm your attendance with your team lead.",
    date: "Dec 20",
    pinned: false,
    type: "event",
  },
];

export function AnnouncementsWidget() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  return (
    <>
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
              onClick={() => setSelectedAnnouncement(item)}
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

      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedAnnouncement?.pinned && <Pin className="h-4 w-4 text-primary" />}
              <DialogTitle className="font-display">{selectedAnnouncement?.title}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  selectedAnnouncement?.type === "important"
                    ? "border-destructive/50 text-destructive"
                    : selectedAnnouncement?.type === "event"
                    ? "border-info/50 text-info"
                    : "border-muted-foreground/50"
                }`}
              >
                {selectedAnnouncement?.type}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {selectedAnnouncement?.date}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedAnnouncement?.fullContent || selectedAnnouncement?.content}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
