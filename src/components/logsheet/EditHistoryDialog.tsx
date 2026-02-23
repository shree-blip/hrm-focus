import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  History,
  ArrowRight,
  Clock,
  FileText,
  StickyNote,
  PlayCircle,
  StopCircle,
  Briefcase,
  Building2,
  PauseCircle,
  CalendarIcon,
} from "lucide-react";

interface EditHistoryRecord {
  id: string;
  work_log_id: string;
  user_id: string;
  changed_at: string;
  change_type: string;
  previous_task_description: string | null;
  new_task_description: string | null;
  previous_time_spent_minutes: number | null;
  new_time_spent_minutes: number | null;
  previous_notes: string | null;
  new_notes: string | null;
  previous_log_date: string | null;
  new_log_date: string | null;
  previous_start_time: string | null;
  new_start_time: string | null;
  previous_end_time: string | null;
  new_end_time: string | null;
  previous_status: string | null;
  new_status: string | null;
  previous_client_id: string | null;
  new_client_id: string | null;
  previous_department: string | null;
  new_department: string | null;
  previous_total_pause_minutes: number | null;
  new_total_pause_minutes: number | null;
}

interface EditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workLogId: string;
  taskDescription: string;
}

// Client name cache to avoid repeated lookups
const clientNameCache: Record<string, string> = {};

export function EditHistoryDialog({ open, onOpenChange, workLogId, taskDescription }: EditHistoryDialogProps) {
  const [history, setHistory] = useState<EditHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && workLogId) {
      fetchHistory();
    }
  }, [open, workLogId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("work_log_history")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      const records = (data || []) as EditHistoryRecord[];
      setHistory(records);

      // Collect unique client IDs to resolve names
      const clientIds = new Set<string>();
      records.forEach((r) => {
        if (r.previous_client_id) clientIds.add(r.previous_client_id);
        if (r.new_client_id) clientIds.add(r.new_client_id);
      });

      // Fetch client names for any IDs not already cached
      const uncachedIds = Array.from(clientIds).filter((id) => !clientNameCache[id]);
      if (uncachedIds.length > 0) {
        const { data: clientData } = await supabase.from("clients").select("id, name, client_id").in("id", uncachedIds);
        if (clientData) {
          clientData.forEach((c) => {
            const label = c.client_id ? `${c.name} (${c.client_id})` : c.name;
            clientNameCache[c.id] = label;
          });
        }
      }
      setClientNames({ ...clientNameCache });
    } catch (error) {
      console.error("Error fetching edit history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (totalMinutes: number | null) => {
    if (totalMinutes === null || totalMinutes === undefined) return "—";
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  };

  const formatTime12h = (time: string | null) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const hasChange = (prev: string | number | null | undefined, next: string | number | null | undefined) => {
    // Normalize undefined/null/empty for comparison
    const a = prev ?? null;
    const b = next ?? null;
    return a !== b;
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return "—";
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "on_hold":
        return "On Hold";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "in_progress":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "completed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "on_hold":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "";
    }
  };

  const getClientDisplay = (clientId: string | null) => {
    if (!clientId) return "None";
    return clientNames[clientId] || clientId;
  };

  // Count how many fields changed in a record
  const countChanges = (record: EditHistoryRecord): number => {
    let count = 0;
    if (hasChange(record.previous_task_description, record.new_task_description)) count++;
    if (hasChange(record.previous_time_spent_minutes, record.new_time_spent_minutes)) count++;
    if (hasChange(record.previous_notes, record.new_notes)) count++;
    if (hasChange(record.previous_log_date, record.new_log_date)) count++;
    if (hasChange(record.previous_start_time, record.new_start_time)) count++;
    if (hasChange(record.previous_end_time, record.new_end_time)) count++;
    if (hasChange(record.previous_status, record.new_status)) count++;
    if (hasChange(record.previous_client_id, record.new_client_id)) count++;
    if (hasChange(record.previous_department, record.new_department)) count++;
    if (hasChange(record.previous_total_pause_minutes, record.new_total_pause_minutes)) count++;
    return count;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Edit History
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{taskDescription}</p>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No edit history for this log</p>
              <p className="text-sm">Changes will appear here when edits are made</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => {
                const changeCount = countChanges(record);
                return (
                  <div key={record.id} className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {record.change_type === "update" ? "Edited" : record.change_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{formatDateTime(record.changed_at)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {changeCount} {changeCount === 1 ? "change" : "changes"}
                      </Badge>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      {/* ── Status Change ── */}
                      {hasChange(record.previous_status, record.new_status) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <PlayCircle className="h-4 w-4 text-primary" />
                            Status
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs ${getStatusColor(record.previous_status)}`}>
                              {getStatusLabel(record.previous_status)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className={`text-xs ${getStatusColor(record.new_status)}`}>
                              {getStatusLabel(record.new_status)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Task Description Change ── */}
                      {hasChange(record.previous_task_description, record.new_task_description) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <FileText className="h-4 w-4 text-primary" />
                            Task Description
                          </div>
                          <div className="pl-6 space-y-1">
                            <div className="flex items-start gap-2">
                              <Badge variant="destructive" className="text-xs shrink-0">
                                Before
                              </Badge>
                              <p className="text-sm text-muted-foreground break-words">
                                {record.previous_task_description || "(empty)"}
                              </p>
                            </div>
                            <div className="flex items-center justify-center">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-start gap-2">
                              <Badge variant="default" className="text-xs shrink-0">
                                After
                              </Badge>
                              <p className="text-sm break-words">{record.new_task_description || "(empty)"}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Start Time Change ── */}
                      {hasChange(record.previous_start_time, record.new_start_time) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <PlayCircle className="h-4 w-4 text-primary" />
                            Start Time
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs font-mono">
                              {formatTime12h(record.previous_start_time)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs font-mono">
                              {formatTime12h(record.new_start_time)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── End Time Change ── */}
                      {hasChange(record.previous_end_time, record.new_end_time) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <StopCircle className="h-4 w-4 text-primary" />
                            End Time
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs font-mono">
                              {formatTime12h(record.previous_end_time)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs font-mono">
                              {formatTime12h(record.new_end_time)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Time Spent Change ── */}
                      {hasChange(record.previous_time_spent_minutes, record.new_time_spent_minutes) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="h-4 w-4 text-primary" />
                            Time Spent
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">
                              {formatDuration(record.previous_time_spent_minutes)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs">
                              {formatDuration(record.new_time_spent_minutes)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Pause Minutes Change ── */}
                      {hasChange(record.previous_total_pause_minutes, record.new_total_pause_minutes) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <PauseCircle className="h-4 w-4 text-primary" />
                            Total Pause Time
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">
                              {formatDuration(record.previous_total_pause_minutes)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs">
                              {formatDuration(record.new_total_pause_minutes)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Client Change ── */}
                      {hasChange(record.previous_client_id, record.new_client_id) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Briefcase className="h-4 w-4 text-primary" />
                            Client
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">
                              {getClientDisplay(record.previous_client_id)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs">
                              {getClientDisplay(record.new_client_id)}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Department Change ── */}
                      {hasChange(record.previous_department, record.new_department) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Building2 className="h-4 w-4 text-primary" />
                            Department
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">
                              {record.previous_department || "None"}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs">
                              {record.new_department || "None"}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Log Date Change ── */}
                      {hasChange(record.previous_log_date, record.new_log_date) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            Log Date
                          </div>
                          <div className="pl-6 flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">
                              {record.previous_log_date || "—"}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="default" className="text-xs">
                              {record.new_log_date || "—"}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* ── Notes Change ── */}
                      {hasChange(record.previous_notes, record.new_notes) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <StickyNote className="h-4 w-4 text-primary" />
                            Notes
                          </div>
                          <div className="pl-6 space-y-1">
                            <div className="flex items-start gap-2">
                              <Badge variant="destructive" className="text-xs shrink-0">
                                Before
                              </Badge>
                              <p className="text-sm text-muted-foreground break-words">
                                {record.previous_notes || "(empty)"}
                              </p>
                            </div>
                            <div className="flex items-center justify-center">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-start gap-2">
                              <Badge variant="default" className="text-xs shrink-0">
                                After
                              </Badge>
                              <p className="text-sm break-words">{record.new_notes || "(empty)"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {index < history.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
