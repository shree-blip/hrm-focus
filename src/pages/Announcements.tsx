import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Users,
  Loader2,
  Send
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  status: string;
  published_at: string | null;
  created_at: string;
  created_by: string;
}

const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    audience: "all",
  });

  // Mock announcements for demo since we don't have the table yet
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setAnnouncements([
        {
          id: "1",
          title: "Q4 Company All-Hands Meeting",
          content: "Join us for our quarterly all-hands meeting this Friday at 2 PM EST. We'll be discussing company performance, upcoming initiatives, and recognizing outstanding team members.",
          audience: "all",
          status: "published",
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          created_by: user?.id || "",
        },
        {
          id: "2",
          title: "New PTO Policy Update",
          content: "Effective January 1st, we're updating our PTO policy to provide more flexibility. Please review the updated policy document in the Documents section.",
          audience: "all",
          status: "published",
          published_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date(Date.now() - 86400000).toISOString(),
          created_by: user?.id || "",
        },
        {
          id: "3",
          title: "Holiday Office Hours",
          content: "The office will be closed from December 24th through January 1st. Emergency support will be available via the on-call schedule.",
          audience: "all",
          status: "draft",
          published_at: null,
          created_at: new Date(Date.now() - 172800000).toISOString(),
          created_by: user?.id || "",
        },
      ]);
      setLoading(false);
    }, 500);
  }, [user]);

  const handleSubmit = async (publish: boolean = false) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate creating announcement
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      title: formData.title,
      content: formData.content,
      audience: formData.audience,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      created_by: user?.id || "",
    };

    setAnnouncements(prev => [newAnnouncement, ...prev]);
    setFormData({ title: "", content: "", audience: "all" });
    setDialogOpen(false);
    setIsSubmitting(false);

    toast({
      title: publish ? "Announcement Published" : "Draft Saved",
      description: publish 
        ? "Your announcement is now visible to all employees."
        : "Your announcement has been saved as a draft.",
    });
  };

  const handleDelete = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    toast({
      title: "Announcement Deleted",
      description: "The announcement has been removed.",
    });
  };

  const handlePublish = (id: string) => {
    setAnnouncements(prev => prev.map(a => 
      a.id === id 
        ? { ...a, status: "published", published_at: new Date().toISOString() }
        : a
    ));
    toast({
      title: "Announcement Published",
      description: "Your announcement is now visible to employees.",
    });
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

  const publishedAnnouncements = announcements.filter(a => a.status === "published");
  const draftAnnouncements = announcements.filter(a => a.status === "draft");

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground mt-1">Create and manage company-wide announcements</p>
        </div>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Write your announcement..."
                  rows={5}
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Audience</Label>
                <Select 
                  value={formData.audience} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, audience: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    <SelectItem value="managers">Managers Only</SelectItem>
                    <SelectItem value="us">US Office</SelectItem>
                    <SelectItem value="remote">Remote Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button 
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publish Now
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="animate-slide-up">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Published</p>
                <p className="text-3xl font-display font-bold">{publishedAnnouncements.length}</p>
              </div>
              <div className="p-3 rounded-full bg-success/10">
                <Megaphone className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                <p className="text-3xl font-display font-bold text-warning">{draftAnnouncements.length}</p>
              </div>
              <div className="p-3 rounded-full bg-warning/10">
                <Edit className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-display font-bold">{announcements.length}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {draftAnnouncements.length > 0 && (
          <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Edit className="h-5 w-5 text-warning" />
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draftAnnouncements.map(announcement => (
                <div 
                  key={announcement.id}
                  className="p-4 rounded-xl bg-warning/5 border border-warning/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{announcement.title}</h3>
                        <Badge variant="outline" className="border-warning text-warning">Draft</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {format(new Date(announcement.created_at), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {announcement.audience === "all" ? "All Employees" : announcement.audience}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handlePublish(announcement.id)}
                        className="gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Publish
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Published Announcements
            </CardTitle>
            <CardDescription>Visible to all employees on their dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {publishedAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No published announcements yet</p>
              </div>
            ) : (
              publishedAnnouncements.map(announcement => (
                <div 
                  key={announcement.id}
                  className="p-4 rounded-xl bg-accent/30 border border-border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{announcement.title}</h3>
                        <Badge variant="outline" className="border-success text-success bg-success/10">Published</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Published {format(new Date(announcement.published_at!), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {announcement.audience === "all" ? "All Employees" : announcement.audience}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Announcements;
