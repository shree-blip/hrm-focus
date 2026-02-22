import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Users, Clock, Briefcase, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime12h, formatDuration } from "@/lib/timeFormat";

interface LiveLog {
  id: string;
  user_id: string;
  log_date: string;
  task_description: string;
  time_spent_minutes: number;
  status: string | null;
  start_time: string | null;
  created_at: string;
  client?: {
    name: string;
    client_id: string | null;
  } | null;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
}

export function TeamRealtimeDashboard() {
  const { user, isVP, isManager, isLineManager } = useAuth();
  const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamUserIds, setTeamUserIds] = useState<string[]>([]);

  const formatTime = formatDuration;

  // Fetch team member user IDs for scoped visibility
  const fetchTeamUserIds = useCallback(async () => {
    if (!user) return;

    // VP/Admin see everyone
    if (isVP) {
      setTeamUserIds([]); // empty = fetch all
      return;
    }

    const { data: myEmpId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
    });
    if (!myEmpId) {
      setTeamUserIds(["__none__"]);
      return;
    }

    const { data: teamEmployees } = await supabase
      .from("employees")
      .select("id, profile_id")
      .or(`line_manager_id.eq.${myEmpId},manager_id.eq.${myEmpId}`);

    if (!teamEmployees || teamEmployees.length === 0) {
      setTeamUserIds(["__none__"]);
      return;
    }

    const profileIds = teamEmployees.map((e) => e.profile_id).filter(Boolean);
    if (profileIds.length === 0) {
      setTeamUserIds(["__none__"]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .in("id", profileIds);

    const ids = (profiles || []).map((p) => p.user_id);
    setTeamUserIds(ids.length > 0 ? ids : ["__none__"]);
  }, [user, isVP]);

  const fetchLiveLogs = useCallback(async () => {
    if (!user) return;
    // Wait for team IDs to be resolved (unless VP)
    if (!isVP && teamUserIds.length === 0) return;
    if (teamUserIds.includes("__none__")) {
      setLiveLogs([]);
      setLoading(false);
      return;
    }

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      let query = supabase
        .from("work_logs")
        .select(
          `id, user_id, log_date, task_description, time_spent_minutes, status, start_time, created_at,
          client:clients(name, client_id),
          employee:employees(first_name, last_name, department)`,
        )
        .eq("log_date", today)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Scope to team members for non-VP
      if (!isVP && teamUserIds.length > 0) {
        query = query.in("user_id", teamUserIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLiveLogs((data as LiveLog[]) || []);
    } catch (error) {
      console.error("Error fetching live logs:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isVP, teamUserIds]);

  useEffect(() => {
    fetchTeamUserIds();
  }, [fetchTeamUserIds]);

  useEffect(() => {
    fetchLiveLogs();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("team-work-logs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_logs",
        },
        () => {
          fetchLiveLogs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLiveLogs]);

  const activeCount = liveLogs.filter((log) => log.status === "in_progress").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Team Live Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm text-muted-foreground">{activeCount} active</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : liveLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team activity today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {liveLogs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all",
                  log.status === "in_progress"
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-muted/30",
                )}
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">
                    {log.employee?.first_name?.[0]}
                    {log.employee?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {log.employee?.first_name} {log.employee?.last_name}
                    </span>
                    {log.employee?.department && (
                      <Badge variant="outline" className="text-xs">
                        {log.employee.department}
                      </Badge>
                    )}
                    {log.status === "in_progress" && <Badge className="text-xs bg-green-500">Active</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">{log.task_description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    {log.client?.name && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        <span>
                          {log.client.name}
                          {log.client.client_id && (
                            <span className="text-muted-foreground/70 ml-1">({log.client.client_id})</span>
                          )}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(log.time_spent_minutes)}
                    </span>
                    {log.start_time && <span>Started: {formatTime12h(log.start_time)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
