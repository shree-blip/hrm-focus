import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  employee_id: string | null;
}

export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const uploadDocument = async (file: File, category: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: "Upload Failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return { error: uploadError };
    }

    // Create document record
    const { error: insertError } = await supabase.from("documents").insert({
      name: file.name,
      file_path: fileName,
      file_type: fileExt || null,
      file_size: file.size,
      category,
      status: "active",
      uploaded_by: user.id,
    });

    if (insertError) {
      toast({
        title: "Error",
        description: "Failed to save document record",
        variant: "destructive",
      });
      return { error: insertError };
    }

    toast({
      title: "Document Uploaded",
      description: `${file.name} uploaded successfully`,
    });

    fetchDocuments();
    return { error: null };
  };

  const deleteDocument = async (doc: Document) => {
    // Optimistically remove document from UI
    const previousDocuments = documents;
    setDocuments(prev => prev.filter(d => d.id !== doc.id));

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([doc.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete record
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (error) {
      // Revert on error
      setDocuments(previousDocuments);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Document Deleted",
      description: `${doc.name} has been deleted`,
    });

    return { error: null };
  };

  const renameDocument = async (doc: Document, newName: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to rename document",
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Document Renamed",
      description: `Document renamed to ${newName}`,
    });

    fetchDocuments();
    return { error: null };
  };

  const getDownloadUrl = async (filePath: string) => {
    // Use signed URLs for private bucket - 1 hour expiry
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      throw error;
    }

    return data.signedUrl;
  };

  const downloadDocument = async (doc: Document) => {
    const url = await getDownloadUrl(doc.file_path);
    
    // Create a link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: `Downloading ${doc.name}`,
    });
  };

  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    renameDocument,
    downloadDocument,
    getDownloadUrl,
    refetch: fetchDocuments,
  };
}
