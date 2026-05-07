import { useState, useEffect, useMemo, useCallback } from "react";
import { Globe, X, Search, Clock, Calendar, Trash2, Sun, Moon, Sunrise, Sunset } from "lucide-react";

// ─── Timezone Database ───────────────────────────────────────────────
interface TZInfo {
  label: string;
  iana: string;
  abbr: string;
  region: string;
}

function getAbbr(iana: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || "";
  } catch {
    return "";
  }
}

function ianaToLabel(iana: string): string {
  const parts = iana.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function ianaToRegion(iana: string): string {
  const first = iana.split("/")[0];
  const map: Record<string, string> = {
    America: "Americas",
    US: "Americas",
    Canada: "Americas",
    Europe: "Europe",
    Asia: "Asia",
    Africa: "Africa",
    Australia: "Oceania",
    Pacific: "Oceania",
    Indian: "Indian Ocean",
    Atlantic: "Atlantic",
    Antarctica: "Antarctica",
    Arctic: "Arctic",
  };
  return map[first] || first;
}

function buildFullTimezoneDB(): TZInfo[] {
  let allIana: string[] = [];
  try {
    allIana = (Intl as any).supportedValuesOf("timeZone");
  } catch {
    allIana = FALLBACK_IANA_LIST;
  }
  return allIana
    .filter((iana: string) => iana.includes("/"))
    .map((iana: string) => ({
      label: ianaToLabel(iana),
      iana,
      abbr: getAbbr(iana),
      region: ianaToRegion(iana),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const FALLBACK_IANA_LIST = [
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Addis_Ababa",
  "Africa/Algiers",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Dar_es_Salaam",
  "Africa/Johannesburg",
  "Africa/Kampala",
  "Africa/Khartoum",
  "Africa/Lagos",
  "Africa/Maputo",
  "Africa/Nairobi",
  "Africa/Tunis",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Costa_Rica",
  "America/Denver",
  "America/Edmonton",
  "America/Guatemala",
  "America/Halifax",
  "America/Havana",
  "America/Jamaica",
  "America/Lima",
  "America/Los_Angeles",
  "America/Managua",
  "America/Manaus",
  "America/Mexico_City",
  "America/Monterrey",
  "America/Montevideo",
  "America/New_York",
  "America/Panama",
  "America/Phoenix",
  "America/Puerto_Rico",
  "America/Regina",
  "America/Santiago",
  "America/Santo_Domingo",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Tegucigalpa",
  "America/Toronto",
  "America/Vancouver",
  "America/Winnipeg",
  "Asia/Almaty",
  "Asia/Amman",
  "Asia/Baghdad",
  "Asia/Baku",
  "Asia/Bangkok",
  "Asia/Beirut",
  "Asia/Bishkek",
  "Asia/Brunei",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Gaza",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Irkutsk",
  "Asia/Istanbul",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Kamchatka",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Krasnoyarsk",
  "Asia/Kuala_Lumpur",
  "Asia/Kuwait",
  "Asia/Macau",
  "Asia/Magadan",
  "Asia/Manila",
  "Asia/Muscat",
  "Asia/Nicosia",
  "Asia/Novosibirsk",
  "Asia/Omsk",
  "Asia/Phnom_Penh",
  "Asia/Pyongyang",
  "Asia/Qatar",
  "Asia/Rangoon",
  "Asia/Riyadh",
  "Asia/Sakhalin",
  "Asia/Samarkand",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tbilisi",
  "Asia/Tehran",
  "Asia/Thimphu",
  "Asia/Tokyo",
  "Asia/Ulaanbaatar",
  "Asia/Vladivostok",
  "Asia/Yakutsk",
  "Asia/Yekaterinburg",
  "Asia/Yerevan",
  "Atlantic/Azores",
  "Atlantic/Canary",
  "Atlantic/Cape_Verde",
  "Atlantic/Reykjavik",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Chisinau",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kaliningrad",
  "Europe/Kiev",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Minsk",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Samara",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Indian/Maldives",
  "Indian/Mauritius",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Easter",
  "Pacific/Fiji",
  "Pacific/Gambier",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Marquesas",
  "Pacific/Midway",
  "Pacific/Noumea",
  "Pacific/Pago_Pago",
  "Pacific/Samoa",
  "Pacific/Tahiti",
  "Pacific/Tongatapu",
];

const FULL_TIMEZONE_DB: TZInfo[] = buildFullTimezoneDB();

const QUICK_ADD_IANA = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Kathmandu",
];

const QUICK_ADD_DB: TZInfo[] = QUICK_ADD_IANA.map((iana) => FULL_TIMEZONE_DB.find((tz) => tz.iana === iana)).filter(
  Boolean,
) as TZInfo[];

// US timezone presets
const US_ZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

const US_TIMEZONE_PRESETS: TZInfo[] = Object.keys(US_ZONE_LABELS).map((iana) => {
  const found = FULL_TIMEZONE_DB.find((tz) => tz.iana === iana);
  return found || { label: ianaToLabel(iana), iana, abbr: getAbbr(iana), region: "Americas" };
});

// ─── Helpers ─────────────────────────────────────────────────────────

// STEP 1: New helper — extracts year/month/day/hour/minute/second as
// plain numbers via Intl, so we never parse a locale string back into Date.
function getPartsInZone(iana: string, refDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(refDate);
  const get = (type: string) => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  return {
    year: get("year"),
    month: get("month"), // 1-based
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"), // midnight edge case
    minute: get("minute"),
    second: get("second"),
  };
}

function getTimeInZone(iana: string, refDate: Date): Date {
  // STEP 2: Build Date from numeric parts instead of parsing locale string
  try {
    const p = getPartsInZone(iana, refDate);
    return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  } catch {
    return new Date(NaN);
  }
}

function formatTime(date: Date, use24h = false): string {
  // STEP 5: Guard against Invalid Date
  if (!date || isNaN(date.getTime())) return "--:--";
  if (use24h) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(date: Date): string {
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(date: Date): string {
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getOffsetHours(iana: string, refDate: Date): number {
  // STEP 3: Compare numeric parts in UTC vs target zone
  const utc = getPartsInZone("UTC", refDate);
  const tz = getPartsInZone(iana, refDate);
  const utcMins = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute, utc.second) / 60000;
  const tzMins = Date.UTC(tz.year, tz.month - 1, tz.day, tz.hour, tz.minute, tz.second) / 60000;
  return (tzMins - utcMins) / 60;
}

function getOffsetLabel(iana: string, refDate: Date): string {
  // STEP 4: Format fractional offsets as GMT+5:45 instead of GMT+5.75
  const h = getOffsetHours(iana, refDate);
  if (isNaN(h)) return "GMT";
  const sign = h >= 0 ? "+" : "-";
  const absH = Math.abs(h);
  const hours = Math.floor(absH);
  const mins = Math.round((absH - hours) * 60);
  if (mins === 0) return `GMT${sign}${hours}`;
  return `GMT${sign}${hours}:${String(mins).padStart(2, "0")}`;
}

function getTimeOfDayIcon(hour: number) {
  if (hour >= 6 && hour < 12) return <Sunrise className="w-3.5 h-3.5 text-amber-500" />;
  if (hour >= 12 && hour < 18) return <Sun className="w-3.5 h-3.5 text-yellow-500" />;
  if (hour >= 18 && hour < 21) return <Sunset className="w-3.5 h-3.5 text-orange-500" />;
  return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
}

function detectLocalTimezone(): TZInfo {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const found = FULL_TIMEZONE_DB.find((tz) => tz.iana === iana);
  if (found) return found;
  const parts = iana.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  return { label: city, iana, abbr: getAbbr(iana), region: "Local" };
}

// ═══════════════════════════════════════════════════════════════════════
// SMALL CARD WIDGET (for sidebar / header)
// ═══════════════════════════════════════════════════════════════════════
export function GlobalTimeZoneWidget() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const localTz = useMemo(() => detectLocalTimezone(), []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localTime = getTimeInZone(localTz.iana, now);

  return (
    <>
      {/* <div
        onClick={() => setOpen(true)}
        className="group cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Time Zones</h3>
        </div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{formatTime(localTime)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {localTz.label} ({localTz.abbr || "Local"})
        </p>
        <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Click to compare zones →
        </p>
      </div>

      {open && <TimeZoneModal onClose={() => setOpen(false)} />} */}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FULL MODAL
// ═══════════════════════════════════════════════════════════════════════
export function TimeZoneModal({ onClose }: { onClose: () => void }) {
  const localTz = useMemo(() => detectLocalTimezone(), []);

  // Store a millisecond offset from real "now" — when user changes time,
  // we adjust this offset so the clock keeps ticking from the new point.
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(new Date());

  // Always tick — the displayed time = real now + offsetMs
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // refDate is always "now + user's offset" — it keeps ticking
  const refDate = new Date(now.getTime() + offsetMs);

  const [selectedZones, setSelectedZones] = useState<TZInfo[]>(() => {
    if (localTz.iana !== "Asia/Kathmandu") {
      const nepal = FULL_TIMEZONE_DB.find((tz) => tz.iana === "Asia/Kathmandu");
      return nepal ? [nepal] : [];
    }
    return [];
  });
  const [search, setSearch] = useState("");
  const [use24h, setUse24h] = useState(false);
  const [refZone, setRefZone] = useState<string>(localTz.iana);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Search
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return FULL_TIMEZONE_DB.filter(
      (tz) =>
        (tz.label.toLowerCase().includes(q) ||
          tz.abbr.toLowerCase().includes(q) ||
          tz.region.toLowerCase().includes(q) ||
          tz.iana.toLowerCase().includes(q)) &&
        tz.iana !== localTz.iana &&
        !selectedZones.some((s) => s.iana === tz.iana),
    ).slice(0, 12);
  }, [search, selectedZones, localTz]);

  const addZone = useCallback(
    (tz: TZInfo) => {
      if (!selectedZones.some((s) => s.iana === tz.iana)) {
        setSelectedZones((prev) => [...prev, tz]);
      }
      setSearch("");
    },
    [selectedZones],
  );

  const removeZone = useCallback((iana: string) => {
    setSelectedZones((prev) => prev.filter((z) => z.iana !== iana));
  }, []);

  const quickAddZones = useMemo(() => {
    return QUICK_ADD_DB.filter((tz) => tz.iana !== localTz.iana && !selectedZones.some((s) => s.iana === tz.iana));
  }, [localTz, selectedZones]);

  // STEP 6: Derive input values from getPartsInZone (never touches Invalid Date)
  const refParts = getPartsInZone(refZone, refDate);
  const refTimeStr = `${String(refParts.hour).padStart(2, "0")}:${String(refParts.minute).padStart(2, "0")}`;
  const refDateStr = `${refParts.year}-${String(refParts.month).padStart(2, "0")}-${String(refParts.day).padStart(2, "0")}`;

  // Local time for display
  const localTime = getTimeInZone(localTz.iana, refDate);
  const localOffsetLabel = getOffsetLabel(localTz.iana, refDate);

  // Get friendly name for selected ref zone
  const refZoneName = useMemo(() => {
    if (refZone === localTz.iana) return `${localTz.label} (${localTz.abbr})`;
    const usLabel = US_ZONE_LABELS[refZone];
    const tz = US_TIMEZONE_PRESETS.find((t) => t.iana === refZone);
    if (usLabel && tz) return `${usLabel} (${tz.abbr})`;
    return refZone;
  }, [refZone, localTz]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val || !val.includes(":")) return;
    const [h, m] = val.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const currentParts = getPartsInZone(refZone, refDate);
    const currentMins = currentParts.hour * 60 + currentParts.minute;
    const desiredMins = h * 60 + m;
    const diffMs = (desiredMins - currentMins) * 60 * 1000;
    setOffsetMs((prev) => prev + diffMs);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const parts = val.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    const [yr, mo, dy] = parts;
    const currentParts = getPartsInZone(refZone, refDate);
    const currentUtc = Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day);
    const desiredUtc = Date.UTC(yr, mo - 1, dy);
    const diffMs = desiredUtc - currentUtc;
    setOffsetMs((prev) => prev + diffMs);
  };

  const resetToNow = () => {
    setOffsetMs(0);
    setRefZone(localTz.iana);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Globe className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Global Time Zone Calculator</h2>
              <p className="text-xs text-muted-foreground">Compare times across multiple time zones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={use24h}
                onChange={(e) => setUse24h(e.target.checked)}
                className="rounded"
              />
              24h
            </label>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ═══════════════════════════════════════════════════
              TOP SECTION: Local Time (left) + US Zones (right)
              ═══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── LEFT: Local Time + Controls ──────────────── */}
            <div className="rounded-xl border border-border p-5 bg-muted/30">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-foreground text-sm">Your Local Time</h3>
                {offsetMs === 0 && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
              </div>

              {/* City + offset */}
              <p className="text-xs text-muted-foreground">
                {localTz.label} ({localOffsetLabel})
              </p>

              {/* Big time */}
              <div className="text-4xl font-bold text-foreground tabular-nums mt-1">
                {formatTime(localTime, use24h)}
              </div>

              {/* Date */}
              <p className="text-sm text-muted-foreground mt-1">{formatDate(localTime)}</p>

              {/* ── Reference zone selector + time/date inputs ── */}
              <div className="space-y-3 mt-4 pt-4 border-t border-border">
                {/* Zone selector */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                    Setting time as seen in
                  </label>
                  <div className="relative group">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <select
                      value={refZone}
                      onChange={(e) => {
                        setRefZone(e.target.value);
                      }}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground text-sm font-medium shadow-sm hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value={localTz.iana}>
                        🏠 {localTz.label} ({localTz.abbr})
                      </option>
                      <optgroup label="🇺🇸 US Zones">
                        {US_TIMEZONE_PRESETS.map((tz) => (
                          <option key={tz.iana} value={tz.iana}>
                            {US_ZONE_LABELS[tz.iana]} — {tz.abbr}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  {refZone !== localTz.iana && (
                    <p className="text-[11px] text-primary/80 mt-1.5">
                      Entering time from <span className="font-semibold">{refZoneName}</span> perspective
                    </p>
                  )}
                </div>

                {/* Time & Date inputs */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">Change Time</label>
                    <div className="relative group">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="time"
                        value={refTimeStr}
                        onChange={handleTimeChange}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground text-sm font-medium tabular-nums shadow-sm hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">Change Date</label>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="date"
                        value={refDateStr}
                        onChange={handleDateChange}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground text-sm font-medium tabular-nums shadow-sm hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  {offsetMs !== 0 && (
                    <button
                      onClick={resetToNow}
                      className="px-3 py-2.5 text-xs font-medium text-primary bg-primary/5 border-2 border-primary/20 rounded-xl hover:bg-primary/10 hover:border-primary/40 transition-all"
                    >
                      ↻ Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT: US Zones (always visible) ────────── */}
            <div className="rounded-xl border border-border p-5 bg-muted/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🇺🇸</span>
                <h3 className="font-semibold text-foreground text-sm">US Time Zones</h3>
              </div>
              <div className="space-y-2">
                {US_TIMEZONE_PRESETS.map((tz) => {
                  const t = getTimeInZone(tz.iana, refDate);
                  const hour = t.getHours();
                  const offset = getOffsetLabel(tz.iana, refDate);
                  const friendlyName = US_ZONE_LABELS[tz.iana] || tz.label;
                  return (
                    <div
                      key={tz.iana}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
                        tz.iana === refZone
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card border-border/50 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {getTimeOfDayIcon(hour)}
                        <div>
                          <span className="text-sm font-medium text-foreground">{friendlyName}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{tz.abbr}</span>
                          <span className="text-xs text-muted-foreground/60 ml-1">({offset})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground tabular-nums">{formatTime(t, use24h)}</span>
                        <span className="text-[11px] text-muted-foreground ml-2">{formatDateShort(t)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              BOTTOM: Search + Quick Add + Custom zones
              ═══════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-sm">Add More Time Zones</h3>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search ${FULL_TIMEZONE_DB.length}+ time zones — city, region, or IANA code`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-30 max-h-64 overflow-y-auto">
                  {searchResults.map((tz) => {
                    const t = getTimeInZone(tz.iana, refDate);
                    return (
                      <button
                        key={tz.iana}
                        onClick={() => addZone(tz)}
                        className="w-full px-4 py-2.5 text-left hover:bg-muted flex items-center justify-between text-sm gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-foreground font-medium">{tz.label}</span>
                          {tz.abbr && <span className="text-muted-foreground ml-1">({tz.abbr})</span>}
                          <span className="block text-[11px] text-muted-foreground/70 truncate">
                            {tz.region} · {tz.iana}
                          </span>
                        </div>
                        <span className="text-muted-foreground tabular-nums flex-shrink-0">
                          {formatTime(t, use24h)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick add pills */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-1.5">
                {quickAddZones.map((tz) => (
                  <button
                    key={tz.iana}
                    onClick={() => addZone(tz)}
                    className="px-2.5 py-1 text-xs rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    {tz.label} ({tz.abbr})
                  </button>
                ))}
              </div>
            </div>

            {/* Custom added zones */}
            {selectedZones.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Your Added Zones
                </p>
                {selectedZones.map((tz) => {
                  const t = getTimeInZone(tz.iana, refDate);
                  const hour = t.getHours();
                  const offset = getOffsetLabel(tz.iana, refDate);
                  const localOff = getOffsetHours(localTz.iana, refDate);
                  const tzOff = getOffsetHours(tz.iana, refDate);
                  const diff = tzOff - localOff;
                  const diffStr =
                    diff === 0
                      ? "Same time"
                      : `${diff > 0 ? "+" : ""}${diff % 1 === 0 ? diff.toFixed(0) : diff.toFixed(1)}h`;
                  return (
                    <div
                      key={tz.iana}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-card border border-border hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {getTimeOfDayIcon(hour)}
                        <div>
                          <span className="text-sm font-medium text-foreground">{tz.label}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">({offset})</span>
                          <span className="text-[11px] text-muted-foreground ml-1.5">{diffStr}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {formatTime(t, use24h)}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-2">{formatDateShort(t)}</span>
                        </div>
                        <button
                          onClick={() => removeZone(tz.iana)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
