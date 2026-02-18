import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useClients";

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded?: (clientId: string) => void;
}

export function AddClientDialog({ open, onOpenChange, onClientAdded }: AddClientDialogProps) {
  const { addClient } = useClients();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to capitalize the first letter of each word
  const capitalizeWords = (str: string) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const capitalizedName = capitalizeWords(name.trim()); // Capitalize the name

    setIsSubmitting(true);
    const client = await addClient({ name: capitalizedName, client_id: clientId.trim() || undefined });
    setIsSubmitting(false);

    if (client) {
      setName("");
      setClientId("");
      onOpenChange(false);
      onClientAdded?.(client.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Client Name *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter client name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID (Optional)</Label>
            <Input
              id="client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g., CLT001"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
