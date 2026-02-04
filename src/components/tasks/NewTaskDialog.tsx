import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/useEmployees";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Building2 } from "lucide-react";
import { AddClientDialog } from "@/components/logsheet/AddClientDialog";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: {
    title: string;
    client: string;
    clientId?: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
    status: "todo" | "in-progress" | "review" | "done";
    timeEstimate: string;
    assigneeIds: string[];
  }) => void;
  defaultStatus?: "todo" | "in-progress" | "review" | "done";
}

export function NewTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultStatus = "todo",
}: NewTaskDialogProps) {
  const { employees, loading: employeesLoading } = useEmployees();
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClients();
  const { user, profile } = useAuth();
  
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [status, setStatus] = useState<"todo" | "in-progress" | "review" | "done">(defaultStatus);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setTitle("");
      setSelectedClientId("");
      setPriority("medium");
      setDueDate("");
      setTimeEstimate("");
      setSelectedAssignees([]);
    }
  }, [open, defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      toast({
        title: "Missing Information",
        description: "Please enter a task title.",
        variant: "destructive",
      });
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);

    onSubmit({
      title,
      client: selectedClient?.name || "",
      clientId: selectedClientId || undefined,
      priority,
      dueDate,
      status,
      timeEstimate: timeEstimate || undefined,
      assigneeIds: selectedAssignees,
    });

    onOpenChange(false);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const handleClientAdded = () => {
    refetchClients();
    setShowAddClientDialog(false);
  };

  // Build list of assignable users (current user + employees with user_id)
  const assignableUsers = [
    ...(user && profile ? [{
      id: user.id,
      name: `${profile.first_name} ${profile.last_name} (Me)`,
      initials: getInitials(profile.first_name, profile.last_name),
    }] : []),
    ...employees
      .filter(emp => emp.user_id && emp.user_id !== user?.id)
      .map(emp => ({
        id: emp.user_id!,
        name: `${emp.first_name} ${emp.last_name}`,
        initials: getInitials(emp.first_name, emp.last_name),
      }))
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to the board.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <div className="flex gap-2">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a client">
                      {selectedClientId && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {clients.find(c => c.id === selectedClientId)?.name || "Select client"}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Internal
                      </div>
                    </SelectItem>
                    {clientsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {client.name}
                            {client.client_id && (
                              <span className="text-xs text-muted-foreground">({client.client_id})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddClientDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "todo" | "in-progress" | "review" | "done")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeEstimate">Time Estimate</Label>
                <Input
                  id="timeEstimate"
                  placeholder="e.g., 4h"
                  value={timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign To ({selectedAssignees.length} selected)</Label>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                {employeesLoading ? (
                  <p className="text-sm text-muted-foreground p-2">Loading...</p>
                ) : assignableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No users available</p>
                ) : (
                  <div className="space-y-2">
                    {assignableUsers.map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => toggleAssignee(assignee.id)}
                      >
                        <Checkbox
                          checked={selectedAssignees.includes(assignee.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleAssignee(assignee.id)}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {assignee.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{assignee.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AddClientDialog
        open={showAddClientDialog}
        onOpenChange={setShowAddClientDialog}
        onClientAdded={handleClientAdded}
      />
    </>
  );
}
