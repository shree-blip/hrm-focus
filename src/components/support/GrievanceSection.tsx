import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, MessageCircle } from "lucide-react";
import { useGrievances, STATUS_LABELS } from "@/hooks/useGrievances";
import { SubmitGrievanceDialog } from "./SubmitGrievanceDialog";
import { GrievanceDetailDialog } from "./GrievanceDetailDialog";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Urgent: "bg-destructive/10 text-destructive",
};

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  need_info: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-muted text-muted-foreground",
  escalated: "bg-destructive/10 text-destructive",
};

export function GrievanceSection() {
  const { grievances, loading, getSubmitterDisplayName, refetch, markAsViewed } = useGrievances();
  const { user, isManager, isAdmin, isVP } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState<string | null>(null);

  // Check if user can see submitter names (managers, admins, VPs)
  const canSeeSubmitter = isManager || isAdmin || isVP;

  // Handle successful grievance submission
  const handleGrievanceSubmitted = async () => {
    setSubmitOpen(false);
    await refetch();
  };

  // Handle opening grievance detail
  const handleOpenGrievance = (grievanceId: string) => {
    setSelectedGrievance(grievanceId);
    // Mark as viewed when opening
    markAsViewed(grievanceId);
  };

  // Handle closing grievance detail
  const handleCloseGrievance = (open: boolean) => {
    if (!open) {
      // Refresh to update any changes
      refetch();
      setSelectedGrievance(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {grievances.length} grievance{grievances.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setSubmitOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Submit Grievance
        </Button>
      </div>

      {grievances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No grievances found. Submit one if you have a concern.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grievances.map((g) => {
            const submitterName = getSubmitterDisplayName(g);

            return (
              <Card
                key={g.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-shadow",
                  g.has_new_comments && "ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/10",
                )}
                onClick={() => handleOpenGrievance(g.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      {/* New comment indicator dot */}
                      {g.has_new_comments && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                        </span>
                      )}
                      {g.title}
                      {g.is_anonymous && (
                        <Badge variant="outline" className="text-xs">
                          Anonymous
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Comment count badge */}
                      {g.comment_count > 0 && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-xs",
                            g.has_new_comments
                              ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700"
                              : "",
                          )}
                        >
                          <MessageCircle className="h-3 w-3" />
                          {g.comment_count}
                          {g.has_new_comments && <span className="text-[10px] ml-0.5">NEW</span>}
                        </Badge>
                      )}
                      <Badge className={priorityColors[g.priority] || ""} variant="secondary">
                        {g.priority}
                      </Badge>
                      <Badge className={statusColors[g.status] || ""} variant="secondary">
                        {STATUS_LABELS[g.status] || g.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>Category: {g.category}</span>
                      {/* Show submitter name for managers/admins/VPs */}
                      {canSeeSubmitter && submitterName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {submitterName}
                        </span>
                      )}
                    </div>
                    <span>{format(new Date(g.created_at), "MMM d, yyyy")}</span>
                  </div>
                  <p className="text-sm mt-1 line-clamp-2">{g.details}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SubmitGrievanceDialog open={submitOpen} onOpenChange={setSubmitOpen} onSuccess={handleGrievanceSubmitted} />

      {selectedGrievance && (
        <GrievanceDetailDialog
          grievanceId={selectedGrievance}
          open={!!selectedGrievance}
          onOpenChange={handleCloseGrievance}
        />
      )}
    </div>
  );
}
