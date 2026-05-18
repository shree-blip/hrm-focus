import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
}

interface Props {
  table: "asset_request_comments" | "bug_report_comments";
  parentField: "request_id" | "bug_report_id";
  parentId: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export function CommentsThread({ table, parentField, parentId, disabled, disabledMessage }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from(table)
      .select("id, user_id, content, created_at")
      .eq(parentField, parentId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      setComments([]);
      setLoading(false);
      return;
    }
    const rows = (data || []) as CommentRow[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      const map = new Map(profiles?.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]));
      rows.forEach((r) => (r.author_name = map.get(r.user_id) || "User"));
    }
    setComments(rows);
    setLoading(false);
  }, [table, parentField, parentId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from(table).insert({
      [parentField]: parentId,
      user_id: user.id,
      content: content.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setContent("");
    fetchComments();
  };

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="bg-muted/40 rounded-md p-2.5 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{c.author_name || "User"}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {disabled ? (
        <p className="text-xs text-muted-foreground italic">{disabledMessage || "Comments are disabled."}</p>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={!content.trim() || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Post Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}