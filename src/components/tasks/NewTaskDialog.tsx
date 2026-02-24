import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    assigneeIds: string[];
    isInternal: boolean;
  }) => void;
  defaultStatus?: "todo" | "in-progress" | "review" | "done";
}

export function NewTaskDialog({ open, onOpenChange, onSubmit, defaultStatus = "todo" }: NewTaskDialogProps) {
  const { employees, loading: employeesLoading } = useEmployees();
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClients();
  const { user, profile } = useAuth();

  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("internal");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [status, setStatus] = useState<"todo" | "in-progress" | "review" | "done">(defaultStatus);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setTitle("");
      setSelectedClientId("internal");
      setPriority("medium");
      setDueDate("");
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

    const isInternal = selectedClientId === "internal";
    const selectedClient = clients.find((c) => c.id === selectedClientId);

    onSubmit({
      title,
      client: isInternal ? "Internal" : selectedClient?.name || "",
      clientId: isInternal ? undefined : selectedClientId,
      priority,
      dueDate,
      status,
      assigneeIds: selectedAssignees,
      isInternal,
    });

    onOpenChange(false);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
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
    ...(user && profile
      ? [
          {
            id: user.id,
            name: `${profile.first_name} ${profile.last_name} (Me)`,
            initials: getInitials(profile.first_name, profile.last_name),
          },
        ]
      : []),
    ...employees
      .filter((emp) => emp.user_id && emp.user_id !== user?.id)
      .map((emp) => ({
        id: emp.user_id!,
        name: `${emp.first_name} ${emp.last_name}`,
        initials: getInitials(emp.first_name, emp.last_name),
      })),
  ];

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const filteredAssignees = assignableUsers.filter((user) =>
    user.name.toLowerCase().includes(assigneeSearch.toLowerCase()),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create New Task</DialogTitle>
            <DialogDescription>Add a new task to the board.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Task Title <span className="text-destructive">*</span>
              </Label>
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
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {selectedClientId === "internal"
                          ? "Internal (Personal Task)"
                          : clients.find((c) => c.id === selectedClientId)?.name || "Select client"}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Internal (Personal Task)
                      </div>
                    </SelectItem>
                    {clientsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
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
                <Button type="button" variant="outline" size="icon" onClick={() => setShowAddClientDialog(true)}>
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
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
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer select-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleAssignee(assignee.id);
                        }}
                      >
                        <div
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selectedAssignees.includes(assignee.id)
                              ? "bg-primary border-primary"
                              : "border-muted-foreground bg-background"
                          }`}
                        >
                          {selectedAssignees.includes(assignee.id) && (
                            <svg
                              className="h-3 w-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
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
