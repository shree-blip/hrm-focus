import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  status: string | null;
}

interface AddToTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTeamMemberIds: string[];
  onAdded: (success: boolean, count: number) => void;
  /** Optional: if provided, assigns employees to this employee's team instead of the logged-in user's team */
  targetEmployeeId?: string;
}

export function AddToTeamDialog({
  open,
  onOpenChange,
  currentTeamMemberIds,
  onAdded,
  targetEmployeeId,
}: AddToTeamDialogProps) {
  const { user } = useAuth();
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchData();
    }
    if (!open) {
      setSelectedIds([]);
      setSearchQuery("");
    }
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Get my employee ID
    const { data: empId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
    });
    setMyEmployeeId(empId);

    // The ID to exclude from the list (target employee or self)
    const excludeId = targetEmployeeId || empId;

    // Fetch all active employees
    const { data: employees } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, department, job_title, status")
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (employees) {
      // Filter out current team members and the target/self
      const available = employees.filter((e) => !currentTeamMemberIds.includes(e.id) && e.id !== excludeId);
      setAllEmployees(available);
    }

    setLoading(false);
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const filteredEmployees = allEmployees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleAssign = async () => {
    // Use targetEmployeeId if provided, otherwise use logged-in user's employee ID
    const assignToId = targetEmployeeId || myEmployeeId;
    if (!assignToId || selectedIds.length === 0) return;
    setSaving(true);

    let successCount = 0;
    for (const empId of selectedIds) {
      const { error } = await supabase.from("employees").update({ line_manager_id: assignToId }).eq("id", empId);

      if (!error) successCount++;
    }

    if (successCount > 0) {
      onOpenChange(false);
      await onAdded(true, successCount);
    } else {
      onOpenChange(false);
      await onAdded(false, 0);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {targetEmployeeId ? "Add to Team" : "Add to My Team"}
          </DialogTitle>
          <DialogDescription>
            Select employees to assign {targetEmployeeId ? "to this person's team" : "to your team"} as direct reports.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[320px] rounded-md border p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "No matching employees found" : "No unassigned employees available"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-accent/50"
                    }`}
                    onClick={() => toggleSelection(emp.id)}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(emp.first_name, emp.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.job_title || "Employee"} • {emp.department || "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {selectedIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} employee{selectedIds.length > 1 ? "s" : ""} selected
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={selectedIds.length === 0 || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? "Assigning..." : `Add to Team (${selectedIds.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
