import { useState } from "react";
import { Megaphone, Pin, CalendarDays, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { formatDistanceToNow, format } from "date-fns";

export function AnnouncementsWidget() {
  const { announcements, loading } = useAnnouncements();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d");
    } catch {
      return dateString;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "important":
        return "border-destructive/50 text-destructive";
      case "event":
        return "border-info/50 text-info";
      default:
        return "border-muted-foreground/50";
    }
  };

  if (loading) {
    return (
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "450ms", animationFillMode: "forwards" }}>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "450ms", animationFillMode: "forwards" }}>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Announcements
            {announcements.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {announcements.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements</p>
            </div>
          ) : (
            announcements.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedAnnouncement(item)}
                className="p-3 rounded-lg bg-accent/30 border border-border hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {item.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                      <h4 className="font-medium text-sm">{item.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${getTypeBadgeClass(item.type)}`}
                  >
                    {item.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(item.created_at)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedAnnouncement?.is_pinned && <Pin className="h-4 w-4 text-primary" />}
              <DialogTitle className="font-display">{selectedAnnouncement?.title}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${selectedAnnouncement ? getTypeBadgeClass(selectedAnnouncement.type) : ''}`}
              >
                {selectedAnnouncement?.type}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {selectedAnnouncement && formatDate(selectedAnnouncement.created_at)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedAnnouncement?.content}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
