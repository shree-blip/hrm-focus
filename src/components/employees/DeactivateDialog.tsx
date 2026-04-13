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
import { toast } from "sonner";
import { AlertTriangle, ShieldOff } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: string;
  initials: string;
  phone: string;
}

interface DeactivateDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (employeeId: number) => void;
}

export function DeactivateDialog({
  employee,
  open,
  onOpenChange,
  onConfirm,
}: DeactivateDialogProps) {
  if (!employee) return null;

  const handleConfirm = () => {
    onConfirm(employee.id);
    toast.success(`${employee.name} has been deactivated`);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldOff className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">Deactivate Employee</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to deactivate <strong className="text-foreground">{employee.name}</strong>?
              </p>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  This action will:
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Immediately revoke their system access</li>
                  <li>Block them from logging in or signing up</li>
                  <li>Set their status to inactive</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                To restore access, an Admin or CEO must reactivate the employee from the Employees page.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
