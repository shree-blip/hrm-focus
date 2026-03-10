import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
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
  const { hasPermission } = usePermissions();
  const canManageDocs = isAdmin || isVP || isManager || hasPermission("manage_documents");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploaderNames, setUploaderNames] = useState<UploaderInfo>({});
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Step 1: Fetch managed employee record IDs (if user is manager/line manager)
      let managedEmployeeRecordIds: string[] = [];

      if (canManageDocs || isLineManager) {
        const userEmpId = await supabase.rpc('get_employee_id_for_user', { _user_id: user.id });
        if (userEmpId.data) {
          const { data: directReports } = await supabase
            .from("employees")
            .select("id")
            .or(`manager_id.eq.${userEmpId.data},line_manager_id.eq.${userEmpId.data}`);
          if (directReports) {
            managedEmployeeRecordIds = directReports.map((e) => e.id);
          }
        }
      }

      // Step 2: Fetch all documents
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
        setLoading(false);
        return;
      }

      const allDocs = data || [];

      // Step 3: Get current user's employee record to check employee_id match
      const { data: userProfile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      let userEmployeeId: string | null = null;
      if (userProfile) {
        const { data: empRecord } = await supabase
          .from("employees")
          .select("id")
          .eq("profile_id", userProfile.id)
          .maybeSingle();
        userEmployeeId = empRecord?.id || null;
      }

      // Step 4: Filter documents based on category and role
      const filteredDocs = allDocs.filter((doc) => {
        // Leave Evidence - visible to uploader, admin, VP, manager, or line manager
        if (doc.category === LEAVE_EVIDENCE_CATEGORY) {
          if (doc.uploaded_by === user.id) return true;
          if (canManageDocs || isLineManager) return true;
          return false;
        }

        // Contracts - visible to uploader (VP), admin, VP, and the assigned employee
        if (doc.category === "Contracts") {
          if (doc.uploaded_by === user.id) return true;
          if (isVP) return true;
          if (doc.employee_id && userEmployeeId && doc.employee_id === userEmployeeId) return true;
          return false;
        }

        // Compliance - visible to uploader, admin, VP, assigned employee, and their line manager
        if (doc.category === "Compliance") {
          if (doc.uploaded_by === user.id) return true;
          if (canManageDocs) return true;
          if (doc.employee_id && userEmployeeId && doc.employee_id === userEmployeeId) return true;
          if (isLineManager && doc.employee_id && managedEmployeeRecordIds.includes(doc.employee_id)) return true;
          return false;
        }

        // All other documents are visible to everyone
        return true;
      });

      // Step 5: Fetch uploader names for display
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
      toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, canManageDocs, isLineManager]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (file: File, category: string, employeeId?: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const fileExt = file.name.split(".").pop();

    // Upload to storage
    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, file);

    if (uploadError) {
      toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
      return { error: uploadError };
    }

    // Create document record
    const insertData: any = {
      name: file.name,
      file_path: fileName,
      file_type: fileExt || null,
      file_size: file.size,
      category,
      status: "active",
      uploaded_by: user.id,
    };

    if (employeeId) {
      insertData.employee_id = employeeId;
    }

    const { error: insertError } = await supabase.from("documents").insert(insertData);

    if (insertError) {
      toast({ title: "Error", description: "Failed to save document record", variant: "destructive" });
      return { error: insertError };
    }

    toast({ title: "Document Uploaded", description: `${file.name} uploaded successfully` });

    // Get uploader info for email notifications
    const { data: uploaderProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", user.id)
      .single();

    const uploaderName = uploaderProfile ? `${uploaderProfile.first_name} ${uploaderProfile.last_name}` : "User";
    const uploaderEmail = uploaderProfile?.email || "";

    // Determine if this is a manager uploading for an employee or an employee uploading
    const isManagerUploadingForEmployee = employeeId && (isAdmin || isVP || isManager || isLineManager);

    if (isManagerUploadingForEmployee && employeeId) {
      // Manager/VP uploaded for employee → notify the employee
      try {
        // Get employee name
        const { data: empData } = await supabase
          .from("employees")
          .select("first_name, last_name, profile_id")
          .eq("id", employeeId)
          .single();

        const employeeName = empData ? `${empData.first_name} ${empData.last_name}` : "Employee";

        // Send email notification
        await supabase.functions.invoke("send-document-upload-notification", {
          body: {
            uploader_name: uploaderName,
            uploader_email: uploaderEmail,
            document_name: file.name,
            document_category: category,
            employee_id: employeeId,
            employee_name: employeeName,
            notify_type: "manager_upload",
          },
        });

        // Also send in-app notification to employee
        if (empData?.profile_id) {
          const { data: empProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("id", empData.profile_id)
            .single();

          if (empProfile && empProfile.user_id !== user.id) {
            await supabase.rpc("create_notification", {
              p_user_id: empProfile.user_id,
              p_title: "📄 New Document",
              p_message: `A new ${category} document "${file.name}" has been uploaded for you by ${uploaderName}.`,
              p_type: "document",
              p_link: "/documents",
            });
          }
        }
      } catch (emailErr) {
        console.error("Error sending document email notification:", emailErr);
      }
    } else {
      // Employee uploaded → notify VP and line manager
      try {
        // Get the user's employee record to find their line manager
        const { data: userProfile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

        let userEmployeeId: string | undefined;
        if (userProfile) {
          const { data: empRecord } = await supabase
            .from("employees")
            .select("id")
            .eq("profile_id", userProfile.id)
            .maybeSingle();
          userEmployeeId = empRecord?.id;
        }

        await supabase.functions.invoke("send-document-upload-notification", {
          body: {
            uploader_name: uploaderName,
            uploader_email: uploaderEmail,
            document_name: file.name,
            document_category: category,
            employee_id: userEmployeeId,
            notify_type: "employee_upload",
          },
        });

        // Send in-app notifications to VP/Admin
        const { data: vpUsers } = await supabase.from("user_roles").select("user_id").in("role", ["vp", "admin"]);

        if (vpUsers) {
          for (const vp of vpUsers) {
            if (vp.user_id !== user.id) {
              await supabase.rpc("create_notification", {
                p_user_id: vp.user_id,
                p_title: "📄 Document Uploaded",
                p_message: `${uploaderName} uploaded a ${category} document: "${file.name}"`,
                p_type: "document",
                p_link: "/documents",
              });
            }
          }
        }
      } catch (emailErr) {
        console.error("Error sending document email notification:", emailErr);
      }
    }

    fetchDocuments();
    return { error: null };
  };

  const uploadComplianceDocuments = async (
    employeeId: string,
    data: {
      bankAccountNumber?: string;
      citizenshipPhoto?: File;
      panCardPhoto?: File;
      otherDocument?: File;
    },
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

    const uploads: Promise<any>[] = [];

    // Upload each compliance file
    if (data.citizenshipPhoto) {
      uploads.push(
        uploadDocument(data.citizenshipPhoto, "Compliance", employeeId).then((res) => {
          if (!res.error) {
            // Rename to indicate it's a citizenship photo
            return null;
          }
          return res;
        }),
      );
    }

    if (data.panCardPhoto) {
      uploads.push(uploadDocument(data.panCardPhoto, "Compliance", employeeId));
    }

    if (data.otherDocument) {
      uploads.push(uploadDocument(data.otherDocument, "Compliance", employeeId));
    }

    // If bank account number is provided, store it as a text-based note document
    if (data.bankAccountNumber) {
      const blob = new Blob([`Bank Account Number: ${data.bankAccountNumber}`], { type: "text/plain" });
      const bankFile = new File([blob], `bank-account-${employeeId}.txt`, { type: "text/plain" });
      uploads.push(uploadDocument(bankFile, "Compliance", employeeId));
    }

    await Promise.all(uploads);
    fetchDocuments();
    return { error: null };
  };

  const deleteDocument = async (doc: Document) => {
    const previousDocuments = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

    const { error: storageError } = await supabase.storage.from("documents").remove([doc.file_path]);
    if (storageError) console.error("Storage delete error:", storageError);

    const { error } = await supabase.from("documents").delete().eq("id", doc.id);

    if (error) {
      setDocuments(previousDocuments);
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
      return { error };
    }

    toast({ title: "Document Deleted", description: `${doc.name} has been deleted` });
    return { error: null };
  };

  const renameDocument = async (doc: Document, newName: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      toast({ title: "Error", description: "Failed to rename document", variant: "destructive" });
      return { error };
    }

    toast({ title: "Document Renamed", description: `Document renamed to ${newName}` });
    fetchDocuments();
    return { error: null };
  };

  const getDownloadUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const url = await getDownloadUrl(doc.file_path);
      // Open document in a new tab
      window.open(url, "_blank", "noopener,noreferrer");
      toast({ title: "Document Opened", description: `${doc.name} opened in a new tab` });
    } catch (err) {
      console.error("Download error:", err);
      toast({ title: "Error", description: "Failed to open document", variant: "destructive" });
    }
  };

  const getUploaderName = (uploaderId: string) => uploaderNames[uploaderId] || "Unknown";

  const isPrivateCategory = (category: string | null) => PRIVATE_CATEGORIES.includes(category || "");
  const isLeaveEvidenceCategory = (category: string | null) => category === LEAVE_EVIDENCE_CATEGORY;
  const isRestrictedCategory = (category: string | null) =>
    isPrivateCategory(category) || isLeaveEvidenceCategory(category);
  const canAccessDocument = (_doc: Document) => true;

  return {
    documents,
    loading,
    uploadDocument,
    uploadComplianceDocuments,
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
