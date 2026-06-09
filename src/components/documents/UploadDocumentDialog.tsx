import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DRIVE_LINK_HELPER_TEXT, isValidDriveLink } from "@/lib/driveLinks";

export interface DriveDocItem {
  name: string;
  category: string;
  driveLink: string;
  employeeId?: string;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: DriveDocItem[]) => Promise<void> | void;
}

const CATEGORY_INFO: Record<string, string> = {
  Contracts: "Private - Visible to you, the assigned employee, VP, and admins.",
  Policies: "Public - Visible to all employees",
  Compliance: "Private - Visible only to the uploader, the assigned employee, admins, and CEO.",
  "Leave Evidence": "Restricted - Visible to you, managers, line managers, VPs, and admins",
};

interface EmployeeOption {
  id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  employee_id: string | null;
}

interface LinkRow {
  name: string;
  link: string;
}

const emptyRow = (): LinkRow => ({ name: "", link: "" });

const DriveHelper = () => <p className="text-xs text-muted-foreground">{DRIVE_LINK_HELPER_TEXT}</p>;

export function UploadDocumentDialog({ open, onOpenChange, onSubmit }: UploadDocumentDialogProps) {
  const { user, isAdmin, isVP, isManager, isLineManager } = useAuth();
  const [category, setCategory] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Contracts
  const [contractEmployeeId, setContractEmployeeId] = useState("");
  const [contractName, setContractName] = useState("");
  const [contractLink, setContractLink] = useState("");

  // Policies (bulk)
  const [policyRows, setPolicyRows] = useState<LinkRow[]>([emptyRow()]);

  // Compliance (multi-select employees + multiple links)
  const [complianceEmployeeIds, setComplianceEmployeeIds] = useState<string[]>([]);
  const [complianceRows, setComplianceRows] = useState<LinkRow[]>([emptyRow()]);
  // Per-employee document fields for managers (employeeId -> { name, link })
  const [complianceDocsByEmployee, setComplianceDocsByEmployee] = useState<Record<string, LinkRow>>({});
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Leave Evidence
  const [leaveName, setLeaveName] = useState("");
  const [leaveLink, setLeaveLink] = useState("");

  const isManagerOrAbove = isAdmin || isVP || isManager || isLineManager;

  useEffect(() => {
    if (open) fetchEmployees();
  }, [open]);

  useEffect(() => {
    if (!user) return;
    const fetchOwnEmployeeId = async () => {
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (profile) {
        const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", profile.id).maybeSingle();
        if (emp) setCurrentUserEmployeeId(emp.id);
      }
    };
    fetchOwnEmployeeId();
  }, [user]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, profile_id, first_name, last_name, employee_id")
      .eq("status", "active")
      .order("first_name");
    if (!error && data) setEmployees(data);
    setLoadingEmployees(false);
  };

  const getAvailableCategories = () => {
    const cats: { value: string; label: string }[] = [];
    if (isVP) cats.push({ value: "Contracts", label: "Contracts" });
    cats.push({ value: "Policies", label: "Policies" });
    cats.push({ value: "Compliance", label: "Compliance" });
    cats.push({ value: "Leave Evidence", label: "Leave Evidence" });
    return cats;
  };

  const resetForm = () => {
    setCategory("");
    setContractEmployeeId("");
    setContractName("");
    setContractLink("");
    setPolicyRows([emptyRow()]);
    setComplianceEmployeeIds([]);
    setComplianceRows([emptyRow()]);
    setComplianceDocsByEmployee({});
    setEmployeeSearch("");
    setLeaveName("");
    setLeaveLink("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const toggleComplianceEmployee = (id: string) => {
    setComplianceEmployeeIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
    setComplianceDocsByEmployee((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = emptyRow();
      }
      return next;
    });
  };

  const setComplianceDocField = (empId: string, field: keyof LinkRow, value: string) => {
    setComplianceDocsByEmployee((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] || emptyRow()), [field]: value },
    }));
  };

  const getEmployeeLabel = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return "Employee";
    return `${emp.first_name} ${emp.last_name}${emp.employee_id ? ` (${emp.employee_id})` : ""}`;
  };

  const buildItems = (): DriveDocItem[] | null => {
    if (category === "Contracts") {
      if (!contractEmployeeId) {
        toast({ title: "Employee Required", description: "Please select an employee.", variant: "destructive" });
        return null;
      }
      if (!contractName.trim()) {
        toast({ title: "Name Required", description: "Please enter a contract name.", variant: "destructive" });
        return null;
      }
      if (!isValidDriveLink(contractLink)) {
        toast({ title: "Invalid Link", description: "Please paste a valid Google Drive link.", variant: "destructive" });
        return null;
      }
      return [
        { name: contractName.trim(), category: "Contracts", driveLink: contractLink.trim(), employeeId: contractEmployeeId },
      ];
    }

    if (category === "Policies") {
      const valid = policyRows.filter((r) => r.name.trim() && r.link.trim());
      if (valid.length === 0) {
        toast({ title: "Missing Information", description: "Add at least one policy name and link.", variant: "destructive" });
        return null;
      }
      for (const r of valid) {
        if (!isValidDriveLink(r.link)) {
          toast({ title: "Invalid Link", description: `"${r.name}" has an invalid Google Drive link.`, variant: "destructive" });
          return null;
        }
      }
      return valid.map((r) => ({ name: r.name.trim(), category: "Policies", driveLink: r.link.trim() }));
    }

    if (category === "Compliance") {
      if (isManagerOrAbove) {
        // Each selected employee has their own document name + link.
        if (complianceEmployeeIds.length === 0) {
          toast({ title: "Employee Required", description: "Select at least one employee.", variant: "destructive" });
          return null;
        }

        const items: DriveDocItem[] = [];
        for (const empId of complianceEmployeeIds) {
          const row = complianceDocsByEmployee[empId] || emptyRow();
          const name = row.name.trim();
          const link = row.link.trim();
          if (!name || !link) {
            toast({
              title: "Missing Information",
              description: `Enter a document name and link for ${getEmployeeLabel(empId)}.`,
              variant: "destructive",
            });
            return null;
          }
          if (!isValidDriveLink(link)) {
            toast({
              title: "Invalid Link",
              description: `${getEmployeeLabel(empId)} has an invalid Google Drive link.`,
              variant: "destructive",
            });
            return null;
          }
          items.push({ name, category: "Compliance", driveLink: link, employeeId: empId });
        }
        return items;
      }

      // Regular employees target themselves.
      const valid = complianceRows.filter((r) => r.name.trim() && r.link.trim());
      if (valid.length === 0) {
        toast({ title: "Missing Information", description: "Add at least one document name and link.", variant: "destructive" });
        return null;
      }
      for (const r of valid) {
        if (!isValidDriveLink(r.link)) {
          toast({ title: "Invalid Link", description: `"${r.name}" has an invalid Google Drive link.`, variant: "destructive" });
          return null;
        }
      }
      if (!currentUserEmployeeId) {
        toast({ title: "Employee Required", description: "No employee record found.", variant: "destructive" });
        return null;
      }
      return valid.map((r) => ({
        name: r.name.trim(),
        category: "Compliance",
        driveLink: r.link.trim(),
        employeeId: currentUserEmployeeId,
      }));
    }

    if (category === "Leave Evidence") {
      if (!leaveName.trim()) {
        toast({ title: "Name Required", description: "Please enter a document name.", variant: "destructive" });
        return null;
      }
      if (!isValidDriveLink(leaveLink)) {
        toast({ title: "Invalid Link", description: "Please paste a valid Google Drive link.", variant: "destructive" });
        return null;
      }
      return [
        {
          name: leaveName.trim(),
          category: "Leave Evidence",
          driveLink: leaveLink.trim(),
          employeeId: currentUserEmployeeId || undefined,
        },
      ];
    }

    toast({ title: "Missing Information", description: "Please select a category.", variant: "destructive" });
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = buildItems();
    if (!items) return;
    setSubmitting(true);
    try {
      await onSubmit(items);
      resetForm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name} ${emp.employee_id || ""}`.toLowerCase().includes(employeeSearch.toLowerCase()),
  );

  const availableCategories = getAvailableCategories();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Document Link</DialogTitle>
          <DialogDescription>Save a Google Drive link and document details to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Document Category *</Label>
            <Select value={category} onValueChange={(val) => setCategory(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{CATEGORY_INFO[category]}</AlertDescription>
            </Alert>
          )}

          {/* Contracts */}
          {category === "Contracts" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Employee *</Label>
                <Select value={contractEmployeeId} onValueChange={setContractEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select an employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contract Name *</Label>
                <Input value={contractName} onChange={(e) => setContractName(e.target.value)} placeholder="e.g. Employment Contract 2026" />
              </div>
              <div className="space-y-2">
                <Label>Google Drive Link *</Label>
                <Input value={contractLink} onChange={(e) => setContractLink(e.target.value)} placeholder="https://drive.google.com/..." />
                <DriveHelper />
              </div>
            </div>
          )}

          {/* Policies (bulk) */}
          {category === "Policies" && (
            <div className="space-y-3">
              <Label>Policies *</Label>
              {policyRows.map((row, idx) => (
                <div key={idx} className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Policy {idx + 1}</span>
                    {policyRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPolicyRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Policy name"
                    value={row.name}
                    onChange={(e) =>
                      setPolicyRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                    }
                  />
                  <Input
                    placeholder="https://drive.google.com/..."
                    value={row.link}
                    onChange={(e) =>
                      setPolicyRows((prev) => prev.map((r, i) => (i === idx ? { ...r, link: e.target.value } : r)))
                    }
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setPolicyRows((prev) => [...prev, emptyRow()])}>
                <Plus className="h-4 w-4" /> Add another policy
              </Button>
              <DriveHelper />
            </div>
          )}

          {/* Compliance */}
          {category === "Compliance" && (
            <div className="space-y-4">
              {isManagerOrAbove && (
                <div className="space-y-2">
                  <Label>Select Employees *</Label>
                  <Input
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {filteredEmployees.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={complianceEmployeeIds.includes(emp.id)}
                          onCheckedChange={() => toggleComplianceEmployee(emp.id)}
                        />
                        <span>
                          {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ""}
                        </span>
                      </label>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">No employees found</p>
                    )}
                  </div>
                  {complianceEmployeeIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">{complianceEmployeeIds.length} employee(s) selected</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Label>Compliance Documents *</Label>
                {complianceRows.map((row, idx) => (
                  <div key={idx} className="space-y-2 border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Document {idx + 1}</span>
                      {complianceRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setComplianceRows((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Document name"
                      value={row.name}
                      onChange={(e) =>
                        setComplianceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                      }
                    />
                    <Input
                      placeholder="https://drive.google.com/..."
                      value={row.link}
                      onChange={(e) =>
                        setComplianceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, link: e.target.value } : r)))
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setComplianceRows((prev) => [...prev, emptyRow()])}
                >
                  <Plus className="h-4 w-4" /> Add another link
                </Button>
                <DriveHelper />
              </div>
            </div>
          )}

          {/* Leave Evidence */}
          {category === "Leave Evidence" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input value={leaveName} onChange={(e) => setLeaveName(e.target.value)} placeholder="e.g. Medical Certificate" />
              </div>
              <div className="space-y-2">
                <Label>Google Drive Link *</Label>
                <Input value={leaveLink} onChange={(e) => setLeaveLink(e.target.value)} placeholder="https://drive.google.com/..." />
                <DriveHelper />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
