import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// Private categories that only uploader and admin can see
export const PRIVATE_CATEGORIES = ["Compliance", "Contracts"];

// Leave evidence - visible to uploader, admin, VP, manager, line manager
export const LEAVE_EVIDENCE_CATEGORY = "Leave Evidence";

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
  uploader_name?: string;
}

export interface UploaderInfo {
  [key: string]: string;
}

export function useDocuments() {
  const { user, isAdmin, isVP, isManager, isLineManager } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploaderNames, setUploaderNames] = useState<UploaderInfo>({});
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Step 1: Fetch managed employees first (if user is manager/line manager)
      let managedEmployeeIds: string[] = [];

      if (isManager || isLineManager) {
        const { data: managedProfiles, error: managedError } = await supabase
          .from("profiles")
          .select("user_id")
          .or(`manager_id.eq.${user.id},line_manager_id.eq.${user.id}`);

        if (!managedError && managedProfiles) {
          managedEmployeeIds = managedProfiles.map((p) => p.user_id);
        }
      }

      // Step 2: Fetch all documents
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        toast({
          title: "Error",
          description: "Failed to load documents",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const allDocs = data || [];

      // Step 3: Filter documents based on category and role
      const filteredDocs = allDocs.filter((doc) => {
        // Leave Evidence - visible to uploader, admin, VP, or their manager/line manager
        if (doc.category === LEAVE_EVIDENCE_CATEGORY) {
          // User is the uploader
          if (doc.uploaded_by === user.id) return true;
          // User is admin or VP
          if (isAdmin || isVP) return true;
          // User is a manager/line manager of the uploader
          if ((isManager || isLineManager) && managedEmployeeIds.includes(doc.uploaded_by)) {
            return true;
          }
          return false;
        }

        // Private categories (Contracts, Compliance) - only uploader, admin, VP
        if (PRIVATE_CATEGORIES.includes(doc.category || "")) {
          return doc.uploaded_by === user.id || isAdmin || isVP;
        }

        // All other documents are visible to everyone
        return true;
      });

      // Step 4: Fetch uploader names for display
      const uploaderIds = [...new Set(filteredDocs.map((d) => d.uploaded_by).filter(Boolean))];
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", uploaderIds);

        if (profiles) {
          const names: UploaderInfo = {};
          profiles.forEach((p) => {
            names[p.user_id] = `${p.first_name} ${p.last_name}`;
          });
          setUploaderNames(names);
        }
      }

      setDocuments(filteredDocs);
    } catch (err) {
      console.error("Error in fetchDocuments:", err);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isVP, isManager, isLineManager]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (file: File, category: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, file);

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
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

    // Delete from storage
    const { error: storageError } = await supabase.storage.from("documents").remove([doc.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete record
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);

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
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      throw error;
    }

    return data.signedUrl;
  };

  const downloadDocument = async (doc: Document) => {
    const url = await getDownloadUrl(doc.file_path);

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

  const getUploaderName = (uploaderId: string) => {
    return uploaderNames[uploaderId] || "Unknown";
  };

  const isPrivateCategory = (category: string | null) => {
    return PRIVATE_CATEGORIES.includes(category || "");
  };

  const isLeaveEvidenceCategory = (category: string | null) => {
    return category === LEAVE_EVIDENCE_CATEGORY;
  };

  const isRestrictedCategory = (category: string | null) => {
    return isPrivateCategory(category) || isLeaveEvidenceCategory(category);
  };

  const canAccessDocument = (doc: Document) => {
    // This is now handled in fetchDocuments, but keeping for external use
    return true;
  };

  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    renameDocument,
    downloadDocument,
    getDownloadUrl,
    getUploaderName,
    isPrivateCategory,
    isLeaveEvidenceCategory,
    isRestrictedCategory,
    canAccessDocument,
    refetch: fetchDocuments,
  };
}
