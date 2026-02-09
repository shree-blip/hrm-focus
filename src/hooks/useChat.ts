import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  sender?: Profile;
  is_encrypted?: boolean;
  encrypted_content?: string | null;
  nonce?: string | null;
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  description: string | null;
  created_at: string;
  participants: {
    user_id: string;
    profile?: Profile;
  }[];
  last_message?: Message;
  unread_count?: number;
}

export function useChat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations]
  );

  // Fetch all profiles for chat
  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, avatar_url, job_title")
        .neq("user_id", user.id);
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, [user]);

  // Fetch conversations with unread counts
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: participantData } = await supabase
        .from("chat_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!participantData?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);
      const lastReadMap = new Map(participantData.map((p) => [p.conversation_id, p.last_read_at]));

      const { data: convData } = await supabase
        .from("chat_conversations")
        .select("*")
        .in("id", conversationIds);

      const { data: allParticipants } = await supabase
        .from("chat_participants")
        .select("*")
        .in("conversation_id", conversationIds);

      const participantUserIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, avatar_url, job_title")
        .in("user_id", participantUserIds);

      const conversationsWithData: Conversation[] = await Promise.all(
        (convData || []).map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Count unread messages
          const lastReadAt = lastReadMap.get(conv.id) || "1970-01-01T00:00:00Z";
          let unreadCount = 0;
          if (lastReadAt) {
            const { count } = await supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", conv.id)
              .neq("sender_id", user.id)
              .gt("created_at", lastReadAt);
            unreadCount = count || 0;
          }

          const participants =
            allParticipants
              ?.filter((p) => p.conversation_id === conv.id)
              .map((p) => ({
                user_id: p.user_id,
                profile: profilesData?.find((pr) => pr.user_id === p.user_id),
              })) || [];

          let displayLastMsg: Message | undefined;
          if (lastMsg) {
            const msgAny = lastMsg as any;
            // Show content directly - no encryption display
            displayLastMsg = {
              ...msgAny,
              content: msgAny.is_encrypted ? msgAny.content || "Message" : msgAny.content,
            };
          }

          return {
            ...conv,
            description: (conv as any).description || null,
            participants,
            last_message: displayLastMsg,
            unread_count: unreadCount,
          };
        })
      );

      conversationsWithData.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(conversationsWithData);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(
    async (conversationId: string) => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error fetching messages:", error);
          return;
        }

        const senderIds = [...new Set(data?.map((m) => m.sender_id) || [])];
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id, user_id, first_name, last_name, avatar_url, job_title")
          .in("user_id", senderIds);

        const messagesWithSenders: Message[] = (data || []).map((msg) => {
          const msgAny = msg as any;
          return {
            ...msg,
            content: msgAny.is_encrypted ? msgAny.content || "Message" : msg.content,
            is_encrypted: msgAny.is_encrypted,
            sender: senderProfiles?.find((p) => p.user_id === msg.sender_id),
          };
        });

        setMessages(messagesWithSenders);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    },
    []
  );

  // Mark conversation as read
  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      try {
        await supabase
          .from("chat_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id);

        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        );
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    },
    [user]
  );

  // Send message (always plaintext - no encryption)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !activeConversation || !content.trim()) return;

      try {
        const { error } = await supabase.from("chat_messages").insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: content.trim(),
          is_encrypted: false,
        } as any);

        if (error) throw error;
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Error",
          description: "Failed to send message.",
          variant: "destructive",
        });
      }
    },
    [user, activeConversation, toast]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from("chat_messages")
          .update({ content: newContent, updated_at: new Date().toISOString() } as any)
          .eq("id", messageId)
          .eq("sender_id", user.id);

        if (error) throw error;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: newContent, updated_at: new Date().toISOString() } : m
          )
        );
      } catch (error) {
        console.error("Error editing message:", error);
        toast({ title: "Error", description: "Failed to edit message.", variant: "destructive" });
      }
    },
    [user, toast]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from("chat_messages")
          .delete()
          .eq("id", messageId)
          .eq("sender_id", user.id);

        if (error) throw error;

        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch (error) {
        console.error("Error deleting message:", error);
        toast({ title: "Error", description: "Failed to delete message.", variant: "destructive" });
      }
    },
    [user, toast]
  );

  // Start DM conversation
  const startConversation = useCallback(
    async (otherUserId: string) => {
      if (!user) return null;

      const existingConv = conversations.find(
        (c) => !c.is_group && c.participants.some((p) => p.user_id === otherUserId)
      );

      if (existingConv) {
        setActiveConversation(existingConv);
        await fetchMessages(existingConv.id);
        return existingConv;
      }

      try {
        const { data: conversationId, error: rpcError } = await (supabase.rpc as any)(
          "create_dm_conversation",
          { _other_user_id: otherUserId }
        );

        if (rpcError) throw rpcError;
        if (!conversationId) throw new Error("No conversation ID returned");

        const { data: newConvData } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("id", conversationId as string)
          .single();

        const otherProfile = profiles.find((p) => p.user_id === otherUserId);
        const conversation: Conversation = {
          ...(newConvData as any),
          description: null,
          participants: [
            { user_id: user.id },
            { user_id: otherUserId, profile: otherProfile },
          ],
        };

        await fetchConversations();
        setActiveConversation(conversation);
        setMessages([]);
        return conversation;
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast({ title: "Error", description: "Failed to start conversation.", variant: "destructive" });
        return null;
      }
    },
    [user, conversations, profiles, fetchConversations, fetchMessages, toast]
  );

  // Create group chat
  const createGroupChat = useCallback(
    async (name: string, memberUserIds: string[]) => {
      if (!user) return null;

      try {
        const { data: conversationId, error: rpcError } = await (supabase.rpc as any)(
          "create_group_conversation",
          { _name: name, _member_ids: memberUserIds }
        );

        if (rpcError) throw rpcError;
        if (!conversationId) throw new Error("No conversation ID returned");

        await fetchConversations();
        toast({ title: "Group created", description: `"${name}" group chat created.` });
        return { id: conversationId };
      } catch (error) {
        console.error("Error creating group chat:", error);
        toast({ title: "Error", description: "Failed to create group.", variant: "destructive" });
        return null;
      }
    },
    [user, fetchConversations, toast]
  );

  // Add member to group
  const addGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      if (!user) return false;

      try {
        const { error: rpcError } = await (supabase.rpc as any)("add_group_member", {
          _conversation_id: conversationId,
          _new_member_id: userId,
        });

        if (rpcError) throw rpcError;
        await fetchConversations();
        toast({ title: "Member added", description: "New member added to group." });
        return true;
      } catch (error) {
        console.error("Error adding member:", error);
        toast({ title: "Error", description: "Failed to add member.", variant: "destructive" });
        return false;
      }
    },
    [user, fetchConversations, toast]
  );

  // Rename conversation
  const renameConversation = useCallback(
    async (conversationId: string, newName: string) => {
      try {
        const { error } = await supabase
          .from("chat_conversations")
          .update({ name: newName } as any)
          .eq("id", conversationId);

        if (error) throw error;

        if (activeConversation?.id === conversationId) {
          setActiveConversation((prev) => (prev ? { ...prev, name: newName } : null));
        }
        await fetchConversations();
        toast({ title: "Renamed", description: "Group name updated." });
      } catch (error) {
        console.error("Error renaming:", error);
        toast({ title: "Error", description: "Failed to rename group.", variant: "destructive" });
      }
    },
    [activeConversation, fetchConversations, toast]
  );

  // Get presence status
  const getPresenceStatus = useCallback(
    (userId: string): "online" | "offline" => {
      return onlineUsers.has(userId) ? "online" : "offline";
    },
    [onlineUsers]
  );

  // Get conversation display name
  const getConversationName = useCallback(
    (conversation: Conversation): string => {
      if (conversation.name) return conversation.name;
      if (conversation.is_group) {
        const others = conversation.participants
          .filter((p) => p.user_id !== user?.id)
          .slice(0, 3);
        return others.map((p) => p.profile?.first_name || "Unknown").join(", ");
      }
      const other = conversation.participants.find((p) => p.user_id !== user?.id);
      if (other?.profile) return `${other.profile.first_name} ${other.profile.last_name}`;
      return "Unknown";
    },
    [user]
  );

  // Initialize data
  useEffect(() => {
    if (user) {
      fetchProfiles();
      fetchConversations();
    }
  }, [user, fetchProfiles, fetchConversations]);

  // Realtime presence using Supabase Presence channels
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("chat-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        Object.keys(state).forEach((key) => {
          if (state[key] && state[key].length > 0) {
            online.add(key);
          }
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Realtime message subscriptions
  useEffect(() => {
    if (!user) return;

    const messagesChannel = supabase
      .channel("chat_messages_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const newMessage = payload.new as any;

          if (activeConversation && newMessage.conversation_id === activeConversation.id) {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("id, user_id, first_name, last_name, avatar_url, job_title")
              .eq("user_id", newMessage.sender_id)
              .single();

            const messageWithSender: Message = {
              ...newMessage,
              content: newMessage.is_encrypted ? newMessage.content || "Message" : newMessage.content,
              sender: senderProfile || undefined,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === messageWithSender.id)) return prev;
              return [...prev, messageWithSender];
            });

            // Mark as read since user is viewing
            markAsRead(activeConversation.id);
          } else if (newMessage.sender_id !== user.id) {
            // Increment unread for other conversations
            setConversations((prev) =>
              prev
                .map((c) =>
                  c.id === newMessage.conversation_id
                    ? {
                        ...c,
                        unread_count: (c.unread_count || 0) + 1,
                        last_message: { ...newMessage, content: newMessage.content },
                      }
                    : c
                )
                .sort((a, b) => {
                  const aTime = a.last_message?.created_at || a.created_at;
                  const bTime = b.last_message?.created_at || b.created_at;
                  return new Date(bTime).getTime() - new Date(aTime).getTime();
                })
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => {
          const updated = payload.new as any;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, content: updated.content, updated_at: updated.updated_at } : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const deleted = payload.old as any;
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [user, activeConversation, markAsRead]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      markAsRead(activeConversation.id);
    }
  }, [activeConversation, fetchMessages, markAsRead]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    profiles,
    onlineUsers,
    loading,
    isOpen,
    setIsOpen,
    totalUnreadCount,
    sendMessage,
    editMessage,
    deleteMessage,
    startConversation,
    createGroupChat,
    addGroupMember,
    renameConversation,
    markAsRead,
    getPresenceStatus,
    getConversationName,
    fetchConversations,
  };
}
