import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useAuth } from "@/contexts/AuthContext";
import { isAfter, parseISO } from "date-fns";

const DISMISSED_KEY = "focus_announcement_banner_dismissed";

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const { announcements, loading } = useAnnouncements();
  const [dismissed, setDismissed] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    if (loading || !user || announcements.length === 0) return;

    const dismissedKey = `${DISMISSED_KEY}_${user.id}_${new Date().toDateString()}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === "true";
    setDismissed(wasDismissed);

    const now = new Date();
    const active = announcements.filter((a) => {
      if (!a.is_active) return false;
      if (a.expires_at) {
        const expiryDate = parseISO(a.expires_at);
        if (!isAfter(expiryDate, now)) return false;
      }
      return true;
    });

    setActiveAnnouncements(
      active.map((a) => {
        const publisher = a.publisher_name ? ` — ${a.publisher_name}` : "";
        return `📢 ${a.title}: ${a.content}${publisher}`;
      })
    );
  }, [loading, user, announcements]);

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

        {/* Relative + absolute marquee prevents content from affecting page width */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          <div className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-marquee hover:[animation-play-state:paused] will-change-transform">
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
            <span className="text-sm font-medium px-4">{marqueeText}</span>
          </div>
          {/* Spacer to preserve banner height */}
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
