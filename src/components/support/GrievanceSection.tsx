import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import { useGrievances, STATUS_LABELS } from "@/hooks/useGrievances";
import { SubmitGrievanceDialog } from "./SubmitGrievanceDialog";
import { GrievanceDetailDialog } from "./GrievanceDetailDialog";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { grievances, loading } = useGrievances();
  const { user } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState<string | null>(null);

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
          {grievances.map((g) => (
            <Card key={g.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedGrievance(g.id)}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {g.title}
                    {g.is_anonymous && (
                      <Badge variant="outline" className="text-xs">Anonymous</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <span>Category: {g.category}</span>
                  <span>{format(new Date(g.created_at), "MMM d, yyyy")}</span>
                </div>
                <p className="text-sm mt-1 line-clamp-2">{g.details}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SubmitGrievanceDialog open={submitOpen} onOpenChange={setSubmitOpen} />
      
      {selectedGrievance && (
        <GrievanceDetailDialog
          grievanceId={selectedGrievance}
          open={!!selectedGrievance}
          onOpenChange={(open) => !open && setSelectedGrievance(null)}
        />
      )}
    </div>
  );
}
