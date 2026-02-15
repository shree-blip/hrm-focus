import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGrievances,
  GrievanceComment,
  GRIEVANCE_STATUSES,
  STATUS_LABELS,
} from "@/hooks/useGrievances";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Send, Lock } from "lucide-react";

interface Props {
  grievanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrievanceDetailDialog({ grievanceId, open, onOpenChange }: Props) {
  const { grievances, updateGrievanceStatus, fetchComments, addComment } = useGrievances();
  const { isManager, isAdmin, isVP } = useAuth();
  const canManage = isManager || isAdmin || isVP;

  const grievance = grievances.find((g) => g.id === grievanceId);
  const [comments, setComments] = useState<GrievanceComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && grievanceId) {
      loadComments();
    }
  }, [open, grievanceId]);

  const loadComments = async () => {
    setLoadingComments(true);
    const data = await fetchComments(grievanceId);
    setComments(data);
    setLoadingComments(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    const success = await addComment(grievanceId, newComment, isInternal);
    if (success) {
      setNewComment("");
      setIsInternal(false);
      await loadComments();
    }
    setSending(false);
  };

  const handleStatusChange = async (status: string) => {
    await updateGrievanceStatus(grievanceId, status);
  };

  if (!grievance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {grievance.title}
            {grievance.is_anonymous && (
              <Badge variant="outline" className="text-xs">Anonymous</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{grievance.category}</Badge>
            <Badge variant="secondary">{grievance.priority}</Badge>
            <Badge variant="secondary">{STATUS_LABELS[grievance.status]}</Badge>
            <span className="text-muted-foreground">
              {format(new Date(grievance.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {/* Status change for managers */}
          {canManage && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Update Status:</Label>
              <Select value={grievance.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Details */}
          <div>
            <Label className="text-sm font-medium">Details</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
              {grievance.details}
            </p>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <Label className="text-sm font-medium">
              Comments ({comments.length})
            </Label>

            <div className="mt-2 space-y-3 max-h-60 overflow-y-auto">
              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-md text-sm ${
                      c.is_internal
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">
                        {c.profiles
                          ? `${c.profiles.first_name} ${c.profiles.last_name}`
                          : "Unknown User"}
                        {c.is_internal && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> Internal
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            <div className="mt-3 space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
              />
              <div className="flex items-center justify-between">
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="internal-comment"
                      checked={isInternal}
                      onCheckedChange={setIsInternal}
                    />
                    <Label htmlFor="internal-comment" className="text-xs">
                      Internal only (hidden from employee)
                    </Label>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || sending}
                  className="ml-auto"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
