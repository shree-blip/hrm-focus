import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Filter, MoreHorizontal, Clock, AlertCircle, GripVertical, CheckCircle2, Circle, Timer, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useTasks } from "@/hooks/useTasks";
import { format } from "date-fns";

interface TaskUI {
  id: string;
  title: string;
  client: string;
  assignee: { name: string; initials: string };
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: "todo" | "in-progress" | "review" | "done";
  timeEstimate: string;
}

const columns = [
  { id: "todo", title: "To Do", icon: Circle },
  { id: "in-progress", title: "In Progress", icon: Timer },
  { id: "review", title: "Review", icon: Clock },
  { id: "done", title: "Done", icon: CheckCircle2 },
];

const Tasks = () => {
  const { tasks, loading, createTask, updateTask, updateTaskStatus, deleteTask } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState<TaskUI["status"]>("todo");
  const [selectedTask, setSelectedTask] = useState<TaskUI | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<TaskUI | null>(null);

  // Transform database tasks to UI format
  const transformedTasks: TaskUI[] = tasks.map(task => ({
    id: task.id,
    title: task.title,
    client: task.client_name || "Internal",
    assignee: { name: "Assigned", initials: "??" },
    priority: (task.priority as "high" | "medium" | "low") || "medium",
    dueDate: task.due_date ? format(new Date(task.due_date), "MMM d") : "No date",
    status: (task.status?.replace("_", "-") as TaskUI["status"]) || "todo",
    timeEstimate: task.time_estimate || "-",
  }));

  const getTasksByStatus = (status: string) => transformedTasks.filter((task) => 
    task.status === status && 
    (task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     task.client.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddTask = async (task: {
    title: string;
    client?: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
    status: "todo" | "in-progress" | "review" | "done";
    timeEstimate?: string;
    assigneeId: string | null;
  }) => {
    const statusDbMap: Record<string, "todo" | "in-progress" | "review" | "done"> = { 
      "in-progress": "in-progress", "todo": "todo", "review": "review", "done": "done" 
    };
    // Parse due date from string (format: YYYY-MM-DD)
    const dueDate = task.dueDate && task.dueDate !== "No date" ? new Date(task.dueDate) : undefined;
    
    await createTask({
      title: task.title,
      client_name: task.client,
      priority: task.priority,
      due_date: dueDate,
      status: statusDbMap[task.status] || "todo",
      time_estimate: task.timeEstimate,
      description: undefined,
      assignee_id: task.assigneeId === "unassigned" ? undefined : task.assigneeId || undefined,
    });
  };

  const handleUpdateTask = async (updatedTask: TaskUI) => {
    await updateTask(updatedTask.id, {
      title: updatedTask.title,
      client_name: updatedTask.client,
      priority: updatedTask.priority,
      status: updatedTask.status,
      time_estimate: updatedTask.timeEstimate,
    });
    setTaskDetailOpen(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setTaskDetailOpen(false);
  };

  const handleDragStart = (e: React.DragEvent, task: TaskUI) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskUI["status"]) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      await updateTaskStatus(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
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
            <div key={column.id} className="flex flex-col" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id as TaskUI["status"])}>
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", column.id === "done" && "text-success", column.id === "in-progress" && "text-info", column.id === "review" && "text-warning")} />
                  <h3 className="font-display font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNewTaskDefaultStatus(column.id as TaskUI["status"]); setNewTaskDialogOpen(true); }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {columnTasks.map((task, index) => (
                  <Card 
                    key={task.id} 
                    className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all animate-scale-in relative" 
                    style={{ animationDelay: `${300 + index * 50}ms` }} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, task)} 
                    onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}
                  >
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
