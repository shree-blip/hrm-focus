import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Briefcase, Plus, Paperclip, Trash2, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { notifyUsers, getAllActiveUserIds } from "@/lib/notify";

interface HiringPost {
  id: string;
  title: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export default function Hiring() {
  const { user, isAdmin, isVP } = useAuth();
  const canManage = isAdmin || isVP;

  const [posts, setPosts] = useState<HiringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hiring_posts" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load hiring posts", description: error.message, variant: "destructive" });
    } else {
      setPosts((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setFile(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    let attachment_url: string | null = null;
    let attachment_name: string | null = null;

    try {
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("hiring-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("hiring-attachments").getPublicUrl(path);
        attachment_url = pub.publicUrl;
        attachment_name = file.name;
      }

      const { error } = await supabase.from("hiring_posts" as any).insert({
        title: title.trim(),
        content: content.trim(),
        attachment_url,
        attachment_name,
        created_by: user?.id,
      });
      if (error) throw error;

      toast({ title: "Hiring post created" });
      // Broadcast to all active users (in-app only)
      try {
        const all = await getAllActiveUserIds();
        await notifyUsers(
          all,
          {
            title: "💼 New Hiring Update",
            message: "New hiring update from Focus Your Finance. Please check the Hiring section.",
            link: "/hiring",
            type: "info",
          },
          { excludeUserId: user?.id },
        );
      } catch (e) {
        console.error("Failed to broadcast hiring notification:", e);
      }
      setOpen(false);
      resetForm();
      fetchPosts();
    } catch (e: any) {
      toast({ title: "Failed to create post", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("hiring_posts" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hiring post deleted" });
      fetchPosts();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Hiring
            </h1>
            <p className="text-sm text-muted-foreground">
              Open roles and referral opportunities. Refer great people and earn bonuses.
            </p>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Hiring Post
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Hiring Post</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. We're hiring an Operations Associate" />
                  </div>
                  <div>
                    <Label htmlFor="content">Description</Label>
                    <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Role details, referral bonus, etc." />
                  </div>
                  <div>
                    <Label htmlFor="file">Attachment (optional, e.g. JD PDF)</Label>
                    <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Publish
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No open roles right now.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Posted {format(new Date(post.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete hiring post?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(post.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
                  {post.attachment_url && (
                    <a
                      href={post.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      {post.attachment_name || "Attachment"}
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}