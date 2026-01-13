import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Megaphone, Plus, Trash2, Calendar, Loader2, Send, Pin } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";

type DurationOption = "none" | "1h" | "4h" | "1d" | "3d" | "1w" | "custom";

const durationToMs: Record<Exclude<DurationOption, "none" | "custom">, number> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

const Announcements = () => {
  const { user, role } = useAuth();
  const { announcements, loading } = useAnnouncements();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info",
    isPinned: false,
    duration: "none" as DurationOption,
    // datetime-local value: "YYYY-MM-DDTHH:mm"
    expiresAtLocal: "",
  });

  const canManage = role === "admin" || role === "vp" || role === "manager";

  const stats = useMemo(() => {
    const pinned = announcements.filter((a) => a.is_pinned).length;
    return { total: announcements.length, pinned };
  }, [announcements]);

  const computeExpiresAtISO = (): string | null => {
    if (formData.duration === "none") return null;

    if (formData.duration === "custom") {
      if (!formData.expiresAtLocal) return null;
      const dt = new Date(formData.expiresAtLocal);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString();
    }

    const ms = durationToMs[formData.duration];
    return new Date(Date.now() + ms).toISOString();
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and content",
        variant: "destructive",
      });
      return;
    }

    const expiresAt = computeExpiresAtISO();

    // If custom duration selected, ensure valid + future date
    if (formData.duration === "custom") {
      if (!expiresAt) {
        toast({
          title: "Validation Error",
          description: "Please choose an expiry date/time.",
          variant: "destructive",
        });
        return;
      }
      if (new Date(expiresAt).getTime() <= Date.now()) {
        toast({
          title: "Validation Error",
          description: "Expiry time must be in the future.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("announcements").insert({
      title: formData.title.trim(),
      content: formData.content.trim(),
      type: formData.type,
      is_pinned: formData.isPinned,
      is_active: true,
      created_by: user.id,
      org_id: null,
      expires_at: expiresAt, // ✅ key change
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create announcement",
        variant: "destructive",
      });
      return;
    }

    setFormData({
      title: "",
      content: "",
      type: "info",
      isPinned: false,
      duration: "none",
      expiresAtLocal: "",
    });
    setDialogOpen(false);

    toast({
      title: "Announcement Published",
      description: expiresAt
        ? "It will appear instantly and auto-expire on schedule."
        : "It will appear instantly on everyone’s dashboard.",
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete announcement",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Deleted", description: "Announcement removed for everyone." });
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
          <h1 className="text-3xl font-display font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground mt-1">Publish company updates that appear on everyone’s dashboard</p>
        </div>

        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Create Announcement</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Announcement title"
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your announcement..."
                    rows={5}
                    value={formData.content}
                    onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="block">Pinned</Label>
                    <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                      <Checkbox
                        checked={formData.isPinned}
                        onCheckedChange={(v) =>
                          setFormData((p) => ({
                            ...p,
                            isPinned: Boolean(v),
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">Pin to top</span>
                    </div>
                  </div>
                </div>

                {/* ✅ Duration / Expiry */}
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      value={formData.duration}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          duration: v as DurationOption,
                          expiresAtLocal: v === "custom" ? p.expiresAtLocal : "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No expiry</SelectItem>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="4h">4 hours</SelectItem>
                        <SelectItem value="1d">1 day</SelectItem>
                        <SelectItem value="3d">3 days</SelectItem>
                        <SelectItem value="1w">1 week</SelectItem>
                        <SelectItem value="custom">Custom date/time</SelectItem>
                      </SelectContent>
                    </Select>

                    {formData.duration === "custom" ? (
                      <Input
                        type="datetime-local"
                        value={formData.expiresAtLocal}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            expiresAtLocal: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <div className="h-10 px-3 border rounded-md flex items-center text-sm text-muted-foreground">
                        {formData.duration === "none" ? "Stays live until deleted" : "Auto-expires"}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expired announcements will automatically disappear for all users.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="animate-slide-up">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Live</p>
                <p className="text-3xl font-display font-bold">{stats.total}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pinned</p>
                <p className="text-3xl font-display font-bold">{stats.pinned}</p>
              </div>
              <div className="p-3 rounded-full bg-warning/10">
                <Pin className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-3xl font-display font-bold">
                  {
                    announcements.filter((a) => new Date(a.created_at).toDateString() === new Date().toDateString())
                      .length
                  }
                </p>
              </div>
              <div className="p-3 rounded-full bg-success/10">
                <Calendar className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Live Announcements
          </CardTitle>
          <CardDescription>These appear for all users immediately (banner + dashboard widget)</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No announcements yet</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-accent/30 border border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                      <h3 className="font-medium">{a.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {a.type}
                      </Badge>
                      {a.expires_at && (
                        <Badge variant="secondary" className="text-xs">
                          Ends {format(new Date(a.expires_at), "MMM d, h:mm a")}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">{a.content}</p>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(a.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span>By {a.publisher_name || "System"}</span>
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Announcements;
