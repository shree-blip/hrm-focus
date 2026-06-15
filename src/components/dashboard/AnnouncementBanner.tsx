import { useEffect, useRef, useState, useCallback } from "react";
import { Megaphone, X } from "lucide-react";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { isAfter, parseISO } from "date-fns";

const DISMISSED_KEY = "focus_announcement_banner_dismissed";
const PX_PER_SEC = 60; // scroll speed — raise = faster, lower = slower

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const { announcements, loading } = useAnnouncements();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<string[]>([]);

  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

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
    setDismissed(localStorage.getItem(dismissedKey) === "true");

    const active = filterActiveAnnouncements(announcements);
    setActiveAnnouncements(active.map((a) => `📢 ${a.title}`));
  }, [loading, user, announcements, filterActiveAnnouncements]);

  // Refresh the list when the next announcement expires
  useEffect(() => {
    if (loading || announcements.length === 0) return;

    const now = Date.now();
    const upcoming = announcements
      .filter((a) => a.is_active && a.expires_at)
      .map((a) => parseISO(a.expires_at!).getTime())
      .filter((t) => t > now);

    if (upcoming.length === 0) return;

    const delay = Math.min(...upcoming) - now + 100;
    const timer = setTimeout(() => {
      const active = filterActiveAnnouncements(announcements);
      setActiveAnnouncements(active.map((a) => `📢 ${a.title}`));
    }, delay);

    return () => clearTimeout(timer);
  }, [loading, announcements, filterActiveAnnouncements]);

  const tickerText = activeAnnouncements.join("      •      ");

  // Continuous, seamless marquee at a constant speed
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !tickerText) return;

    const start = () => {
      animRef.current?.cancel();
      const distance = track.scrollWidth / 2; // one copy (text + padding)
      if (distance <= 0) return;
      animRef.current = track.animate([{ transform: "translateX(0)" }, { transform: `translateX(-${distance}px)` }], {
        duration: (distance / PX_PER_SEC) * 1000,
        iterations: Infinity,
        easing: "linear",
      });
    };

    start();
    const ro = new ResizeObserver(start);
    ro.observe(track);

    return () => {
      ro.disconnect();
      animRef.current?.cancel();
    };
  }, [tickerText]);

  const handleDismiss = () => {
    if (!user) return;
    const dismissedKey = `${DISMISSED_KEY}_${user.id}_${new Date().toDateString()}`;
    localStorage.setItem(dismissedKey, "true");
    setDismissed(true);
  };

  if (loading || dismissed || activeAnnouncements.length === 0) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 relative w-full max-w-full overflow-x-clip rounded-xl">
      <div className="flex items-center gap-3 w-full max-w-full">
        <Megaphone className="h-4 w-4 flex-shrink-0" />

        <div
          className="relative flex-1 min-w-0 overflow-hidden cursor-pointer h-5"
          onClick={() => navigate("/announcements")}
          onMouseEnter={() => animRef.current?.pause()}
          onMouseLeave={() => animRef.current?.play()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/announcements");
          }}
          title="View all announcements"
        >
          <div
            ref={trackRef}
            className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform"
          >
            <span className="text-sm font-medium pr-12">{tickerText}</span>
            <span className="text-sm font-medium pr-12" aria-hidden="true">
              {tickerText}
            </span>
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
  );
}
