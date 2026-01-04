import { useState, useEffect, useRef } from "react";
import { Megaphone, X } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useAuth } from "@/contexts/AuthContext";
import { isAfter, parseISO } from "date-fns";

// You can add this to your tailwind.config.js or global CSS,
// or keep it here for a self-contained component.
const marqueeStyles = `
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .animate-marquee {
    animation: marquee 30s linear infinite;
    display: flex;
    min-width: 100%;
  }
  .animate-marquee:hover {
    animation-play-state: paused;
  }
`;

const DISMISSED_KEY = "focus_announcement_banner_dismissed";

export function AnnouncementBanner() {
  const { user } = useAuth();
  const { announcements, loading } = useAnnouncements();
  const [dismissed, setDismissed] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !user || announcements.length === 0) return;

    const dismissedKey = `${DISMISSED_KEY}_${user.id}_${new Date().toDateString()}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === "true";
    setDismissed(wasDismissed);

    // Filter active announcements that haven't expired
    const now = new Date();

    const active = announcements.filter((a) => {
      // Must be active
      if (!a.is_active) return false;

      // If expires_at is set, check if it's still valid
      if (a.expires_at) {
        const expiryDate = parseISO(a.expires_at);
        if (!isAfter(expiryDate, now)) return false;
      }

      return true;
    });

    if (active.length > 0) {
      const texts = active.map((a) => {
        const publisher = a.publisher_name ? ` — ${a.publisher_name}` : "";
        return `📢 ${a.title}: ${a.content}${publisher}`;
      });
      setActiveAnnouncements(texts);
    } else {
      setActiveAnnouncements([]);
    }
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
    <>
      <style>{marqueeStyles}</style>

      {/* Restored 'bg-primary' and 'text-primary-foreground'.
        Kept 'w-full' to ensure it spans the full screen width.
      */}
      <div className="bg-primary text-primary-foreground py-2 px-4 relative overflow-hidden w-full">
        <div className="flex items-center gap-3 w-full">
          <Megaphone className="h-4 w-4 flex-shrink-0" />

          <div className="flex-1 min-w-0 overflow-hidden relative" ref={scrollRef}>
            <div className="animate-marquee whitespace-nowrap flex items-center">
              <span className="text-sm font-medium px-4">{marqueeText}</span>
              <span className="text-sm font-medium px-4">{marqueeText}</span>
              <span className="text-sm font-medium px-4">{marqueeText}</span>
              <span className="text-sm font-medium px-4">{marqueeText}</span>
            </div>
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
    </>
  );
}
