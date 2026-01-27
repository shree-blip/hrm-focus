import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface SharedDocument {
  id: string; // document_shares.id
  document_id: string;
  sender_id: string;
  sender_name: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  // Document details
  document_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
}

export function useSharedDocuments() {
  const { user } = useAuth();
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSharedDocuments = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch document shares where user is recipient
    const { data: shares, error: sharesError } = await supabase
      .from("document_shares")
      .select(`
        id,
        document_id,
        sender_id,
        message,
        is_read,
        created_at
      `)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (sharesError) {
      console.error("Error fetching shared documents:", sharesError);
      setLoading(false);
      return;
    }

    if (!shares || shares.length === 0) {
      setSharedDocuments([]);
      setLoading(false);
      return;
    }

    // Get document IDs to fetch document details
    const documentIds = shares.map((s) => s.document_id);
    const senderIds = [...new Set(shares.map((s) => s.sender_id))];

    // Fetch documents and sender profiles in parallel
    const [documentsResult, profilesResult] = await Promise.all([
      supabase
        .from("documents")
        .select("id, name, file_path, file_type, file_size, category")
        .in("id", documentIds),
      supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", senderIds),
    ]);

    const documents = documentsResult.data || [];
    const profiles = profilesResult.data || [];

    // Create lookup maps
    const docMap = new Map(documents.map((d) => [d.id, d]));
    const profileMap = new Map(
      profiles.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`])
    );

    // Combine data
    const combined: SharedDocument[] = shares
      .map((share) => {
        const doc = docMap.get(share.document_id);
        if (!doc) return null;

        return {
          id: share.id,
          document_id: share.document_id,
          sender_id: share.sender_id,
          sender_name: profileMap.get(share.sender_id) || "Unknown",
          message: share.message,
          is_read: share.is_read || false,
          created_at: share.created_at,
          document_name: doc.name,
          file_path: doc.file_path,
          file_type: doc.file_type,
          file_size: doc.file_size,
          category: doc.category,
        };
      })
      .filter((item): item is SharedDocument => item !== null);

    setSharedDocuments(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchSharedDocuments();
  }, [user]);

  const markAsRead = async (shareId: string) => {
    const { error } = await supabase
      .from("document_shares")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", shareId);

    if (error) {
      console.error("Error marking as read:", error);
      return;
    }

    setSharedDocuments((prev) =>
      prev.map((doc) => (doc.id === shareId ? { ...doc, is_read: true } : doc))
    );
  };

  const downloadSharedDocument = async (doc: SharedDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download Started",
        description: `Downloading ${doc.document_name}`,
      });

      // Mark as read when downloaded
      if (!doc.is_read) {
        await markAsRead(doc.id);
      }
    } catch (error) {
      console.error("Error downloading:", error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  return {
    sharedDocuments,
    loading,
    markAsRead,
    downloadSharedDocument,
    refetch: fetchSharedDocuments,
    unreadCount: sharedDocuments.filter((d) => !d.is_read).length,
  };
}
