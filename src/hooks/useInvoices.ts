import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Invoice {
  id: string;
  user_id: string;
  employee_id: string | null;
  org_id: string | null;
  sender_name: string;
  sender_address: string | null;
  sender_email: string | null;
  bill_to_client_id: string | null;
  bill_to_name: string;
  bill_to_address: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  month_of_service: string | null;
  service_description: string | null;
  amount: number;
  currency: string;
  payment_account_name: string | null;
  payment_bank_name: string | null;
  payment_account_number: string | null;
  payment_swift_code: string | null;
  pdf_file_path: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  employees?: {
    first_name: string;
    last_name: string;
    email: string;
    department: string | null;
    job_title: string | null;
  } | null;
}

export interface InvoiceComment {
  id: string;
  invoice_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

export interface InvoiceFormData {
  sender_name: string;
  sender_address: string;
  sender_email: string;
  bill_to_client_id: string;
  bill_to_name: string;
  bill_to_address: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  month_of_service: string;
  service_description: string;
  amount: number;
  currency: string;
  payment_account_name: string;
  payment_bank_name: string;
  payment_account_number: string;
  payment_swift_code: string;
}

export function useMyInvoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["invoices", "mine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });
}

export function useAllInvoices() {
  return useQuery({
    queryKey: ["invoices", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, employees(first_name, last_name, email, department, job_title)")
        .in("status", ["submitted", "approved", "rejected"])
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoiceComments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_comments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_comments")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profile info for commenters
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return (data || []).map(c => ({
        ...c,
        profiles: profileMap.get(c.user_id) ? {
          first_name: profileMap.get(c.user_id)!.first_name,
          last_name: profileMap.get(c.user_id)!.last_name,
          avatar_url: profileMap.get(c.user_id)!.avatar_url,
        } : null,
      })) as InvoiceComment[];
    },
    enabled: !!invoiceId,
  });
}

export function useCreateInvoice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: InvoiceFormData) => {
      // Get employee_id and org_id
      const { data: emp } = await supabase
        .from("employees")
        .select("id, org_id")
        .eq("email", user!.email!)
        .maybeSingle();

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user!.id,
          employee_id: emp?.id || null,
          org_id: emp?.org_id || null,
          sender_name: formData.sender_name,
          sender_address: formData.sender_address || null,
          sender_email: formData.sender_email || null,
          bill_to_client_id: formData.bill_to_client_id || null,
          bill_to_name: formData.bill_to_name,
          bill_to_address: formData.bill_to_address || null,
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          month_of_service: formData.month_of_service || null,
          service_description: formData.service_description || null,
          amount: formData.amount,
          currency: formData.currency,
          payment_account_name: formData.payment_account_name || null,
          payment_bank_name: formData.payment_bank_name || null,
          payment_account_number: formData.payment_account_number || null,
          payment_swift_code: formData.payment_swift_code || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice saved as draft");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSubmitInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, pdfPath }: { invoiceId: string; pdfPath?: string }) => {
      const updates: any = {
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (pdfPath) updates.pdf_file_path = pdfPath;
      const { error } = await supabase.from("invoices").update(updates).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice submitted to CEO for review");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useReviewInvoice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, decision }: { invoiceId: string; decision: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: decision,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Invoice ${vars.decision}`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useAddInvoiceComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, content }: { invoiceId: string; content: string }) => {
      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice_comments", vars.invoiceId] });
      toast.success("Comment added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export async function uploadInvoicePDF(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("invoices").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getInvoicePDFUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
