/**
 * MyPayslipsTab — Allows employees to view and download their own payslip PDFs.
 *
 * VP/Admin users also see this tab but with their own payslips (if any).
 * Access is controlled by RLS — employees can only see their own records.
 */
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PayslipFileRecord {
  id: string;
  payroll_run_id: string | null;
  file_path: string;
  file_name: string;
  period_start: string;
  period_end: string;
  year: number;
  month: number;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payslipFilesTable = () => (supabase as unknown as any).from("payslip_files");

interface MyPayslipsTabProps {
  downloadPayslip: (filePath: string, fileName: string) => Promise<void>;
}

export function MyPayslipsTab({ downloadPayslip }: MyPayslipsTabProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<PayslipFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchMyPayslips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await payslipFilesTable()
      .select("id, payroll_run_id, file_path, file_name, period_start, period_end, year, month, created_at")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false });

    setLoading(false);
    if (error) {
      console.error("Error fetching payslips:", error.message);
      return;
    }
    setRecords((data || []) as PayslipFileRecord[]);
  }, [user]);

  useEffect(() => {
    fetchMyPayslips();
  }, [fetchMyPayslips]);

  const handleDownload = async (rec: PayslipFileRecord) => {
    setDownloading(rec.id);
    await downloadPayslip(rec.file_path, rec.file_name);
    setDownloading(null);
  };

  if (loading) {
    return (
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payslips…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            My Payslips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Payslips Yet</p>
            <p className="text-sm">Your payslip PDFs will appear here after payroll is processed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by year for display
  const byYear = records.reduce<Record<number, PayslipFileRecord[]>>((acc, rec) => {
    const yr = rec.year ?? new Date(rec.period_start + "T00:00:00").getFullYear();
    (acc[yr] = acc[yr] || []).push(rec);
    return acc;
  }, {});

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          My Payslips
          <Badge variant="secondary" className="ml-2">{records.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {years.map((year) => (
          <div key={year}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{year}</h3>
            <div className="grid gap-2">
              {byYear[year].map((rec) => {
                const periodLabel = format(
                  new Date(rec.period_start + "T00:00:00"),
                  "MMMM yyyy",
                );
                const generatedLabel = format(
                  new Date(rec.created_at),
                  "MMM d, yyyy 'at' h:mm a",
                );
                const isDownloading = downloading === rec.id;

                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{periodLabel}</p>
                        <p className="text-xs text-muted-foreground">Generated {generatedLabel}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 flex-shrink-0"
                      disabled={isDownloading}
                      onClick={() => handleDownload(rec)}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      Download
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
