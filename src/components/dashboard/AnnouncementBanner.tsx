import { useEffect, useState, useCallback } from "react";
import { Megaphone, X } from "lucide-react";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { useAuth } from "@/contexts/AuthContext";
import { isAfter, parseISO } from "date-fns";

const DISMISSED_KEY = "focus_announcement_banner_dismissed";

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const { announcements, loading } = useAnnouncements();
  const [dismissed, setDismissed] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<string[]>([]);

  // Filter function to get currently active announcements
  const filterActiveAnnouncements = useCallback((items: Announcement[]) => {
    const now = new Date();
    return items.filter((a) => {
      if (!a.is_active) return false;
      if (a.expires_at) {
        const expiryDate = parseISO(a.expires_at);
        if (!isAfter(expiryDate, now)) return false;
      }
      return true;
    });
  }, []);

  // Update active announcements when data changes
  useEffect(() => {
    if (loading || !user) return;

    const dismissedKey = `${DISMISSED_KEY}_${user.id}_${new Date().toDateString()}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === "true";
    setDismissed(wasDismissed);

    const active = filterActiveAnnouncements(announcements);

    setActiveAnnouncements(
      active.map((a) => {
        const publisher = a.publisher_name ? ` — ${a.publisher_name}` : "";
        return `📢 ${a.title}: ${a.content}${publisher}`;
      }),
    );
  }, [loading, user, announcements, filterActiveAnnouncements]);

  // Auto-remove expired announcements from banner when their time comes
  useEffect(() => {
    if (loading || announcements.length === 0) return;

    const now = Date.now();

    // Find the next expiry time
    const upcomingExpiries = announcements
      .filter((a) => a.is_active && a.expires_at)
      .map((a) => parseISO(a.expires_at!).getTime())
      .filter((t) => t > now);

    if (upcomingExpiries.length === 0) return;

    const nextExpiry = Math.min(...upcomingExpiries);
    const delay = nextExpiry - now + 100; // 100ms buffer to ensure it's past expiry

    const timer = setTimeout(() => {
      // Re-filter and update when an announcement expires
      const active = filterActiveAnnouncements(announcements);

      setActiveAnnouncements(
        active.map((a) => {
          const publisher = a.publisher_name ? ` — ${a.publisher_name}` : "";
          return `📢 ${a.title}: ${a.content}${publisher}`;
        }),
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [loading, announcements, filterActiveAnnouncements]);

  const handleDismiss = () => {
    if (!user) return;
    const dismissedKey = `${DISMISSED_KEY}_${user.id}_${new Date().toDateString()}`;
    localStorage.setItem(dismissedKey, "true");
    setDismissed(true);
  };

  if (loading || dismissed || activeAnnouncements.length === 0) return null;

  const marqueeText = activeAnnouncements.join("      •      ");

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 relative w-full max-w-full overflow-x-clip">
      <div className="flex items-center gap-3 w-full max-w-full">
        <Megaphone className="h-4 w-4 flex-shrink-0" />

        <div className="relative flex-1 min-w-0 overflow-hidden">
          <div className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-marquee hover:[animation-play-state:paused] will-change-transform">
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
          </div>
          <div className="h-5" aria-hidden="true" />
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-primary-foreground/20 rounded transition-colors flex-shrink-0 ml-2"
          aria-label="Dismiss announcements"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
