import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Search, Download, Loader2, Check, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getCurrentLocalTime, getTimezoneAbbr, getUTCOffsetString } from "@/utils/timezoneUtils";

interface EmployeeTimezoneRow {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
  timezone: string;
  timezone_status: string;
  email: string;
}

const COMMON_TIMEZONES = [
  "Asia/Kathmandu",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const TimezoneManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeTimezoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTimezone, setFilterTimezone] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editEmployee, setEditEmployee] = useState<EmployeeTimezoneRow | null>(null);
  const [editTimezone, setEditTimezone] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editMarkVerified, setEditMarkVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTimezone, setBulkTimezone] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, first_name, last_name, department, job_title, timezone, timezone_status, email")
      .eq("status", "active")
      .order("first_name");

    if (!error && data) {
      setEmployees(data as EmployeeTimezoneRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Refresh local times every 60 seconds
  useEffect(() => {
    const updateTimes = () => {
      const times: Record<string, string> = {};
      employees.forEach((emp) => {
        times[emp.id] = getCurrentLocalTime(emp.timezone);
      });
      setLocalTimes(times);
    };
    updateTimes();
    const interval = setInterval(updateTimes, 60000);
    return () => clearInterval(interval);
  }, [employees]);

  const uniqueTimezones = useMemo(() => {
    const tzSet = new Set(employees.map((e) => e.timezone));
    return Array.from(tzSet).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
          (e.department || "").toLowerCase().includes(q)
      );
    }
    if (filterTimezone !== "all") {
      result = result.filter((e) => e.timezone === filterTimezone);
    }
    return result;
  }, [employees, searchQuery, filterTimezone]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const openEdit = (emp: EmployeeTimezoneRow) => {
    setEditEmployee(emp);
    setEditTimezone(emp.timezone);
    setEditReason("");
    setEditMarkVerified(false);
  };

  const saveTimezone = async () => {
    if (!editEmployee || !editReason.trim() || !user) return;
    setSaving(true);

    const updates: Record<string, any> = {
      timezone: editTimezone,
      timezone_effective_from: new Date().toISOString().split("T")[0],
    };
    if (editMarkVerified) {
      updates.timezone_status = "verified";
      updates.timezone_verified_at = new Date().toISOString();
      updates.timezone_verified_by = user.id;
    }

    const { error } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", editEmployee.id);

    if (!error) {
      // Log the change
      await supabase.from("timezone_change_log" as any).insert({
        employee_id: editEmployee.id,
        old_timezone: editEmployee.timezone,
        new_timezone: editTimezone,
        reason: editReason,
        changed_by: user.id,
      });

      toast({ title: "Timezone Updated", description: `${editEmployee.first_name}'s timezone updated to ${editTimezone}` });
      setEditEmployee(null);
      fetchEmployees();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const saveBulkTimezone = async () => {
    if (!bulkTimezone || !bulkReason.trim() || selectedIds.size === 0 || !user) return;
    setSaving(true);

    const updates: Record<string, any> = {
      timezone: bulkTimezone,
      timezone_status: "verified",
      timezone_verified_at: new Date().toISOString(),
      timezone_verified_by: user.id,
      timezone_effective_from: new Date().toISOString().split("T")[0],
    };

    const { error } = await supabase
      .from("employees")
      .update(updates)
      .in("id", Array.from(selectedIds));

    if (!error) {
      // Log changes
      const logs = Array.from(selectedIds).map((id) => {
        const emp = employees.find((e) => e.id === id);
        return {
          employee_id: id,
          old_timezone: emp?.timezone || "Asia/Kathmandu",
          new_timezone: bulkTimezone,
          reason: bulkReason,
          changed_by: user.id,
        };
      });
      await supabase.from("timezone_change_log" as any).insert(logs);

      toast({ title: "Bulk Update Complete", description: `Updated ${selectedIds.size} employees` });
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      fetchEmployees();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const exportList = () => {
    const headers = ["Name", "Department", "Role", "Timezone", "UTC Offset", "Status"];
    const rows = filteredEmployees.map((e) =>
      [
        `${e.first_name} ${e.last_name}`,
        e.department || "-",
        e.job_title || "-",
        e.timezone,
        getUTCOffsetString(e.timezone),
        e.timezone_status,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-timezones.csv";
    a.click();
    toast({ title: "Exported", description: "Timezone list downloaded." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="outline" className="border-success text-success bg-success/10 gap-1">
            <Check className="h-3 w-3" /> Verified
          </Badge>
        );
      case "conflict":
        return (
          <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 gap-1">
            <AlertTriangle className="h-3 w-3" /> Conflict
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-warning text-warning bg-warning/10 gap-1">
            <AlertTriangle className="h-3 w-3" /> Default
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <Globe className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-display font-bold text-foreground">Timezone Management</h1>
        </div>
        <p className="text-muted-foreground">
          Attendance times are recorded in each employee's assigned timezone. Keep these accurate.
        </p>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTimezone} onValueChange={setFilterTimezone}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Timezones</SelectItem>
                {uniqueTimezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz} ({getTimezoneAbbr(tz)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIds.size >= 2 && (
              <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                Bulk Update ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={exportList}>
              <Download className="h-4 w-4" />
              Export List
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Timezone (IANA)</TableHead>
                  <TableHead>Local Time Now</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(emp.id)}
                          onCheckedChange={() => toggleSelect(emp.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {emp.first_name} {emp.last_name}
                      </TableCell>
                      <TableCell>{emp.department || "-"}</TableCell>
                      <TableCell>{emp.job_title || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{emp.timezone}</div>
                          <div className="text-xs text-muted-foreground">
                            {getTimezoneAbbr(emp.timezone)} · {getUTCOffsetString(emp.timezone)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {localTimes[emp.id] || "—"} {getTimezoneAbbr(emp.timezone)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(emp.timezone_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Single Employee Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Update Timezone — {editEmployee?.first_name} {editEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Timezone</Label>
              <Input
                value={`${editEmployee?.timezone || ""} (${editEmployee ? getUTCOffsetString(editEmployee.timezone) : ""})`}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>New Timezone</Label>
              <Select value={editTimezone} onValueChange={setEditTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz} — {getTimezoneAbbr(tz)} ({getUTCOffsetString(tz)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why is this timezone being changed?"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mark-verified"
                checked={editMarkVerified}
                onCheckedChange={(v) => setEditMarkVerified(v as boolean)}
              />
              <Label htmlFor="mark-verified" className="text-sm">
                Mark as Verified (removes ⚠ Default badge)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              Historical UTC records are preserved. Only how past records are displayed will change.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmployee(null)}>
              Cancel
            </Button>
            <Button onClick={saveTimezone} disabled={saving || !editReason.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Timezone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Bulk Timezone Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Updating {selectedIds.size} employee(s):
            </p>
            <div className="max-h-32 overflow-y-auto text-sm space-y-1">
              {Array.from(selectedIds).map((id) => {
                const emp = employees.find((e) => e.id === id);
                return emp ? (
                  <div key={id}>
                    • {emp.first_name} {emp.last_name}
                  </div>
                ) : null;
              })}
            </div>
            <div className="space-y-2">
              <Label>New Timezone</Label>
              <Select value={bulkTimezone} onValueChange={setBulkTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz} — {getTimezoneAbbr(tz)} ({getUTCOffsetString(tz)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Reason for bulk timezone change"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBulkTimezone} disabled={saving || !bulkReason.trim() || !bulkTimezone}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update {selectedIds.size} Employees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TimezoneManagement;
