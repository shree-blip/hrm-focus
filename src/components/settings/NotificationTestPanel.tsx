import { useNotificationDiagnostics } from "@/hooks/useNotificationDiagnostics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellRing,
  Send,
  Trash2,
  Eye,
  EyeOff,
  Crown,
  Radio,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationTestPanel() {
  const {
    log,
    isLeader,
    tabId,
    permissionStatus,
    visibility,
    requestPermission,
    sendTestNotification,
    clearLog,
  } = useNotificationDiagnostics();

  const permColor: Record<string, string> = {
    granted: "bg-success/15 text-success border-success/30",
    denied: "bg-destructive/15 text-destructive border-destructive/30",
    default: "bg-warning/15 text-warning border-warning/30",
  };

  return (
    <div className="space-y-6">
      {/* Status indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Cross-Tab Notification Diagnostics
          </CardTitle>
          <CardDescription>
            Test and monitor the dual-layer notification system across browser tabs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Permission */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Permission</p>
                <Badge
                  variant="outline"
                  className={cn("mt-0.5 text-xs capitalize", permColor[permissionStatus])}
                >
                  {permissionStatus}
                </Badge>
              </div>
              {permissionStatus === "default" && (
                <Button size="sm" variant="outline" onClick={requestPermission} className="shrink-0">
                  Enable
                </Button>
              )}
            </div>

            {/* Visibility */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                {visibility === "visible" ? (
                  <Eye className="h-4 w-4 text-success" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Tab Visibility</p>
                <p className="text-sm font-medium capitalize">{visibility}</p>
              </div>
            </div>

            {/* Leader */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                isLeader ? "bg-warning/15" : "bg-muted"
              )}>
                <Crown className={cn("h-4 w-4", isLeader ? "text-warning" : "text-muted-foreground")} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Leader Tab</p>
                <p className="text-sm font-medium">{isLeader ? "This tab" : "Other tab"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground font-mono">
              Tab ID: {tabId.slice(-10)} &middot; Only the leader fires OS notifications &middot;
              Broadcast syncs toasts to all tabs
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendTestNotification} className="gap-2">
              <Send className="h-4 w-4" />
              Fire Test Event
            </Button>
            <Button variant="outline" onClick={clearLog} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Log
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Wifi className="h-4 w-4 text-primary" />
            Notification Log
            {log.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {log.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BellRing className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Fire a test event or trigger an action in another tab
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-1">
                {log.map((entry, i) => (
                  <div key={entry.id + i}>
                    <div className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                        entry.source === "local"
                          ? "bg-primary/15 text-primary"
                          : "bg-accent text-accent-foreground"
                      )}>
                        {entry.source === "local" ? "L" : "B"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{entry.title}</p>
                        {entry.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.body}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            entry.source === "local"
                              ? "border-primary/30 text-primary"
                              : "border-accent-foreground/30 text-accent-foreground"
                          )}
                        >
                          {entry.source === "local" ? "Local" : "Broadcast"}
                        </Badge>
                      </div>
                    </div>
                    {i < log.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
