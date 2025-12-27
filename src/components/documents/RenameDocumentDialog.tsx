import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

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

interface RenameDocumentDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (document: Document, newName: string) => void;
}

export function RenameDocumentDialog({
  document,
  open,
  onOpenChange,
  onRename,
}: RenameDocumentDialogProps) {
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (document) {
      setNewName(document.name);
    }
  }, [document]);

  if (!document) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter a valid file name.",
        variant: "destructive",
      });
      return;
    }

    onRename(document, newName);
    onOpenChange(false);

    toast({
      title: "Document Renamed",
      description: "The document has been renamed successfully.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Rename Document</DialogTitle>
          <DialogDescription>
            Enter a new name for this document.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="newName">File Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new file name"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
