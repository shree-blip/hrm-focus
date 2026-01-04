import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TeamMemberStatus {
  employee_id: string;
  user_id: string;
  status: "online" | "break" | "offline";
  clock_in?: string;
}

export function useTeamPresence() {
  const [teamStatus, setTeamStatus] = useState<Map<string, TeamMemberStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchTeamStatus = useCallback(async () => {
    // Fetch all active attendance logs (clocked in, not clocked out)
    const { data, error } = await supabase
      .from("attendance_logs")
      .select(`
        id,
        user_id,
        employee_id,
        clock_in,
        status
      `)
      .is("clock_out", null)
      .in("status", ["active", "break"]);

    if (error) {
      console.error("Error fetching team presence:", error);
      setLoading(false);
      return;
    }

    const statusMap = new Map<string, TeamMemberStatus>();
    
    data?.forEach((log) => {
      if (log.employee_id) {
        statusMap.set(log.employee_id, {
          employee_id: log.employee_id,
          user_id: log.user_id,
          status: log.status === "break" ? "break" : "online",
          clock_in: log.clock_in,
        });
      }
    });

    setTeamStatus(statusMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeamStatus();

    // Set up real-time subscription for attendance changes
    const channel = supabase
      .channel("team-presence")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_logs",
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          setTeamStatus((prev) => {
            const updated = new Map(prev);

            if (eventType === "INSERT") {
              const record = newRecord as {
                employee_id: string;
                user_id: string;
                status: string;
                clock_in: string;
                clock_out: string | null;
              };
              
              if (record.employee_id && !record.clock_out) {
                updated.set(record.employee_id, {
                  employee_id: record.employee_id,
                  user_id: record.user_id,
                  status: record.status === "break" ? "break" : "online",
                  clock_in: record.clock_in,
                });
              }
            } else if (eventType === "UPDATE") {
              const record = newRecord as {
                employee_id: string;
                user_id: string;
                status: string;
                clock_in: string;
                clock_out: string | null;
              };

              if (record.employee_id) {
                // If clocked out or auto clocked out, remove from online list
                if (record.clock_out || record.status === "completed" || record.status === "auto_clocked_out") {
                  updated.delete(record.employee_id);
                } else if (record.status === "break") {
                  // On break - update status
                  updated.set(record.employee_id, {
                    employee_id: record.employee_id,
                    user_id: record.user_id,
                    status: "break",
                    clock_in: record.clock_in,
                  });
                } else if (record.status === "active") {
                  // Back to active
                  updated.set(record.employee_id, {
                    employee_id: record.employee_id,
                    user_id: record.user_id,
                    status: "online",
                    clock_in: record.clock_in,
                  });
                }
              }
            } else if (eventType === "DELETE") {
              const record = oldRecord as { employee_id: string };
              if (record.employee_id) {
                updated.delete(record.employee_id);
              }
            }

            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTeamStatus]);

  const getStatus = (employeeId: string): "online" | "break" | "offline" => {
    const memberStatus = teamStatus.get(employeeId);
    return memberStatus?.status || "offline";
  };

  const getOnlineCount = (): number => {
    let count = 0;
    teamStatus.forEach((status) => {
      if (status.status === "online") count++;
    });
    return count;
  };

  return {
    teamStatus,
    loading,
    getStatus,
    getOnlineCount,
    refetch: fetchTeamStatus,
  };
}
