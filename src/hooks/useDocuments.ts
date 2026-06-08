import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import {
  notifyUser,
  notifyUsers,
  getAllActiveUserIds,
  getAdminAndVpUserIds,
  getDirectManagerUserIds,
  getUserIdForEmployee,
  getEmployeeDisplayName,
} from "@/lib/notify";

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
  drive_link?: string | null;
  leave_request_id?: string | null;
  uploader_name?: string;
}

export interface UploaderInfo {
  [key: string]: string;
}

export function useDocuments() {
  const { user, isAdmin, isVP, isManager, isLineManager } = useAuth();
  const { hasPermission, hasExplicitOverride } = usePermissions();
  const canManageDocs = isAdmin || isVP || isManager || hasPermission("manage_documents");
  // When a Custom Override exists for "manage_documents", it STRICTLY controls
  // view/manage access to Compliance, Policies, and Leave Evidence — even for
  // Admins/VP/Managers. Contracts behavior is intentionally untouched.
  const manageDocsOverridden = hasExplicitOverride("manage_documents");
  const canManageRestrictedDocs = manageDocsOverridden
    ? hasPermission("manage_documents")
    : canManageDocs;
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
          // Custom Override strictly decides access for this section
          if (manageDocsOverridden) return canManageRestrictedDocs;
          if (canManageDocs || isLineManager) return true;
          return false;
        }

        // Contracts - visible ONLY to uploader and the assigned employee (strict privacy)
        if (doc.category === "Contracts") {
          if (doc.uploaded_by === user.id) return true;
          if (doc.employee_id && userEmployeeId && doc.employee_id === userEmployeeId) return true;
          return false;
        }

        // Compliance - visible to uploader, admin, VP, assigned employee, and their line manager
        if (doc.category === "Compliance") {
          if (doc.uploaded_by === user.id) return true;
          if (doc.employee_id && userEmployeeId && doc.employee_id === userEmployeeId) return true;
          // Custom Override strictly decides management access for this section
          if (manageDocsOverridden) return canManageRestrictedDocs;
          if (canManageDocs) return true;
          if (isLineManager && doc.employee_id && managedEmployeeRecordIds.includes(doc.employee_id)) return true;
          return false;
        }

        // Policies - company-wide and always viewable. Even when a Custom
        // Override blocks the restricted sections (Compliance / Leave Evidence),
        // the user can still view Policies and their own uploaded documents.
        if (doc.category === "Policies") {
          return true;
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
  }, [user, canManageDocs, canManageRestrictedDocs, manageDocsOverridden, isLineManager]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ============================================================
  // Notification side-effects (email + in-app). Extracted so it can be
  // fired once per logical action (e.g. once for a bulk policy upload).
  // ============================================================
  const sendDocumentNotifications = async (name: string, category: string, employeeId?: string) => {
    if (!user) return;

    // Get uploader info for email notifications
    const { data: uploaderProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", user.id)
      .single();

    const uploaderName = uploaderProfile ? `${uploaderProfile.first_name} ${uploaderProfile.last_name}` : "User";
    const uploaderEmail = uploaderProfile?.email || "";

    // ============================================================
    // Email side-effect (unchanged): keep existing edge invocation
    // ============================================================
    const isManagerUploadingForEmployee = !!(employeeId && (isAdmin || isVP || isManager || isLineManager));
    try {
      // Resolve user's own employee id (used for employee_upload path)
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

      if (isManagerUploadingForEmployee && employeeId) {
        const { data: empData } = await supabase
          .from("employees")
          .select("first_name, last_name")
          .eq("id", employeeId)
          .maybeSingle();
        const employeeName = empData ? `${empData.first_name} ${empData.last_name}` : "Employee";
        await supabase.functions.invoke("send-document-upload-notification", {
          body: {
            uploader_name: uploaderName,
            uploader_email: uploaderEmail,
            document_name: name,
            document_category: category,
            employee_id: employeeId,
            employee_name: employeeName,
            notify_type: "manager_upload",
          },
        });
      } else {
        await supabase.functions.invoke("send-document-upload-notification", {
          body: {
            uploader_name: uploaderName,
            uploader_email: uploaderEmail,
            document_name: name,
            document_category: category,
            employee_id: userEmployeeId,
            notify_type: "employee_upload",
          },
        });
      }
    } catch (emailErr) {
      console.error("Error sending document email notification:", emailErr);
    }

    // ============================================================
    // In-app bell notifications — category-aware receiver routing
    // ============================================================
    try {
      const normalized = (category || "").toLowerCase();
      const link = "/documents";

      if (normalized === "policies" || normalized === "policy") {
        // #2 Policy upload → broadcast to all active users
        const allUserIds = await getAllActiveUserIds();
        await notifyUsers(
          allUserIds,
          {
            title: "📘 New Policy Uploaded",
            message: "A new company policy has been uploaded. Please review it in Documents > Policies.",
            link,
            type: "info",
          },
          { excludeUserId: user.id },
        );
      } else if (normalized === "contracts" || normalized === "contract") {
        // #1 Contract → ONLY the selected employee
        if (employeeId) {
          const targetUserId = await getUserIdForEmployee(employeeId);
          if (targetUserId && targetUserId !== user.id) {
            await notifyUser(targetUserId, {
              title: "📄 New Contract Uploaded",
              message: "Your contract has been uploaded. Please check it in Documents > Contracts.",
              link,
              type: "info",
            });
          }
        }
      } else if (normalized === "compliance") {
        // #3 Compliance → uploader's LM + supervisor + admin + vp
        // If a manager uploaded for an employee, target THAT employee's chain.
        const subjectUserId =
          isManagerUploadingForEmployee && employeeId
            ? (await getUserIdForEmployee(employeeId)) || user.id
            : user.id;
        const subjectName =
          subjectUserId === user.id ? uploaderName : await getEmployeeDisplayName(subjectUserId);

        const [managers, adminsVps] = await Promise.all([
          getDirectManagerUserIds(subjectUserId),
          getAdminAndVpUserIds(),
        ]);
        await notifyUsers(
          [...managers, ...adminsVps],
          {
            title: "📁 Compliance Document Uploaded",
            message: `${subjectName} has uploaded a compliance document. Please review it.`,
            link,
            type: "info",
          },
          { excludeUserId: user.id },
        );

        // Confirmation to the subject (employee)
        if (subjectUserId && subjectUserId !== user.id) {
          await notifyUser(subjectUserId, {
            title: "📁 Compliance Document Uploaded",
            message: "A new compliance document has been uploaded for you. Please review it in Documents > Compliance.",
            link,
            type: "info",
          });
        } else {
          await notifyUser(user.id, {
            title: "✅ Compliance Document Uploaded",
            message: "Your compliance document has been uploaded successfully.",
            link,
            type: "success",
          });
        }
      } else if (normalized === "leave evidence") {
        // #4 Leave evidence → uploader's LM + supervisor (admin/vp only if they manage docs)
        const managers = await getDirectManagerUserIds(user.id);
        await notifyUsers(
          managers,
          {
            title: "📎 Leave Evidence Uploaded",
            message: `${uploaderName} has uploaded leave evidence. Please review it.`,
            link: "/approvals",
            type: "info",
          },
          { excludeUserId: user.id },
        );
        // Confirmation to employee
        await notifyUser(user.id, {
          title: "✅ Leave Evidence Uploaded",
          message: "Your leave evidence has been uploaded successfully.",
          link,
          type: "success",
        });
      } else {
        // #10 Generic document → only the selected employee (no broadcast)
        if (employeeId) {
          const targetUserId = await getUserIdForEmployee(employeeId);
          if (targetUserId && targetUserId !== user.id) {
            await notifyUser(targetUserId, {
              title: "📄 New Document Uploaded",
              message: `A new document has been uploaded for you by ${uploaderName}. Please review it.`,
              link,
              type: "info",
            });
          }
        }
        // If employee uploaded a personal doc with no recipient, no fanout.
      }
    } catch (notifyErr) {
      console.error("Error sending document in-app notifications:", notifyErr);
    }
  };

  // ============================================================
  // Create a document that references a Google Drive link (no file storage).
  // ============================================================
  const createDriveDocument = async (
    params: { name: string; category: string; driveLink: string; employeeId?: string; leaveRequestId?: string },
    opts: { silent?: boolean } = {},
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

    const insertData: any = {
      name: params.name,
      file_path: null,
      file_type: "drive",
      file_size: null,
      category: params.category,
      status: "active",
      uploaded_by: user.id,
      drive_link: params.driveLink.trim(),
    };

    if (params.employeeId) insertData.employee_id = params.employeeId;
    if (params.leaveRequestId) insertData.leave_request_id = params.leaveRequestId;

    const { error: insertError } = await supabase.from("documents").insert(insertData);

    if (insertError) {
      toast({ title: "Error", description: "Failed to save document link", variant: "destructive" });
      return { error: insertError };
    }

    if (!opts.silent) {
      toast({ title: "Document Saved", description: `${params.name} link saved successfully` });
      await sendDocumentNotifications(params.name, params.category, params.employeeId);
      fetchDocuments();
    }

    return { error: null };
  };

  // Bulk create multiple Drive-link documents, then notify once per category/employee.
  const createDriveDocumentsBulk = async (
    items: { name: string; category: string; driveLink: string; employeeId?: string; leaveRequestId?: string }[],
  ) => {
    if (!user) return { error: new Error("Not authenticated") };
    if (items.length === 0) return { error: new Error("No documents to save") };

    let firstError: any = null;
    for (const item of items) {
      const { error } = await createDriveDocument(item, { silent: true });
      if (error && !firstError) firstError = error;
    }

    if (firstError) {
      toast({ title: "Error", description: "Some document links failed to save", variant: "destructive" });
      fetchDocuments();
      return { error: firstError };
    }

    toast({ title: "Documents Saved", description: `${items.length} document link(s) saved successfully` });

    // Notify once per unique (category + employee) combination
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.category}::${item.employeeId || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await sendDocumentNotifications(item.name, item.category, item.employeeId);
    }

    fetchDocuments();
    return { error: null };
  };

  // Update the Drive link (Edit Link / Replace Link) for an existing document.
  const updateDocumentLink = async (doc: Document, newLink: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ drive_link: newLink.trim(), updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update document link", variant: "destructive" });
      return { error };
    }

    toast({ title: "Link Updated", description: `${doc.name} link has been updated` });
    fetchDocuments();
    return { error: null };
  };

  // Archive a document (keeps the record but marks it archived).
  const archiveDocument = async (doc: Document) => {
    const { error } = await supabase
      .from("documents")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      toast({ title: "Error", description: "Failed to archive document", variant: "destructive" });
      return { error };
    }

    toast({ title: "Document Archived", description: `${doc.name} has been archived` });
    fetchDocuments();
    return { error: null };
  };

  const deleteDocument = async (doc: Document) => {
    const previousDocuments = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

    // Legacy documents may still have a stored file; clean it up if present.
    if (doc.file_path) {
      const { error: storageError } = await supabase.storage.from("documents").remove([doc.file_path]);
      if (storageError) console.error("Storage delete error:", storageError);
    }

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
      // Drive-linked documents open the share link directly.
      if (doc.drive_link) {
        window.open(doc.drive_link, "_blank", "noopener,noreferrer");
        toast({ title: "Opening in Drive", description: `${doc.name} opened in a new tab` });
        return;
      }
      // Legacy stored documents fall back to a signed storage URL.
      if (doc.file_path) {
        const url = await getDownloadUrl(doc.file_path);
        window.open(url, "_blank", "noopener,noreferrer");
        toast({ title: "Document Opened", description: `${doc.name} opened in a new tab` });
        return;
      }
      toast({ title: "No Link", description: "This document has no link to open", variant: "destructive" });
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
    createDriveDocument,
    createDriveDocumentsBulk,
    updateDocumentLink,
    archiveDocument,
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
