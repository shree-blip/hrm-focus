import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, File, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (document: {
    name: string;
    type: string;
    category: string;
    size: string;
    date: string;
    status: string;
    file?: File;
  }) => void;
}

const CATEGORY_INFO: Record<string, string> = {
  Contracts: "Private - Only you and admins can view",
  Policies: "Public - Visible to all employees",
  Compliance: "Private - Only you and admins can view",
  "Leave Evidence": "Restricted - Visible to you, your manager, line manager, VP, and admins",
};

export function UploadDocumentDialog({ open, onOpenChange, onUpload }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();

      if (!allowedTypes.includes(ext)) {
        toast({
          title: "Invalid File Type",
          description: "Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      setFile(selectedFile);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileType = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext || "file";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !category) {
      toast({
        title: "Missing Information",
        description: "Please select a file and category.",
        variant: "destructive",
      });
      return;
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    onUpload({
      name: file.name,
      type: getFileType(file.name),
      category,
      size: formatFileSize(file.size),
      date: dateStr,
      status: "active",
      file: file,
    });

    // Reset form
    setFile(null);
    setCategory("");
    onOpenChange(false);

    toast({
      title: "Document Uploaded",
      description: `${file.name} has been uploaded successfully.`,
    });
  };

  const handleClose = () => {
    setFile(null);
    setCategory("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Upload Document</DialogTitle>
          <DialogDescription>Upload a new document to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* File Upload Zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <File className="h-10 w-10 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">Click to upload a file</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 10MB</p>
              </>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Document Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contracts">Contracts</SelectItem>
                <SelectItem value="Policies">Policies</SelectItem>
                <SelectItem value="Compliance">Compliance</SelectItem>
                <SelectItem value="Leave Evidence">Leave Evidence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Info Alert */}
          {category && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{CATEGORY_INFO[category]}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Upload Document</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
