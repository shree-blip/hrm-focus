import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrievances, GRIEVANCE_CATEGORIES, GRIEVANCE_PRIORITIES } from "@/hooks/useGrievances";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void; // Added callback for successful submission
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
      // Call onSuccess callback if provided, otherwise just close the dialog
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

          <div>
            <Label htmlFor="grievance-files">Attachments (optional)</Label>
            <Input
              id="grievance-files"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="mt-1"
            />
            {files.length > 0 && <p className="text-xs text-muted-foreground mt-1">{files.length} file(s) selected</p>}
          </div>

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
