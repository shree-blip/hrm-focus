import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, CheckCheck, Calendar, FileText, Clock, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  title: string;
  description: string;
  time: string;
  type: "leave" | "task" | "onboarding" | "payroll" | "general";
  read: boolean;
}

const initialNotifications: Notification[] = [
  {
    id: 1,
    title: "Leave Request Pending",
    description: "Sarah Johnson requested 3 days off (Dec 27-29)",
    time: "2 min ago",
    type: "leave",
    read: false,
  },
  {
    id: 2,
    title: "Task Overdue",
    description: "Monthly Reconciliation - Client A is past due",
    time: "1 hour ago",
    type: "task",
    read: false,
  },
  {
    id: 3,
    title: "New Employee Onboarded",
    description: "Michael Chen joined the Tax team",
    time: "3 hours ago",
    type: "onboarding",
    read: false,
  },
  {
    id: 4,
    title: "Payroll Processing Complete",
    description: "December 1-15 payroll has been processed",
    time: "1 day ago",
    type: "payroll",
    read: true,
  },
  {
    id: 5,
    title: "Leave Approved",
    description: "Your leave request for Jan 2-3 has been approved",
    time: "2 days ago",
    type: "leave",
    read: true,
  },
  {
    id: 6,
    title: "Task Completed",
    description: "Q4 Tax Return Preparation marked as done",
    time: "3 days ago",
    type: "task",
    read: true,
  },
];

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "leave":
      return <Calendar className="h-5 w-5 text-info" />;
    case "task":
      return <FileText className="h-5 w-5 text-warning" />;
    case "onboarding":
      return <Users className="h-5 w-5 text-success" />;
    case "payroll":
      return <Clock className="h-5 w-5 text-primary" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState("all");

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return true;
  });

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-destructive">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with your team's activities
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={markAllAsRead}>
          <CheckCheck className="h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No notifications to show</p>
            </div>
          ) : (
            filteredNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border border-border transition-all cursor-pointer hover:bg-accent/50",
                  !notification.read && "bg-primary/5 border-primary/20",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn("font-medium", !notification.read && "text-primary")}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {notification.description}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                </div>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Notifications;
