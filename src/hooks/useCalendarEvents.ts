import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  created_by: string;
  org_id: string | null;
  is_active: boolean;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  event_date: string;
  event_type: string;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("is_active", true)
        .order("event_date", { ascending: true });

      if (error) {
        console.error("Error fetching calendar events:", error);
        return;
      }
      setEvents(data || []);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = useCallback(
    async (input: CreateCalendarEventInput) => {
      if (!user) return null;
      try {
        // Get org_id from profiles table
        const { data: profileData } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", user.id)
          .single();

        const { data, error } = await supabase
          .from("calendar_events")
          .insert({
            title: input.title,
            description: input.description || null,
            event_date: input.event_date,
            event_type: input.event_type,
            created_by: user.id,
            org_id: profileData?.org_id || null,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating calendar event:", error);
          toast.error("Failed to create event");
          return null;
        }
        toast.success("Event added to calendar");
        await fetchEvents();
        return data;
      } catch (err) {
        console.error("Error creating calendar event:", err);
        toast.error("Failed to create event");
        return null;
      }
    },
    [user, fetchEvents]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      try {
        const { error } = await supabase
          .from("calendar_events")
          .delete()
          .eq("id", eventId);

        if (error) {
          console.error("Error deleting calendar event:", error);
          toast.error("Failed to delete event");
          return false;
        }
        toast.success("Event removed from calendar");
        await fetchEvents();
        return true;
      } catch (err) {
        console.error("Error deleting calendar event:", err);
        toast.error("Failed to delete event");
        return false;
      }
    },
    [fetchEvents]
  );

  const getEventsForDate = useCallback(
    (date: Date) =>
      events.filter((e) => {
        const eventDate = new Date(e.event_date + "T00:00:00");
        return eventDate.toDateString() === date.toDateString();
      }),
    [events]
  );

  const getEventsForMonth = useCallback(
    (date: Date) =>
      events.filter((e) => {
        const eventDate = new Date(e.event_date + "T00:00:00");
        return (
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      }),
    [events]
  );

  const isCustomEventDate = useCallback(
    (date: Date) =>
      events.some((e) => {
        const eventDate = new Date(e.event_date + "T00:00:00");
        return eventDate.toDateString() === date.toDateString();
      }),
    [events]
  );

  return {
    events,
    loading,
    createEvent,
    deleteEvent,
    getEventsForDate,
    getEventsForMonth,
    isCustomEventDate,
    refetch: fetchEvents,
  };
}
