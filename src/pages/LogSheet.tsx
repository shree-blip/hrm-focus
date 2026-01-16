import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EditHistoryDialog } from "@/components/logsheet/EditHistoryDialog";
import { useWorkLogs, WorkLogInput } from "@/hooks/useWorkLogs";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { CalendarIcon, Plus, Clock, Pencil, Trash2, Users, FileText, History } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LogSheet() {
  const { logs, teamLogs, loading, selectedDate, setSelectedDate, addLog, updateLog, deleteLog } = useWorkLogs();
  const { isManager, isVP } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLogForHistory, setSelectedLogForHistory] = useState<{ id: string; task: string } | null>(null);

  const [formData, setFormData] = useState<WorkLogInput>({
    task_description: "",
    time_spent_minutes: 0,
    notes: "",
  });

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const resetForm = () => {
    setFormData({ task_description: "", time_spent_minutes: 0, notes: "" });
    setHours(0);
    setMinutes(0);
    setEditingLog(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalMinutes = hours * 60 + minutes;
    
    if (editingLog) {
      await updateLog(editingLog, { ...formData, time_spent_minutes: totalMinutes });
    } else {
      await addLog({ ...formData, time_spent_minutes: totalMinutes });
    }
    
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (log: any) => {
    setFormData({
      task_description: log.task_description,
      time_spent_minutes: log.time_spent_minutes,
      notes: log.notes || "",
    });
    setHours(Math.floor(log.time_spent_minutes / 60));
    setMinutes(log.time_spent_minutes % 60);
    setEditingLog(log.id);
    setIsAddDialogOpen(true);
  };

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const totalTimeToday = logs.reduce((sum, log) => sum + log.time_spent_minutes, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Log Sheet</h1>
            <p className="text-muted-foreground">Track your daily work activities</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Log
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingLog ? "Edit Work Log" : "Add Work Log"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task">Task Description *</Label>
                    <Textarea
                      id="task"
                      placeholder="What did you work on?"
                      value={formData.task_description}
                      onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Time Spent *</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          value={hours}
                          onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">hours</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={minutes}
                          onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsAddDialogOpen(false);
                      resetForm();
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!formData.task_description || (hours === 0 && minutes === 0)}>
                      {editingLog ? "Update" : "Add"} Log
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time Logged Today</p>
                <p className="text-3xl font-bold text-foreground">{formatTime(totalTimeToday)}</p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {logs.length} {logs.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for My Logs and Team Logs */}
        <Tabs defaultValue="my-logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="my-logs" className="gap-2">
              <FileText className="h-4 w-4" />
              My Logs
            </TabsTrigger>
            {(isManager || isVP) && (
              <TabsTrigger value="team-logs" className="gap-2">
                <Users className="h-4 w-4" />
                Team Logs
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Work Logs - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No work logs for this date</p>
                    <p className="text-sm">Click "Add Log" to start tracking</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Description</TableHead>
                        <TableHead>Time Spent</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium max-w-xs">
                            <p className="truncate">{log.task_description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs">
                            <p className="truncate">{log.notes || "-"}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedLogForHistory({ id: log.id, task: log.task_description });
                                  setHistoryDialogOpen(true);
                                }}
                                title="View edit history"
                              >
                                <History className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(log)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLog(log.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isManager || isVP) && (
            <TabsContent value="team-logs">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Work Logs - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : teamLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No team logs for this date</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Task Description</TableHead>
                          <TableHead>Time Spent</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {log.employee?.first_name} {log.employee?.last_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.employee?.department || "N/A"}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="truncate">{log.task_description}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-xs">
                              <p className="truncate">{log.notes || "-"}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Edit History Dialog */}
        {selectedLogForHistory && (
          <EditHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            workLogId={selectedLogForHistory.id}
            taskDescription={selectedLogForHistory.task}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
