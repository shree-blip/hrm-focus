import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface CancelReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  employeeName: string;
}

export function CancelReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  employeeName,
}: CancelReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Please provide a reason for cancellation");
      toast({
        title: "Reason Required",
        description: "Please provide a reason for cancelling this approved leave.",
        variant: "destructive",
      });
      return;
    }
    onConfirm(reason.trim());
    setReason("");
    setError("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Approved Leave</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to cancel the approved leave of <strong>{employeeName}</strong>.
            Please provide a reason so they understand why.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="cancel-reason">
            Reason for cancellation <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="Enter the reason for cancelling this leave..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError("");
            }}
            className={`mt-2 ${error ? "border-destructive" : ""}`}
            rows={3}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Keep Leave</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancel Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
