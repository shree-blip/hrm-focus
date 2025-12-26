import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Building, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface EmployeeProfileDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeProfileDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeProfileDialogProps) {
  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Employee Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Header with Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                {employee.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{employee.name}</h3>
              <p className="text-muted-foreground">{employee.role}</p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-2",
                  employee.status === "active" && "border-success/50 text-success bg-success/10",
                  employee.status === "probation" && "border-warning/50 text-warning bg-warning/10"
                )}
              >
                {employee.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Contact Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                  {employee.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{employee.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="flex items-center gap-2">
                  {employee.location === "US" ? "🇺🇸" : "🇳🇵"} {employee.location}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Work Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Work Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{employee.role}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
