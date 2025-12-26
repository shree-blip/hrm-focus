import { useState, useEffect } from "react";
import { Clock, Play, Square, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ClockStatus = "clocked-out" | "clocked-in" | "on-break";

interface ClockState {
  status: ClockStatus;
  clockInTime: string | null;
  breakStartTime: string | null;
  totalBreakTime: number;
}

const STORAGE_KEY = "hrms-clock-state";

export function ClockWidget() {
  const [status, setStatus] = useState<ClockStatus>("clocked-out");
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state: ClockState = JSON.parse(savedState);
        setStatus(state.status);
        setClockInTime(state.clockInTime ? new Date(state.clockInTime) : null);
        setBreakStartTime(state.breakStartTime ? new Date(state.breakStartTime) : null);
        setTotalBreakTime(state.totalBreakTime || 0);
      } catch (e) {
        console.error("Failed to parse clock state", e);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state: ClockState = {
      status,
      clockInTime: clockInTime?.toISOString() || null,
      breakStartTime: breakStartTime?.toISOString() || null,
      totalBreakTime,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [status, clockInTime, breakStartTime, totalBreakTime]);

  // Update elapsed time every second
  useEffect(() => {
    if (status === "clocked-out" || !clockInTime) {
      setElapsedTime("00:00:00");
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      let elapsed = now.getTime() - clockInTime.getTime();
      
      // Subtract total break time
      elapsed -= totalBreakTime;
      
      // If currently on break, subtract current break time
      if (status === "on-break" && breakStartTime) {
        elapsed -= (now.getTime() - breakStartTime.getTime());
      }

      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [status, clockInTime, breakStartTime, totalBreakTime]);

  const handleClockIn = () => {
    const now = new Date();
    setStatus("clocked-in");
    setClockInTime(now);
    setTotalBreakTime(0);
    setBreakStartTime(null);
  };

  const handleClockOut = () => {
    setStatus("clocked-out");
    setClockInTime(null);
    setBreakStartTime(null);
    setTotalBreakTime(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleBreak = () => {
    if (status === "on-break") {
      // Resuming from break
      if (breakStartTime) {
        const breakDuration = new Date().getTime() - breakStartTime.getTime();
        setTotalBreakTime(prev => prev + breakDuration);
      }
      setBreakStartTime(null);
      setStatus("clocked-in");
    } else {
      // Starting break
      setBreakStartTime(new Date());
      setStatus("on-break");
    }
  };

  return (
    <Card className="overflow-hidden animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Time Tracker
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              status === "clocked-in" && "border-success text-success bg-success/10",
              status === "clocked-out" && "border-muted-foreground text-muted-foreground",
              status === "on-break" && "border-warning text-warning bg-warning/10"
            )}
          >
            {status === "clocked-in" && "Active"}
            {status === "clocked-out" && "Not Clocked In"}
            {status === "on-break" && "On Break"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Display */}
        <div className="text-center py-6 rounded-lg bg-secondary/50">
          <p className="text-5xl font-display font-bold tracking-wider text-foreground">
            {elapsedTime}
          </p>
          {clockInTime && (
            <p className="text-sm text-muted-foreground mt-2">
              Clocked in at {clockInTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {status === "clocked-out" ? (
            <Button onClick={handleClockIn} className="flex-1 gap-2" size="lg">
              <Play className="h-4 w-4" />
              Clock In
            </Button>
          ) : (
            <>
              <Button
                onClick={handleBreak}
                variant={status === "on-break" ? "default" : "secondary"}
                className="flex-1 gap-2"
                size="lg"
              >
                <Coffee className="h-4 w-4" />
                {status === "on-break" ? "Resume" : "Break"}
              </Button>
              <Button onClick={handleClockOut} variant="destructive" className="flex-1 gap-2" size="lg">
                <Square className="h-4 w-4" />
                Clock Out
              </Button>
            </>
          )}
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">6h 45m</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">32h 15m</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-success">85%</p>
            <p className="text-xs text-muted-foreground">Utilization</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
