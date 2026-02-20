import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: string;
  displayValue?: string;
  onSave: (value: string) => Promise<{ error: any }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

export function InlineEditField({
  value,
  displayValue,
  onSave,
  placeholder = "Not set",
  disabled = false,
  className,
  inputClassName,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const result = await onSave(editValue.trim());
    setIsSaving(false);
    if (!result.error) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (disabled) {
    return (
      <Input value={displayValue || value || placeholder} disabled className="bg-muted" />
    );
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("flex-1", inputClassName)}
          disabled={isSaving}
        />
        <Button size="icon" variant="ghost" onClick={handleSave} disabled={isSaving} className="h-8 w-8 shrink-0">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-primary" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel} disabled={isSaving} className="h-8 w-8 shrink-0">
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2 cursor-pointer rounded-md border border-transparent px-3 py-2 text-sm hover:border-input hover:bg-accent/50 transition-colors min-h-[40px]",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      <span className={cn("flex-1", !value && "text-muted-foreground")}>
        {displayValue || value || placeholder}
      </span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}
