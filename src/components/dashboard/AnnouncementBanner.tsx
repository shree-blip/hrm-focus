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

  const viewportRef = useRef<HTMLDivElement>(null); // visible (clipped) bar
  const measureRef = useRef<HTMLSpanElement>(null); // hidden single copy
  const trackRef = useRef<HTMLDivElement>(null); // moving row of copies
  const animRef = useRef<Animation | null>(null);
  const [dims, setDims] = useState({ copyW: 0, viewW: 0 });

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

  // Measure one copy's width and the visible bar width (re-measures on resize/font load)
  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const update = () => setDims({ copyW: measure.offsetWidth, viewW: viewport.offsetWidth });

    update();
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [tickerText]);

  // Enough copies to cover the whole bar edge-to-edge + 1 spare for the loop
  const copies = dims.copyW > 0 ? Math.max(2, Math.ceil(dims.viewW / dims.copyW) + 1) : 2;

  // Seamless marquee: shift by exactly one copy's width, constant speed
  useEffect(() => {
    const track = trackRef.current;
    if (!track || dims.copyW <= 0) return;

    animRef.current?.cancel();
    animRef.current = track.animate([{ transform: "translateX(0)" }, { transform: `translateX(-${dims.copyW}px)` }], {
      duration: (dims.copyW / PX_PER_SEC) * 1000,
      iterations: Infinity,
      easing: "linear",
    });
    return () => animRef.current?.cancel();
  }, [dims.copyW, copies]);

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
          ref={viewportRef}
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
          {/* hidden single copy — used only to measure one unit's width */}
          <span
            ref={measureRef}
            aria-hidden
            className="invisible absolute left-0 top-0 text-sm font-medium pr-12 whitespace-nowrap"
          >
            {tickerText}
          </span>

          {/* visible track: just enough copies to fill the bar, no gaps */}
          <div
            ref={trackRef}
            className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform"
          >
            {Array.from({ length: copies }).map((_, i) => (
              <span key={i} className="text-sm font-medium pr-12" aria-hidden={i > 0}>
                {tickerText}
              </span>
            ))}
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
