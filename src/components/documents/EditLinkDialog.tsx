import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { DRIVE_LINK_HELPER_TEXT, isValidDriveLink } from "@/lib/driveLinks";

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  currentLink: string;
  mode: "edit" | "replace";
  onSave: (newLink: string) => Promise<void> | void;
}

export function EditLinkDialog({ open, onOpenChange, documentName, currentLink, mode, onSave }: EditLinkDialogProps) {
  const [link, setLink] = useState("");

  useEffect(() => {
    if (open) setLink(mode === "edit" ? currentLink || "" : "");
  }, [open, mode, currentLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDriveLink(link)) {
      toast({ title: "Invalid Link", description: "Please paste a valid Google Drive link.", variant: "destructive" });
      return;
    }
    await onSave(link.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "edit" ? "Edit Link" : "Replace Link"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? `Update the Google Drive link for "${documentName}".`
              : `Paste a new Google Drive link for "${documentName}".`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Google Drive Link</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/..." />
            <p className="text-xs text-muted-foreground">{DRIVE_LINK_HELPER_TEXT}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{mode === "edit" ? "Update Link" : "Replace Link"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}