import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrievances, GrievanceComment, GRIEVANCE_STATUSES, STATUS_LABELS } from "@/hooks/useGrievances";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Send, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  grievanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrievanceDetailDialog({ grievanceId, open, onOpenChange }: Props) {
  const { grievances, updateGrievanceStatus, fetchComments, addComment, getSubmitterDisplayName, markAsViewed } =
    useGrievances();
  const { user, isManager, isAdmin, isVP } = useAuth();
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
      // Mark as viewed when dialog opens
      markAsViewed(grievanceId);
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

  const submitterName = getSubmitterDisplayName(grievance);

  // Count new comments
  const newCommentCount = comments.filter((c) => c.is_new).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {grievance.title}
            {grievance.is_anonymous && (
              <Badge variant="outline" className="text-xs">
                Anonymous
              </Badge>
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

          {/* Submitter info for managers/admins/VPs */}
          {canManage && submitterName && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Submitted by:</span>
              <span className="font-medium">{submitterName}</span>
            </div>
          )}

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
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Details */}
          <div>
            <Label className="text-sm font-medium">Details</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{grievance.details}</p>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              Comments ({comments.length})
              {newCommentCount > 0 && (
                <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">{newCommentCount} NEW</Badge>
              )}
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
                    className={cn(
                      "p-3 rounded-md text-sm relative",
                      c.is_internal
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                        : "bg-muted/50",
                      c.is_new && "ring-2 ring-blue-500/30",
                    )}
                  >
                    {/* Blue dot indicator for new comments */}
                    {c.is_new && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs flex items-center gap-1">
                        {c.is_new && <Badge className="bg-blue-500 text-white text-[9px] px-1 py-0 mr-1">NEW</Badge>}
                        {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : "Unknown User"}
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
                    <Switch id="internal-comment" checked={isInternal} onCheckedChange={setIsInternal} />
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
