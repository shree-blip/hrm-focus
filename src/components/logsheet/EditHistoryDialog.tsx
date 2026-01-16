import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { History, ArrowRight, Clock, FileText, StickyNote } from "lucide-react";

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
}

interface EditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workLogId: string;
  taskDescription: string;
}

export function EditHistoryDialog({
  open,
  onOpenChange,
  workLogId,
  taskDescription,
}: EditHistoryDialogProps) {
  const [history, setHistory] = useState<EditHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

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
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching edit history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (totalMinutes: number | null) => {
    if (totalMinutes === null) return "-";
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  };

  const hasChange = (prev: string | number | null, next: string | number | null) => {
    return prev !== next;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Edit History
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">
            {taskDescription}
          </p>
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
              {history.map((record, index) => (
                <div key={record.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {record.change_type === "update" ? "Edited" : record.change_type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(record.changed_at)}
                    </span>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    {/* Task Description Change */}
                    {hasChange(record.previous_task_description, record.new_task_description) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="h-4 w-4 text-primary" />
                          Task Description
                        </div>
                        <div className="pl-6 space-y-1">
                          <div className="flex items-start gap-2">
                            <Badge variant="destructive" className="text-xs shrink-0">Before</Badge>
                            <p className="text-sm text-muted-foreground break-words">
                              {record.previous_task_description || "(empty)"}
                            </p>
                          </div>
                          <div className="flex items-center justify-center">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex items-start gap-2">
                            <Badge variant="default" className="text-xs shrink-0">After</Badge>
                            <p className="text-sm break-words">
                              {record.new_task_description || "(empty)"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Time Spent Change */}
                    {hasChange(record.previous_time_spent_minutes, record.new_time_spent_minutes) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4 text-primary" />
                          Time Spent
                        </div>
                        <div className="pl-6 flex items-center gap-2 flex-wrap">
                          <Badge variant="destructive" className="text-xs">
                            {formatTime(record.previous_time_spent_minutes)}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="default" className="text-xs">
                            {formatTime(record.new_time_spent_minutes)}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Notes Change */}
                    {hasChange(record.previous_notes, record.new_notes) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <StickyNote className="h-4 w-4 text-primary" />
                          Notes
                        </div>
                        <div className="pl-6 space-y-1">
                          <div className="flex items-start gap-2">
                            <Badge variant="destructive" className="text-xs shrink-0">Before</Badge>
                            <p className="text-sm text-muted-foreground break-words">
                              {record.previous_notes || "(empty)"}
                            </p>
                          </div>
                          <div className="flex items-center justify-center">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex items-start gap-2">
                            <Badge variant="default" className="text-xs shrink-0">After</Badge>
                            <p className="text-sm break-words">
                              {record.new_notes || "(empty)"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {index < history.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}