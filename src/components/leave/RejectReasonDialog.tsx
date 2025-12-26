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

interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  employeeName: string;
}

export function RejectReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  employeeName,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Please provide a reason for rejection");
      toast({
        title: "Reason Required",
        description: "Please provide a reason for rejecting this request.",
        variant: "destructive",
      });
      return;
    }
    
    onConfirm(reason);
    setReason("");
    setError("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setReason("");
    setError("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to reject the leave request from <strong>{employeeName}</strong>. 
            Please provide a reason so they understand why.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="reject-reason">Reason for rejection <span className="text-destructive">*</span></Label>
          <Textarea
            id="reject-reason"
            placeholder="Enter the reason for rejecting this request..."
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
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject Request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
