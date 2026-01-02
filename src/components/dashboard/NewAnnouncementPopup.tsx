import { useState, useEffect, useRef } from "react";
import { Megaphone, Pin, CalendarDays, ChevronLeft, ChevronRight, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isToday } from "date-fns";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { useAuth } from "@/contexts/AuthContext";

const LAST_SEEN_KEY = "focus_announcements_last_seen";
const SHOWN_TODAY_KEY = "focus_announcements_shown_today";

export function NewAnnouncementPopup() {
  const { user } = useAuth();
  const { announcements, loading } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const [newAnnouncements, setNewAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const shownAnnouncementsRef = useRef<Set<string>>(new Set());

  // Effect for initial load - show popup on first login of day
  useEffect(() => {
    if (loading || !user || announcements.length === 0) return;

    const storageKey = `${LAST_SEEN_KEY}_${user.id}`;
    const shownTodayKey = `${SHOWN_TODAY_KEY}_${user.id}`;
    const lastSeen = localStorage.getItem(storageKey);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
    
    const today = new Date().toDateString();
    const shownToday = localStorage.getItem(shownTodayKey);
    
    // If already shown today for initial load, don't show again
    if (shownToday === today && lastSeenDate) return;

    // Filter announcements created after last seen OR if it's first time
    const unseen = announcements.filter(a => {
      if (!lastSeenDate) return true;
      return new Date(a.created_at) > lastSeenDate;
    });

    // Also include pinned/important announcements
    const important = announcements.filter(a => 
      a.is_pinned || a.type === 'important'
    );

    // Combine and deduplicate
    const combined = [...new Map([...unseen, ...important].map(a => [a.id, a])).values()];

    if (combined.length > 0) {
      combined.forEach(a => shownAnnouncementsRef.current.add(a.id));
      setNewAnnouncements(combined);
      setCurrentIndex(0);
      setOpen(true);
      localStorage.setItem(shownTodayKey, today);
    }
  }, [loading, user?.id]); // Don't include announcements to avoid re-triggering

  // Effect for realtime new announcements - show popup for same-day announcements
  useEffect(() => {
    if (loading || !user || announcements.length === 0) return;

    // Find announcements created today that haven't been shown yet
    const todayAnnouncements = announcements.filter(a => {
      const createdDate = new Date(a.created_at);
      return isToday(createdDate) && !shownAnnouncementsRef.current.has(a.id);
    });

    if (todayAnnouncements.length > 0) {
      todayAnnouncements.forEach(a => shownAnnouncementsRef.current.add(a.id));
      setNewAnnouncements(todayAnnouncements);
      setCurrentIndex(0);
      setOpen(true);
    }
  }, [announcements, loading, user]);

  const handleClose = () => {
    if (!user) return;
    
    const storageKey = `${LAST_SEEN_KEY}_${user.id}`;
    localStorage.setItem(storageKey, new Date().toISOString());
    setOpen(false);
  };

  const handleNext = () => {
    if (currentIndex < newAnnouncements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "important":
        return "border-destructive/50 text-destructive bg-destructive/10";
      case "event":
        return "border-info/50 text-info bg-info/10";
      default:
        return "border-muted-foreground/50 bg-muted";
    }
  };

  if (!open || newAnnouncements.length === 0) return null;

  const current = newAnnouncements[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="font-display text-lg">
                {newAnnouncements.length > 1 
                  ? `New Announcements (${currentIndex + 1}/${newAnnouncements.length})`
                  : "New Announcement"
                }
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Welcome back! Here's what's new today.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-xl bg-accent/50 border border-border">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                {current.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                <h3 className="font-semibold text-lg">{current.title}</h3>
              </div>
              <Badge className={getTypeBadgeClass(current.type)}>
                {current.type}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {current.content}
            </p>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Posted by {current.publisher_name || 'System'}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {format(new Date(current.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            {newAnnouncements.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-colors ${
                  idx === currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentIndex < newAnnouncements.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                "Got it!"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
