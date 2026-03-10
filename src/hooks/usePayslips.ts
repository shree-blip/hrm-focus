/**
 * usePayslips — manages payslip PDF generation, storage, and downloads.
 *
 * Responsibilities:
 *  1. Upload generated PDF blobs to Supabase Storage (`payslips` bucket)
 *  2. Upsert metadata rows in `payslip_files` (linked to payroll_run_id)
 *  3. Clean up old payslips when a run is regenerated
 *  4. Download individual payslips
 *  5. Download all payslips for a run as a ZIP
 *  6. Fetch payslip records for display
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { format } from "date-fns";
import type {
  PayslipEmployeeData,
  PayslipRunContext,
  PayslipGenerationResult,
  BatchPayslipProgress,
} from "@/lib/payslipPdfGenerator";
import { generateAllPayslipPDFs } from "@/lib/payslipPdfGenerator";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PayslipRecord {
  id: string;
  payroll_run_id: string | null;
  employee_id: string | null;
  user_id: string;
  file_path: string;
  file_name: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payslipFilesTable = () => (supabase as unknown as any).from("payslip_files");

export function usePayslips() {
  const { user, isVP } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<BatchPayslipProgress | null>(null);
  const [payslipRecords, setPayslipRecords] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── Delete old payslips for a given payroll run ── */
  const deleteRunPayslips = useCallback(
    async (payrollRunId: string) => {
      // Fetch existing records to remove storage files first
      const { data: existing } = await payslipFilesTable()
        .select("id, file_path")
        .eq("payroll_run_id", payrollRunId);

      if (existing && existing.length > 0) {
        // Remove files from storage
        const paths = (existing as Array<{ id: string; file_path: string }>).map(
          (r) => r.file_path,
        );
        await supabase.storage.from("payslips").remove(paths);

        // Delete metadata rows
        await payslipFilesTable()
          .delete()
          .eq("payroll_run_id", payrollRunId);
      }
    },
    [],
  );

  /* ── Generate + upload all payslips for a payroll run ── */
  const generateAndUploadPayslips = useCallback(
    async (
      employees: PayslipEmployeeData[],
      ctx: PayslipRunContext,
    ): Promise<boolean> => {
      if (!user || !isVP) {
        toast({ title: "Access Denied", description: "Only VP/Admin can generate payslips.", variant: "destructive" });
        return false;
      }

      // Filter out employees without a valid user_id (UUID-shaped)
      const validEmployees = employees.filter(
        (e) => e.user_id && e.user_id.trim() !== "" && e.user_id.length > 8,
      );
      const skippedCount = employees.length - validEmployees.length;
      if (skippedCount > 0) {
        console.warn(
          `Payslips: Skipping ${skippedCount} employees without a linked user account`,
        );
      }
      if (validEmployees.length === 0) {
        toast({
          title: "No Payslips",
          description:
            "No employees with linked user accounts found. Ensure employees have profile associations.",
          variant: "destructive",
        });
        return false;
      }

      setGenerating(true);
      setProgress({ total: validEmployees.length, completed: 0, current: "Starting…" });

      try {
        // 1. Delete old payslips for this run (in case of re-run)
        await deleteRunPayslips(ctx.payroll_run_id);

        // 2. Generate all PDFs
        const results = await generateAllPayslipPDFs(validEmployees, ctx, (p) =>
          setProgress(p),
        );

        // 3. Upload each PDF + save metadata
        setProgress({
          total: results.length,
          completed: 0,
          current: "Uploading payslips…",
        });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < results.length; i++) {
          const r = results[i];

          // Guard: skip if user_id somehow still empty
          if (!r.user_id || r.user_id.trim() === "") {
            console.warn(`Skipping payslip for ${r.employee_name}: no user_id`);
            failCount++;
            continue;
          }

          const storagePath = `${r.user_id}/${r.fileName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("payslips")
            .upload(storagePath, r.blob, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Upload failed for ${r.employee_name}:`, uploadError.message);
            failCount++;
            continue;
          }

          // Extract month/year from period
          const startDate = new Date(ctx.period_start + "T00:00:00");
          const month = startDate.getMonth() + 1;
          const year = startDate.getFullYear();

          const record = {
            user_id: r.user_id,
            employee_id: r.employee_id,
            payroll_run_id: ctx.payroll_run_id,
            period_type: "monthly",
            year,
            month,
            period_start: ctx.period_start,
            period_end: ctx.period_end,
            file_path: storagePath,
            file_name: r.fileName,
          };

          // Upsert metadata — with error checking + fallback
          const { error: upsertError } = await payslipFilesTable().upsert(
            record,
            { onConflict: "payroll_run_id,employee_id" },
          );

          if (upsertError) {
            console.warn(
              `Upsert failed for ${r.employee_name}:`,
              upsertError.message,
              "— trying fallback insert",
            );

            // Fallback: delete any existing record for same employee + period, then insert
            await payslipFilesTable()
              .delete()
              .eq("employee_id", r.employee_id)
              .eq("period_start", ctx.period_start)
              .eq("period_end", ctx.period_end);

            const { error: insertError } = await payslipFilesTable().insert(record);

            if (insertError) {
              console.error(
                `Fallback insert failed for ${r.employee_name}:`,
                insertError.message,
              );
              failCount++;
              continue;
            }
          }

          successCount++;
          setProgress({
            total: results.length,
            completed: i + 1,
            current: `Uploaded ${r.employee_name}`,
          });
        }

        if (failCount > 0 && successCount > 0) {
          toast({
            title: "Payslips Partially Generated",
            description: `${successCount} payslip PDFs saved. ${failCount} failed — check console for details.${skippedCount > 0 ? ` ${skippedCount} employees skipped (no linked user).` : ""}`,
            variant: "destructive",
          });
        } else if (failCount > 0 && successCount === 0) {
          toast({
            title: "Payslip Generation Failed",
            description: `All ${failCount} payslips failed to save. Check browser console for details.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Payslips Ready",
            description: `${successCount} payslip PDFs generated and stored successfully.${skippedCount > 0 ? ` (${skippedCount} employees skipped — no linked user account)` : ""}`,
          });
        }

        return successCount > 0;
      } catch (err) {
        console.error("Payslip generation error:", err);
        toast({
          title: "Error",
          description: "Failed to generate payslips. Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setGenerating(false);
        setProgress(null);
      }
    },
    [user, isVP, deleteRunPayslips],
  );

  /* ── Fetch payslip records for a payroll run ── */
  const fetchRunPayslips = useCallback(async (payrollRunId: string) => {
    setLoading(true);
    const { data, error } = await payslipFilesTable()
      .select("*")
      .eq("payroll_run_id", payrollRunId)
      .order("file_name");

    setLoading(false);
    if (error) {
      console.error("Error fetching payslips:", error.message);
      return;
    }
    setPayslipRecords((data || []) as PayslipRecord[]);
  }, []);

  /* ── Fetch own payslips (for employee view) ── */
  const fetchMyPayslips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await payslipFilesTable()
      .select("*")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false });

    setLoading(false);
    if (error) {
      console.error("Error fetching my payslips:", error.message);
      return;
    }
    setPayslipRecords((data || []) as PayslipRecord[]);
  }, [user]);

  /* ── Download a single payslip ── */
  const downloadPayslip = useCallback(async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("payslips")
      .download(filePath);

    if (error || !data) {
      toast({
        title: "Download Failed",
        description: error?.message || "Could not download payslip.",
        variant: "destructive",
      });
      return;
    }

    saveAs(data, fileName);
  }, []);

  /* ── Download all payslips for a run as ZIP ── */
  const downloadAllAsZip = useCallback(
    async (payrollRunId: string, periodStart: string) => {
      const { data: records, error } = await payslipFilesTable()
        .select("file_path, file_name")
        .eq("payroll_run_id", payrollRunId);

      if (error || !records || records.length === 0) {
        toast({
          title: "No Payslips",
          description: "No payslips found for this payroll run.",
          variant: "destructive",
        });
        return;
      }

      const typedRecords = records as Array<{ file_path: string; file_name: string }>;
      const zip = new JSZip();

      for (const rec of typedRecords) {
        const { data: blob } = await supabase.storage
          .from("payslips")
          .download(rec.file_path);

        if (blob) {
          zip.file(rec.file_name, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const monthStr = format(
        new Date(periodStart + "T00:00:00"),
        "yyyy-MM",
      );
      saveAs(zipBlob, `payslips_${monthStr}.zip`);
    },
    [],
  );

  /* ── Check if payslips exist for a run ── */
  const checkPayslipsExist = useCallback(async (payrollRunId: string): Promise<boolean> => {
    const { data, error } = await payslipFilesTable()
      .select("id")
      .eq("payroll_run_id", payrollRunId)
      .limit(1);

    if (error) return false;
    return (data as unknown[])?.length > 0;
  }, []);

  return {
    generating,
    progress,
    payslipRecords,
    loading,
    generateAndUploadPayslips,
    fetchRunPayslips,
    fetchMyPayslips,
    downloadPayslip,
    downloadAllAsZip,
    checkPayslipsExist,
    deleteRunPayslips,
  };
}
