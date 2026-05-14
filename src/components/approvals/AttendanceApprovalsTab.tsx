import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceAdjustments } from "@/hooks/useAttendanceAdjustments";
import { ManagerAdjustmentPanel } from "@/components/attendance/ManagerAdjustmentPanel";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export function AttendanceApprovalsTab() {
  const { isManager, isLineManager, isAdmin, isVP } = useAuth();
  const { teamRequests, reviewRequest, overrideRequest } = useAttendanceAdjustments();

  const canSee = isManager || isLineManager || isAdmin || isVP;

  if (!canSee) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          You don't have access to attendance approvals.
        </CardContent>
      </Card>
    );
  }

  if (teamRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No attendance adjustment requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <ManagerAdjustmentPanel
      requests={teamRequests}
      onReview={reviewRequest}
      canOverride={isAdmin || isVP}
      onOverride={overrideRequest}
    />
  );
}
