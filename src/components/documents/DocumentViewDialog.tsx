import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, File, Download, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface DocumentViewDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (document: Document) => void;
}

const getFileIcon = (type: string | null) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-16 w-16 text-destructive" />;
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className="h-16 w-16 text-success" />;
    case "doc":
    case "docx":
      return <File className="h-16 w-16 text-info" />;
    default:
      return <File className="h-16 w-16 text-muted-foreground" />;
  }
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function DocumentViewDialog({
  document,
  open,
  onOpenChange,
  onDownload,
}: DocumentViewDialogProps) {
  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Document Preview</DialogTitle>
          <DialogDescription>
            View document details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* File Preview */}
          <div className="flex flex-col items-center justify-center p-8 bg-secondary/50 rounded-lg">
            {getFileIcon(document.file_type)}
            <p className="font-medium mt-4 text-center">{document.name}</p>
            <Badge variant="secondary" className="mt-2">
              {(document.file_type || "FILE").toUpperCase()}
            </Badge>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <p className="text-sm font-medium">{document.category || "Uncategorized"}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Size</p>
              <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Modified</p>
              <div className="flex items-center gap-1 text-sm font-medium">
                <Clock className="h-3 w-3" />
                {new Date(document.updated_at || document.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge
                variant="outline"
                className={cn(
                  document.status === "signed" && "border-success text-success bg-success/10",
                  document.status === "active" && "border-primary text-primary bg-primary/10",
                  document.status === "draft" && "border-warning text-warning bg-warning/10",
                  document.status === "completed" && "border-info text-info bg-info/10",
                  document.status === "approved" && "border-success text-success bg-success/10"
                )}
              >
                {document.status || "active"}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button className="gap-2" onClick={() => onDownload(document)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
