import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Send, Users, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  uploaded_by: string;
  employee_id: string | null;
}

interface Recipient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
}

interface SendDocumentDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecipientAvatar({ avatarUrl, firstName, lastName }: { avatarUrl: string | null; firstName: string; lastName: string }) {
  const { signedUrl } = useAvatarUrl(avatarUrl);
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={signedUrl || undefined} alt={`${firstName} ${lastName}`} />
      <AvatarFallback className="text-xs">
        {firstName[0]}{lastName[0]}
      </AvatarFallback>
    </Avatar>
  );
}

export function SendDocumentDialog({
  document,
  open,
  onOpenChange,
}: SendDocumentDialogProps) {
  const { user, isAdmin, isVP, isManager } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const canSelectMultiple = isAdmin || isVP || isManager;

  useEffect(() => {
    if (open) {
      fetchRecipients();
      setSelectedRecipients([]);
      setMessage("");
      setSearchQuery("");
    }
  }, [open]);

  const fetchRecipients = async () => {
    setLoading(true);
    
    try {
      // For employees (not manager/admin/vp), use the security definer function to get management user_ids
      if (!canSelectMultiple) {
        // Use RPC to get management user_ids (bypasses RLS on user_roles)
        const { data: managementUserIds, error: rpcError } = await supabase
          .rpc("get_management_user_ids");

        if (rpcError) {
          console.error("Error fetching management user ids:", rpcError);
          setLoading(false);
          return;
        }

        // Fetch profiles for these management users
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, user_id, first_name, last_name, email, job_title, department, avatar_url")
          .in("user_id", managementUserIds || [])
          .neq("user_id", user?.id || "")
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Error fetching recipients:", error);
          setLoading(false);
          return;
        }

        setRecipients((profiles || []).map(p => ({
          id: p.id,
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          job_title: p.job_title,
          department: p.department,
          avatar_url: p.avatar_url,
        })));
      } else {
        // For managers/admins/VPs - fetch all profiles except self
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, user_id, first_name, last_name, email, job_title, department, avatar_url")
          .neq("user_id", user?.id || "")
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Error fetching recipients:", error);
          setLoading(false);
          return;
        }

        setRecipients((profiles || []).map(p => ({
          id: p.id,
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          job_title: p.job_title,
          department: p.department,
          avatar_url: p.avatar_url,
        })));
      }
    } catch (err) {
      console.error("Error in fetchRecipients:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipients = recipients.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    return (
      r.first_name.toLowerCase().includes(searchLower) ||
      r.last_name.toLowerCase().includes(searchLower) ||
      r.email.toLowerCase().includes(searchLower) ||
      (r.department?.toLowerCase().includes(searchLower) || false)
    );
  });

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSend = async () => {
    if (!document || selectedRecipients.length === 0) {
      toast({
        title: "Select Recipients",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      // Get user's org_id
      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user?.id || "")
        .maybeSingle();

      // Create document shares for each recipient
      const shares = selectedRecipients.map(recipientId => ({
        document_id: document.id,
        sender_id: user?.id,
        recipient_id: recipientId,
        message: message || null,
        org_id: orgMember?.org_id || null,
      }));

      const { error: shareError } = await supabase
        .from("document_shares")
        .insert(shares);

      if (shareError) throw shareError;

      // Create notifications for each recipient
      const notifications = selectedRecipients.map(recipientId => ({
        user_id: recipientId,
        title: "Document Shared",
        message: `You have received a document: "${document.name}"`,
        type: "info",
        link: "/documents",
        org_id: orgMember?.org_id || null,
      }));

      await supabase.from("notifications").insert(notifications);

      toast({
        title: "Document Sent",
        description: `Document sent to ${selectedRecipients.length} recipient(s)`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error sending document:", error);
      toast({
        title: "Error",
        description: "Failed to send document",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Document
          </DialogTitle>
          <DialogDescription>
            Send "{document.name}" to {canSelectMultiple ? "selected employees" : "management"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search recipients..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Selected count */}
          {selectedRecipients.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {selectedRecipients.length} recipient(s) selected
              </span>
            </div>
          )}

          {/* Recipients list */}
          <ScrollArea className="flex-1 border rounded-lg max-h-[250px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredRecipients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recipients found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredRecipients.map((recipient) => (
                  <div
                    key={recipient.user_id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedRecipients.includes(recipient.user_id)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => toggleRecipient(recipient.user_id)}
                  >
                    <Checkbox
                      checked={selectedRecipients.includes(recipient.user_id)}
                      onCheckedChange={() => toggleRecipient(recipient.user_id)}
                    />
                    <RecipientAvatar 
                      avatarUrl={recipient.avatar_url} 
                      firstName={recipient.first_name} 
                      lastName={recipient.last_name} 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {recipient.first_name} {recipient.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {recipient.email}
                      </p>
                    </div>
                    {recipient.job_title && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {recipient.job_title}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a message for the recipients..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending || selectedRecipients.length === 0}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to {selectedRecipients.length || ""} Recipient{selectedRecipients.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
