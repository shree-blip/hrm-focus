import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Filter, MoreHorizontal, Clock, AlertCircle, GripVertical, CheckCircle2, Circle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  client: string;
  assignee: { name: string; initials: string };
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: "todo" | "in-progress" | "review" | "done";
  timeEstimate: string;
}

const initialTasks: Task[] = [
  { id: "1", title: "Monthly Bank Reconciliation", client: "Tech Solutions Inc", assignee: { name: "Sarah Johnson", initials: "SJ" }, priority: "high", dueDate: "Today", status: "in-progress", timeEstimate: "4h" },
  { id: "2", title: "Q4 Tax Return Preparation", client: "Retail Corp", assignee: { name: "Michael Chen", initials: "MC" }, priority: "high", dueDate: "Dec 28", status: "todo", timeEstimate: "8h" },
  { id: "3", title: "Payroll Processing - December", client: "Internal", assignee: { name: "Emily Davis", initials: "ED" }, priority: "medium", dueDate: "Dec 30", status: "todo", timeEstimate: "3h" },
  { id: "4", title: "Expense Report Audit", client: "StartUp Ltd", assignee: { name: "Lisa Park", initials: "LP" }, priority: "low", dueDate: "Dec 31", status: "review", timeEstimate: "2h" },
  { id: "5", title: "Client Onboarding Documentation", client: "New Ventures", assignee: { name: "James Wilson", initials: "JW" }, priority: "medium", dueDate: "Jan 2", status: "done", timeEstimate: "1h" },
  { id: "6", title: "Sales Tax Filing - Q4", client: "E-Commerce Plus", assignee: { name: "Sarah Johnson", initials: "SJ" }, priority: "high", dueDate: "Jan 15", status: "todo", timeEstimate: "6h" },
];

const columns = [
  { id: "todo", title: "To Do", icon: Circle },
  { id: "in-progress", title: "In Progress", icon: Timer },
  { id: "review", title: "Review", icon: Clock },
  { id: "done", title: "Done", icon: CheckCircle2 },
];

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState<Task["status"]>("todo");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const getTasksByStatus = (status: string) => tasks.filter((task) => task.status === status && (task.title.toLowerCase().includes(searchQuery.toLowerCase()) || task.client.toLowerCase().includes(searchQuery.toLowerCase())));

  const handleAddTask = (task: Omit<Task, "id">) => {
    setTasks((prev) => [...prev, { ...task, id: Date.now().toString() }]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: Task["status"]) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      setTasks((prev) => prev.map((t) => (t.id === draggedTask.id ? { ...t, status: newStatus } : t)));
      toast({ title: "Task Moved", description: `Task moved to ${newStatus.replace("-", " ")}.` });
    }
    setDraggedTask(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Task Management</h1>
          <p className="text-muted-foreground mt-1">Organize and track team tasks efficiently</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={() => { setNewTaskDefaultStatus("todo"); setNewTaskDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          const Icon = column.icon;
          return (
            <div key={column.id} className="flex flex-col" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id as Task["status"])}>
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", column.id === "done" && "text-success", column.id === "in-progress" && "text-info", column.id === "review" && "text-warning")} />
                  <h3 className="font-display font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNewTaskDefaultStatus(column.id as Task["status"]); setNewTaskDialogOpen(true); }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {columnTasks.map((task, index) => (
                  <Card key={task.id} className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all animate-scale-in relative" style={{ animationDelay: `${300 + index * 50}ms` }} draggable onDragStart={(e) => handleDragStart(e, task)} onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        </div>
                        <Badge variant="outline" className={cn("text-xs", task.priority === "high" && "border-destructive/50 text-destructive", task.priority === "medium" && "border-warning/50 text-warning", task.priority === "low" && "border-muted-foreground/50")}>{task.priority}</Badge>
                      </div>
                      <h4 className="font-medium text-sm mb-1 line-clamp-2">{task.title}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{task.client}</p>
                      <div className="flex items-center justify-between">
                        <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{task.assignee.initials}</AvatarFallback></Avatar>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.timeEstimate}</span>
                          <span className={cn("flex items-center gap-1", task.dueDate === "Today" && "text-destructive font-medium")}>{task.dueDate === "Today" && <AlertCircle className="h-3 w-3" />}{task.dueDate}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setTaskDetailOpen(true); }}>Edit Task</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
                {columnTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground bg-accent/30 rounded-lg border-2 border-dashed border-border">
                    <Circle className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewTaskDialog open={newTaskDialogOpen} onOpenChange={setNewTaskDialogOpen} onSubmit={handleAddTask} defaultStatus={newTaskDefaultStatus} />
      <TaskDetailDialog task={selectedTask} open={taskDetailOpen} onOpenChange={setTaskDetailOpen} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
    </DashboardLayout>
  );
};

export default Tasks;
