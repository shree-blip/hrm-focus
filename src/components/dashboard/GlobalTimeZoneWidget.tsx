import { useState, useEffect, useMemo, useCallback } from "react";
import { Globe, X, Search, Clock, Trash2, Sun, Moon, Sunrise, Sunset } from "lucide-react";

// ─── Timezone Database ───────────────────────────────────────────────
interface TZInfo {
  label: string;
  iana: string;
  abbr: string;
  region: string;
}

// ─── Get dynamic abbreviation from the browser ──────────────────────
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

// ─── Derive a human-friendly label from an IANA string ──────────────
function ianaToLabel(iana: string): string {
  const parts = iana.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  return city;
}

// ─── Derive region from the first segment of IANA ───────────────────
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

// ─── Build FULL timezone database from browser's IANA list ──────────
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

// Build once at module level
const FULL_TIMEZONE_DB: TZInfo[] = buildFullTimezoneDB();

// Popular zones for quick-add buttons
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

// US timezone presets for the company quick-select
const US_TIMEZONE_PRESETS: TZInfo[] = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
].map((iana) => {
  const found = FULL_TIMEZONE_DB.find((tz) => tz.iana === iana);
  return found || { label: ianaToLabel(iana), iana, abbr: getAbbr(iana), region: "Americas" };
});

// ─── Helpers ─────────────────────────────────────────────────────────
function getTimeInZone(iana: string, refDate: Date): Date {
  const str = refDate.toLocaleString("en-US", { timeZone: iana });
  return new Date(str);
}

function formatTime(date: Date, use24h = false): string {
  if (use24h) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function getOffsetHours(iana: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = refDate.toLocaleString("en-US", { timeZone: iana });
  const diff = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return diff / (1000 * 60 * 60);
}

function getTimeOfDayIcon(hour: number) {
  if (hour >= 6 && hour < 12) return <Sunrise className="w-4 h-4 text-amber-500" />;
  if (hour >= 12 && hour < 18) return <Sun className="w-4 h-4 text-yellow-500" />;
  if (hour >= 18 && hour < 21) return <Sunset className="w-4 h-4 text-orange-500" />;
  return <Moon className="w-4 h-4 text-indigo-400" />;
}

function getHourBg(hour: number): string {
  if (hour >= 9 && hour < 17) return "bg-emerald-500/20 border-emerald-500/30";
  if (hour >= 6 && hour < 9) return "bg-amber-500/15 border-amber-500/25";
  if (hour >= 17 && hour < 21) return "bg-orange-500/15 border-orange-500/25";
  return "bg-slate-500/15 border-slate-500/25";
}

// ─── Detect Local TZ ────────────────────────────────────────────────
function detectLocalTimezone(): TZInfo {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const found = FULL_TIMEZONE_DB.find((tz) => tz.iana === iana);
  if (found) return found;
  const parts = iana.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  return { label: city, iana, abbr: getAbbr(iana), region: "Local" };
}

// ═══════════════════════════════════════════════════════════════════════
// SMALL CARD WIDGET (for sidebar)
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
      {/* Small Card */}
      <div
        onClick={() => setOpen(true)}
        className="group cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Compare Time Zones</h3>
        </div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{formatTime(localTime)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {localTz.label} ({localTz.abbr || "Local"})
        </p>
        <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Click to compare zones →
        </p>
      </div>

      {/* Modal */}
      {open && <TimeZoneModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FULL MODAL
// ═══════════════════════════════════════════════════════════════════════
function TimeZoneModal({ onClose }: { onClose: () => void }) {
  const localTz = useMemo(() => detectLocalTimezone(), []);

  const [refDate, setRefDate] = useState(new Date());
  const [isLive, setIsLive] = useState(true);
  const [selectedZones, setSelectedZones] = useState<TZInfo[]>([]);
  const [search, setSearch] = useState("");
  const [use24h, setUse24h] = useState(false);

  // Live tick
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setRefDate(new Date()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filter search results
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

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLive(false);
    const [h, m] = e.target.value.split(":").map(Number);
    const d = new Date(refDate);
    const localNow = getTimeInZone(localTz.iana, d);
    localNow.setHours(h, m, 0, 0);
    const offset = localNow.getTime() - getTimeInZone(localTz.iana, refDate).getTime();
    setRefDate(new Date(refDate.getTime() + offset));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLive(false);
    const parts = e.target.value.split("-").map(Number);
    if (parts.length !== 3) return;
    const d = new Date(refDate);
    const localNow = getTimeInZone(localTz.iana, d);
    localNow.setFullYear(parts[0], parts[1] - 1, parts[2]);
    const offset = localNow.getTime() - getTimeInZone(localTz.iana, refDate).getTime();
    setRefDate(new Date(refDate.getTime() + offset));
  };

  const resetToNow = () => {
    setRefDate(new Date());
    setIsLive(true);
  };

  const localTime = getTimeInZone(localTz.iana, refDate);
  const localTimeStr = `${String(localTime.getHours()).padStart(2, "0")}:${String(localTime.getMinutes()).padStart(2, "0")}`;
  const localDateStr = `${localTime.getFullYear()}-${String(localTime.getMonth() + 1).padStart(2, "0")}-${String(localTime.getDate()).padStart(2, "0")}`;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
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
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Your Local Time ─────────────────────────────── */}
          <div className="rounded-xl border border-border p-5 bg-muted/30">
            <h3 className="font-semibold text-foreground mb-4">Your Local Time</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">
                  {localTz.label} ({localTz.abbr || "Local"})
                  {isLive && <span className="ml-2 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                </p>
                <div className="text-3xl font-bold text-foreground tabular-nums">{formatTime(localTime, use24h)}</div>
                <p className="text-sm text-muted-foreground">{formatDate(localTime)}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Change Time
                  </label>
                  <input
                    type="time"
                    value={localTimeStr}
                    onChange={handleTimeChange}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Change Date</label>
                  <input
                    type="date"
                    value={localDateStr}
                    onChange={handleDateChange}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3">
              {!isLive && (
                <button onClick={resetToNow} className="text-xs text-primary hover:underline">
                  ↻ Reset to current time
                </button>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={use24h}
                  onChange={(e) => setUse24h(e.target.checked)}
                  className="rounded"
                />
                24-hour format
              </label>
            </div>
          </div>

          {/* ── Time Zone Comparison ───────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Time Zone Comparison</h3>
              </div>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "all-us") {
                    const usZones = US_TIMEZONE_PRESETS.filter(
                      (tz) => tz.iana !== localTz.iana && !selectedZones.some((s) => s.iana === tz.iana),
                    );
                    if (usZones.length > 0) setSelectedZones((prev) => [...prev, ...usZones]);
                  } else if (val) {
                    const found = US_TIMEZONE_PRESETS.find((tz) => tz.iana === val);
                    if (found && !selectedZones.some((s) => s.iana === found.iana) && found.iana !== localTz.iana) {
                      setSelectedZones((prev) => [...prev, found]);
                    }
                  }
                  e.target.value = "";
                }}
                defaultValue=""
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="" disabled>
                  🇺🇸 US Zones
                </option>
                <option value="all-us">Add all 6 US zones</option>
                {US_TIMEZONE_PRESETS.filter(
                  (tz) => tz.iana !== localTz.iana && !selectedZones.some((s) => s.iana === tz.iana),
                ).map((tz) => (
                  <option key={tz.iana} value={tz.iana}>
                    {tz.label} ({tz.abbr})
                  </option>
                ))}
              </select>
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

            {/* Quick add buttons */}
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

            {/* Selected Zones */}
            {selectedZones.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/20">
                <Globe className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No time zones added yet.</p>
                <p className="text-xs text-muted-foreground">
                  Add a time zone using the search or quick add buttons above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Local as reference */}
                <ZoneRow tz={localTz} refDate={refDate} use24h={use24h} isLocal onRemove={undefined} />
                {selectedZones.map((tz) => (
                  <ZoneRow
                    key={tz.iana}
                    tz={tz}
                    refDate={refDate}
                    use24h={use24h}
                    isLocal={false}
                    onRemove={() => removeZone(tz.iana)}
                    localIana={localTz.iana}
                  />
                ))}

                {/* ── 24h Timeline Grid ──────────────────── */}
                {selectedZones.length > 0 && (
                  <div className="mt-6 rounded-xl border border-border p-4 overflow-x-auto bg-muted/20">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      24-Hour Overlap View
                    </h4>
                    <div className="min-w-[600px]">
                      {/* Hour labels */}
                      <div className="flex mb-1 ml-[120px]">
                        {hours
                          .filter((_, i) => i % 3 === 0)
                          .map((h) => (
                            <div
                              key={h}
                              className="text-[10px] text-muted-foreground tabular-nums"
                              style={{ width: `${(3 / 24) * 100}%` }}
                            >
                              {use24h
                                ? `${String(h).padStart(2, "0")}:00`
                                : `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "a" : "p"}`}
                            </div>
                          ))}
                      </div>
                      {/* Local row */}
                      <TimelineRow
                        label={localTz.label}
                        iana={localTz.iana}
                        refDate={refDate}
                        localIana={localTz.iana}
                      />
                      {/* Selected rows */}
                      {selectedZones.map((tz) => (
                        <TimelineRow
                          key={tz.iana}
                          label={tz.label}
                          iana={tz.iana}
                          refDate={refDate}
                          localIana={localTz.iana}
                        />
                      ))}
                      {/* Legend */}
                      <div className="flex gap-4 mt-3 ml-[120px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
                          <span className="text-[10px] text-muted-foreground">Business hours (9-5)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30" />
                          <span className="text-[10px] text-muted-foreground">Early / Late</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-slate-500/20 border border-slate-500/30" />
                          <span className="text-[10px] text-muted-foreground">Night</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Zone Row Component
// ═══════════════════════════════════════════════════════════════════════
function ZoneRow({
  tz,
  refDate,
  use24h,
  isLocal,
  onRemove,
  localIana,
}: {
  tz: TZInfo;
  refDate: Date;
  use24h: boolean;
  isLocal: boolean;
  onRemove: (() => void) | undefined;
  localIana?: string;
}) {
  const time = getTimeInZone(tz.iana, refDate);
  const hour = time.getHours();
  const offset = getOffsetHours(tz.iana, refDate);
  const localOffset = localIana ? getOffsetHours(localIana, refDate) : offset;
  const diff = offset - localOffset;
  const diffStr = isLocal
    ? "Local"
    : diff === 0
      ? "Same time"
      : `${diff > 0 ? "+" : ""}${diff % 1 === 0 ? diff.toFixed(0) : diff.toFixed(1)}h`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isLocal ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:bg-muted/40"
      }`}
    >
      {getTimeOfDayIcon(hour)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm truncate">{tz.label}</span>
          <span className="text-xs text-muted-foreground">({tz.abbr || "Local"})</span>
          {isLocal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">YOU</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(time)}</p>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-foreground tabular-nums">{formatTime(time, use24h)}</div>
        <p className="text-xs text-muted-foreground">{diffStr}</p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Timeline Row
// ═══════════════════════════════════════════════════════════════════════
function TimelineRow({
  label,
  iana,
  refDate,
  localIana,
}: {
  label: string;
  iana: string;
  refDate: Date;
  localIana: string;
}) {
  const localOffset = getOffsetHours(localIana, refDate);
  const tzOffset = getOffsetHours(iana, refDate);
  const hourShift = tzOffset - localOffset;

  return (
    <div className="flex items-center mb-1">
      <div className="w-[120px] flex-shrink-0 text-xs text-muted-foreground truncate pr-2">{label}</div>
      <div className="flex flex-1">
        {Array.from({ length: 24 }, (_, i) => {
          let h = (i + Math.round(hourShift)) % 24;
          if (h < 0) h += 24;
          return (
            <div
              key={i}
              className={`flex-1 h-6 border ${getHourBg(h)} flex items-center justify-center ${i === 0 ? "rounded-l" : ""} ${i === 23 ? "rounded-r" : ""}`}
              title={`${label}: ${String(h).padStart(2, "0")}:00`}
            >
              <span className="text-[9px] text-muted-foreground/70 tabular-nums">{h}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
