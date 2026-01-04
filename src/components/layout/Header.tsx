import { Bell, Search, User, Clock, Settings, LogOut, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import focusLogo from "@/assets/focus-logo.png";
interface HeaderProps {
  isMobile?: boolean;
}

export function Header({ isMobile }: HeaderProps = {}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { signOut, profile, role } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { announcements } = useAnnouncements();
  const { signedUrl: avatarUrl } = useAvatarUrl(profile?.avatar_url);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDate = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const formatNotificationTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const handleProfileClick = () => navigate("/profile");
  const handleTimesheetClick = () => navigate("/attendance");
  
  const getRoleLabel = () => {
    switch (role) {
      case "admin": return "Admin";
      case "vp": return "VP";
      case "manager": return "Manager";
      default: return "Employee";
    }
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case "admin": return "bg-destructive text-destructive-foreground";
      case "vp": return "bg-primary text-primary-foreground";
      case "manager": return "bg-info text-info-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    localStorage.clear();
    toast({ title: "Signed Out", description: "You have been signed out successfully." });
    navigate("/auth");
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (query.includes("employee")) navigate("/employees");
      else if (query.includes("task")) navigate("/tasks");
      else if (query.includes("document")) navigate("/documents");
      else if (query.includes("leave")) navigate("/leave");
      else if (query.includes("payroll")) navigate("/payroll");
      else if (query.includes("attendance") || query.includes("time")) navigate("/attendance");
      else {
        toast({ title: "Search", description: `Searching for "${searchQuery}"...` });
      }
    }
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getInitials = () => {
    if (profile) {
      return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
    }
    return "GD";
  };

  const getDisplayName = () => {
    if (profile) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return "Ganesh Dahal";
  };

  // Combine notifications with pinned announcements for the dropdown
  const recentNotifications = notifications.slice(0, 3);
  const pinnedAnnouncements = announcements.filter(a => a.is_pinned).slice(0, 2);
  const totalUnread = unreadCount + pinnedAnnouncements.length;

  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6",
      isMobile ? "h-14" : "h-16"
    )}>
      <div className={cn(
        "flex items-center gap-4 flex-1",
        isMobile ? "max-w-xs" : "max-w-xl"
      )}>
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <img src={focusLogo} alt="Focus" className="h-8 w-8 object-contain" />
        </div>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder={isMobile ? "Search..." : "Search employees, tasks, documents..."} 
            className="pl-10 bg-secondary/50 border-transparent focus:border-primary focus:bg-card transition-all" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground/60">•</span>
          <span>{formatDate(currentTime)}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {totalUnread > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-destructive">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <DropdownMenuLabel className="font-display flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">{unreadCount} unread</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Pinned Announcements */}
            {pinnedAnnouncements.length > 0 && (
              <>
                {pinnedAnnouncements.map((announcement) => (
                  <DropdownMenuItem 
                    key={`announcement-${announcement.id}`}
                    className="flex flex-col items-start gap-1 py-3 cursor-pointer bg-warning/5"
                    onClick={() => navigate("/notifications")}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Megaphone className="h-4 w-4 text-warning shrink-0" />
                      <span className="font-medium text-sm truncate">{announcement.title}</span>
                      <Badge variant="outline" className="text-xs border-warning text-warning ml-auto shrink-0">
                        Pinned
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2 pl-6">
                      {announcement.content}
                    </span>
                    <div className="flex items-center justify-between pl-6 w-full">
                      <span className="text-xs text-muted-foreground">
                        By {announcement.publisher_name || 'System'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatNotificationTime(announcement.created_at)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Recent Notifications */}
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notification) => (
                <DropdownMenuItem 
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-1 py-3 cursor-pointer",
                    !notification.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium text-sm">{notification.title}</span>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary ml-auto" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatNotificationTime(notification.created_at)}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No new notifications
              </div>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-center text-primary cursor-pointer justify-center" 
              onClick={() => navigate("/notifications")}
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 pl-2 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground font-medium">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getDisplayName()}</span>
                  <Badge className={cn("text-xs", getRoleBadgeColor())}>{getRoleLabel()}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{profile?.job_title || "Employee"}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-display">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={handleProfileClick}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleTimesheetClick}>
              <FileText className="mr-2 h-4 w-4" />
              My Timesheet
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
