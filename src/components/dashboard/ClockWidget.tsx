import React, { useState, useEffect, useMemo } from "react";
import { Clock, Play, Square, Coffee, Loader2, Briefcase, Pause, ChevronDown } from "lucide-react";

/**
 * UTILS: Replicating "cn" utility and basic date formatting
 * to avoid external dependencies while maintaining the look.
 */
const cn = (...classes) => classes.filter(Boolean).join(" ");

const App = () => {
  // --- MOCK ATTENDANCE HOOK LOGIC (Integrated) ---
  const [loading, setLoading] = useState(false);
  const [clockStatus, setClockStatus] = useState("out"); // "out", "in", "break", "paused"
  const [clockType, setClockType] = useState("payroll");
  const [currentLog, setCurrentLog] = useState(null);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [monthlyHours, setMonthlyHours] = useState(120); // Static mock value

  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  // Update elapsed time every second
  useEffect(() => {
    if (clockStatus === "out" || !currentLog) {
      setElapsedTime("00:00:00");
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const clockInTime = new Date(currentLog.clock_in);
      let elapsed = now.getTime() - clockInTime.getTime();

      const totalBreakMs = (currentLog.total_break_minutes || 0) * 60 * 1000;
      const totalPauseMs = (currentLog.total_pause_minutes || 0) * 60 * 1000;
      elapsed -= totalBreakMs;
      elapsed -= totalPauseMs;

      if (clockStatus === "break" && currentLog.break_start) {
        const breakStart = new Date(currentLog.break_start);
        elapsed -= now.getTime() - breakStart.getTime();
      }

      if (clockStatus === "paused" && currentLog.pause_start) {
        const pauseStart = new Date(currentLog.pause_start);
        elapsed -= now.getTime() - pauseStart.getTime();
      }

      elapsed = Math.max(0, elapsed);

      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [clockStatus, currentLog]);

  // --- ACTIONS ---
  const handleClockIn = () => {
    setCurrentLog({
      id: Date.now().toString(),
      clock_in: new Date().toISOString(),
      clock_out: null,
      clock_type: clockType,
      total_break_minutes: 0,
      total_pause_minutes: 0,
      break_start: null,
      pause_start: null,
    });
    setClockStatus("in");
  };

  const handleClockOut = () => {
    setWeeklyLogs([...weeklyLogs, { ...currentLog, clock_out: new Date().toISOString() }]);
    setCurrentLog(null);
    setClockStatus("out");
  };

  const handleBreak = () => {
    const now = new Date();
    if (clockStatus === "break") {
      const start = new Date(currentLog.break_start);
      const diff = (now.getTime() - start.getTime()) / 60000;
      setCurrentLog({
        ...currentLog,
        total_break_minutes: (currentLog.total_break_minutes || 0) + diff,
        break_start: null,
      });
      setClockStatus("in");
    } else {
      setCurrentLog({ ...currentLog, break_start: now.toISOString() });
      setClockStatus("break");
    }
  };

  const handlePause = () => {
    const now = new Date();
    if (clockStatus === "paused") {
      const start = new Date(currentLog.pause_start);
      const diff = (now.getTime() - start.getTime()) / 60000;
      setCurrentLog({
        ...currentLog,
        total_pause_minutes: (currentLog.total_pause_minutes || 0) + diff,
        pause_start: null,
      });
      setClockStatus("in");
    } else {
      setCurrentLog({ ...currentLog, pause_start: now.toISOString() });
      setClockStatus("paused");
    }
  };

  // --- STATS HELPER ---
  const getTodayHours = () => {
    return "0h 0m"; // Simplified mock for demo
  };

  const getWeeklyHours = () => {
    return "0h 0m"; // Simplified mock for demo
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border rounded-xl shadow-sm m-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const clockInTime = currentLog ? new Date(currentLog.clock_in) : null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Card Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Clock className="h-5 w-5 text-blue-600" />
              Time Tracker
            </h3>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
                clockStatus === "in" && "border-emerald-200 text-emerald-700 bg-emerald-50",
                clockStatus === "out" && "border-slate-200 text-slate-500 bg-slate-50",
                clockStatus === "break" && "border-amber-200 text-amber-700 bg-amber-50",
                clockStatus === "paused" && "border-sky-200 text-sky-700 bg-sky-50",
              )}
            >
              {clockStatus === "in" && (currentLog?.clock_type === "billable" ? "Billable" : "Active")}
              {clockStatus === "out" && "Not Clocked In"}
              {clockStatus === "break" && "On Break"}
              {clockStatus === "paused" && "Paused"}
            </span>
          </div>
        </div>

        <div className="p-6 pt-0 space-y-4">
          {/* Clock Type Selector */}
          {clockStatus === "out" && (
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Briefcase className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={clockType}
                onChange={(e) => setClockType(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="payroll">Payroll Time</option>
                <option value="billable">Billable Time</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          )}

          {/* Timer Display */}
          <div className="text-center py-8 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
            <p className="text-5xl font-mono font-bold tracking-tight text-slate-900 tabular-nums">{elapsedTime}</p>
            {clockInTime && (
              <p className="text-xs text-slate-400 font-medium mt-2 uppercase tracking-wider">
                Clocked in at {clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {currentLog?.clock_type === "billable" && " (Billable)"}
              </p>
            )}
            {clockStatus === "paused" && currentLog?.pause_start && (
              <p className="text-xs text-sky-600 font-semibold mt-1">
                Paused since{" "}
                {new Date(currentLog.pause_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {clockStatus === "out" ? (
              <button
                onClick={handleClockIn}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
              >
                <Play className="h-5 w-5 fill-current" />
                Clock In
              </button>
            ) : (
              <>
                <button
                  onClick={handleBreak}
                  disabled={clockStatus === "paused"}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50",
                    clockStatus === "break"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  <Coffee className="h-4 w-4" />
                  {clockStatus === "break" ? "Resume" : "Break"}
                </button>

                <button
                  onClick={handlePause}
                  disabled={clockStatus === "break"}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 border-2",
                    clockStatus === "paused"
                      ? "bg-sky-500 border-sky-500 text-white"
                      : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Pause className="h-4 w-4" />
                  {clockStatus === "paused" ? "Resume" : "Pause"}
                </button>

                {/* CLOCK OUT BUTTON: Hidden when on break or paused */}
                {clockStatus === "in" && (
                  <button
                    onClick={handleClockOut}
                    className="flex-1 py-3 px-4 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] animate-in fade-in zoom-in-95 duration-200"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Clock Out
                  </button>
                )}
              </>
            )}
          </div>

          {/* Summary Footer */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-lg font-bold text-slate-800">{getTodayHours()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Today</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-lg font-bold text-slate-800">{getWeeklyHours()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">This Week</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-lg font-bold text-slate-800">{monthlyHours}h</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">This Month</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
