import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrievances, GRIEVANCE_CATEGORIES, GRIEVANCE_PRIORITIES } from "@/hooks/useGrievances";
import { ImagePlus, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubmitGrievanceDialog({ open, onOpenChange, onSuccess }: Props) {
  const { createGrievance, uploadAttachment } = useGrievances();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [details, setDetails] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonVisibility, setAnonVisibility] = useState("nobody");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // <-- NEW
  const fileInputRef = useRef<HTMLInputElement>(null); // <-- NEW

  const handleSubmit = async () => {
    if (!title || !category || !details) return;
    setSubmitting(true);

    const result = await createGrievance({
      title,
      category,
      priority,
      details,
      is_anonymous: isAnonymous,
      anonymous_visibility: isAnonymous ? anonVisibility : "nobody",
    });

    if (result && files.length > 0) {
      for (const file of files) {
        await uploadAttachment((result as any).id, file);
      }
    }

    setSubmitting(false);
    if (result) {
      resetForm();
      if (onSuccess) {
        onSuccess();
      } else {
        onOpenChange(false);
      }
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setPriority("Medium");
    setDetails("");
    setIsAnonymous(false);
    setAnonVisibility("nobody");
    setFiles([]);
  };

  // -- NEW: Drag, drop, paste, and remove handlers --
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedFiles = Array.from(e.clipboardData.files);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...pastedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };
  // -- END NEW --

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Grievance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="grievance-title">Title</Label>
            <Input
              id="grievance-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your grievance"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="grievance-details">Details</Label>
            <Textarea
              id="grievance-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe your grievance in detail..."
              rows={5}
            />
          </div>

          {/* -- UPDATED: Attachments section with drag & drop + paste -- */}
          <div onPaste={handlePaste}>
            <Label>Attachments (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                setFiles((prev) => [...prev, ...selected]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-1 w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              <ImagePlus className={`h-8 w-8 mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm text-muted-foreground">
                {isDragging ? "Drop files here" : "Drag & drop, click to upload, or paste (Ctrl+V)"}
              </span>
            </div>

            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-1.5"
                  >
                    <span className="truncate mr-2">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* -- END UPDATED -- */}

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous-toggle">Submit Anonymously</Label>
              <Switch id="anonymous-toggle" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>

            {isAnonymous && (
              <div>
                <Label>Reveal identity to</Label>
                <Select value={anonVisibility} onValueChange={setAnonVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nobody">Nobody</SelectItem>
                    <SelectItem value="hr_admin">HR / Admin only</SelectItem>
                    <SelectItem value="vp_hr">VP + HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title || !category || !details || submitting}>
              {submitting ? "Submitting..." : "Submit Grievance"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
