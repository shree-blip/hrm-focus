import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarEvent, CreateCalendarEventInput } from "@/hooks/useCalendarEvents";
import { cn } from "@/lib/utils";

interface AddCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  existingEvents: CalendarEvent[];
  onAddEvent: (input: CreateCalendarEventInput) => Promise<any>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
}

const eventTypeConfig: Record<string, { label: string; color: string }> = {
  event: {
    label: "Event",
    color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  },
  holiday: {
    label: "Holiday",
    color:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  deadline: {
    label: "Deadline",
    color:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  },
};

export function AddCalendarEventDialog({
  open,
  onOpenChange,
  selectedDate,
  existingEvents,
  onAddEvent,
  onDeleteEvent,
}: AddCalendarEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("event");
  const [eventDate, setEventDate] = useState<Date>(selectedDate);
  const [submitting, setSubmitting] = useState(false);

  // Update event date when selectedDate prop changes
  useEffect(() => {
    setEventDate(selectedDate);
  }, [selectedDate]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setEventType("event");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const result = await onAddEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: format(eventDate, "yyyy-MM-dd"),
        event_type: eventType,
      });

      if (result) {
        // Reset form and close dialog
        setTitle("");
        setDescription("");
        setEventType("event");
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    await onDeleteEvent(eventId);
  };

  // Get events for the currently selected event date in the dialog
  const relevantEvents = existingEvents.filter((event) => {
    const evtDate = new Date(event.event_date + "T00:00:00");
    return evtDate.toDateString() === eventDate.toDateString();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {format(eventDate, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
          <DialogDescription>Add an event, reminder, or deadline for this date.</DialogDescription>
        </DialogHeader>

        {/* Existing custom events on this date */}
        {relevantEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Events</p>
            {relevantEvents.map((event) => {
              const cfg = eventTypeConfig[event.event_type] || eventTypeConfig.event;
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", cfg.color)}>
                        {cfg.label}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(event.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new event form */}
        <div className="space-y-3 pt-2">
          {/* Date Picker */}
          <div>
            <label className="text-sm font-medium mb-1 block">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={(date) => date && setEventDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="e.g., Team Meeting, Tax Filing Deadline..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">📅 Event</SelectItem>
                <SelectItem value="holiday">⭐ Holiday</SelectItem>
                <SelectItem value="deadline">⏰ Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="Add details about this event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
            <Plus className="h-4 w-4 mr-1" />
            {submitting ? "Adding..." : "Add Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
