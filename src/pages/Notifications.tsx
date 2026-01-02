import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, CheckCheck, Calendar, FileText, Clock, Users, Loader2, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { formatDistanceToNow } from "date-fns";

const getNotificationIcon = (type: string | null) => {
  switch (type) {
    case "leave":
      return <Calendar className="h-5 w-5 text-info" />;
    case "task":
      return <FileText className="h-5 w-5 text-warning" />;
    case "onboarding":
      return <Users className="h-5 w-5 text-success" />;
    case "payroll":
      return <Clock className="h-5 w-5 text-primary" />;
    case "announcement":
      return <Megaphone className="h-5 w-5 text-primary" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

const Notifications = () => {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { announcements, loading: announcementsLoading } = useAnnouncements();
  const [filter, setFilter] = useState("all");

  // Combine notifications and announcements (announcements as notification items)
  const announcementNotifications = announcements.map(a => ({
    id: `announcement-${a.id}`,
    title: a.title,
    message: a.content,
    type: "announcement",
    is_read: false, // Announcements are always shown as unread
    created_at: a.created_at,
    isAnnouncement: true,
    isPinned: a.is_pinned,
    publisher_name: a.publisher_name,
  }));

  const allItems = [
    ...announcementNotifications.filter(a => a.isPinned),
    ...notifications.map(n => ({ ...n, isAnnouncement: false, isPinned: false })),
    ...announcementNotifications.filter(a => !a.isPinned),
  ];

  const filteredNotifications = allItems.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    if (filter === "announcements") return n.isAnnouncement;
    return true;
  });

  const handleMarkAsRead = async (id: string, isAnnouncement: boolean) => {
    if (!isAnnouncement) {
      await markAsRead(id);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
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
        {unreadCount > 0 && (
          <Button variant="outline" className="gap-2" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
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
          <TabsTrigger value="announcements">
            Announcements
            {announcements.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {announcements.length}
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
            Recent Notifications & Announcements
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
                  !notification.is_read && "bg-primary/5 border-primary/20",
                  notification.isAnnouncement && notification.isPinned && "bg-warning/5 border-warning/20",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => handleMarkAsRead(notification.id, notification.isAnnouncement)}
              >
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={cn("font-medium", !notification.is_read && "text-primary")}>
                          {notification.title}
                        </p>
                        {notification.isAnnouncement && (
                          <Badge variant="outline" className="text-xs border-warning text-warning">
                            Announcement
                          </Badge>
                        )}
                        {notification.isPinned && (
                          <Badge variant="outline" className="text-xs border-destructive text-destructive">
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {'publisher_name' in notification && notification.publisher_name && (
                          <span className="font-medium text-foreground/80">By {notification.publisher_name}: </span>
                        )}
                        {notification.message}
                      </p>
                    </div>
                    {!notification.is_read && !notification.isAnnouncement && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{formatTime(notification.created_at)}</p>
                </div>
                {!notification.is_read && !notification.isAnnouncement && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notification.id, notification.isAnnouncement);
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
