import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryption } from "@/hooks/useEncryption";

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

interface UserPresence {
  user_id: string;
  status: "online" | "away" | "offline";
  last_seen: string;
}

export function useChat() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const {
    encrypt,
    decrypt,
    createConversationKey,
    getConversationKey,
    isInitialized: encryptionReady,
  } = useEncryption();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Update user presence
  const updatePresence = useCallback(
    async (status: "online" | "away" | "offline") => {
      if (!user) return;

      try {
        const { data: userProfile } = await supabase.from("profiles").select("org_id").eq("user_id", user.id).single();

        const { data: existingPresence } = await supabase
          .from("user_presence")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(); // Use maybeSingle to avoid error when no record exists

        if (existingPresence) {
          await supabase
            .from("user_presence")
            .update({ status, last_seen: new Date().toISOString() })
            .eq("user_id", user.id);
        } else {
          await supabase.from("user_presence").insert({
            user_id: user.id,
            status,
            org_id: userProfile?.org_id,
          });
        }
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    },
    [user],
  );

  // Fetch all profiles for chat
  const fetchProfiles = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, avatar_url, job_title")
        .neq("user_id", user.id);

      if (error) {
        console.error("Error fetching profiles:", error);
        return;
      }

      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, [user]);

  // Fetch presence for all users
  const fetchPresence = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("user_presence").select("*");

      if (error) {
        console.error("Error fetching presence:", error);
        return;
      }

      const presenceMap = new Map<string, UserPresence>();
      data?.forEach((p) => {
        presenceMap.set(p.user_id, p as UserPresence);
      });
      setPresence(presenceMap);
    } catch (error) {
      console.error("Error fetching presence:", error);
    }
  }, []);

  // Decrypt a message if needed
  const decryptMessageContent = useCallback(
    async (msg: Message): Promise<Message> => {
      if (msg.is_encrypted && msg.encrypted_content && msg.nonce) {
        try {
          const decrypted = await decrypt(msg.encrypted_content, msg.nonce, msg.conversation_id);
          return { ...msg, content: decrypted };
        } catch (error) {
          console.error("Error decrypting message:", error);
          return { ...msg, content: "[Unable to decrypt message]" };
        }
      }
      return msg;
    },
    [decrypt],
  );

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get conversations where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (participantError) {
        console.error("Error fetching participant data:", participantError);
        setConversations([]);
        setLoading(false);
        return;
      }

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);

      const { data: convData, error: convError } = await supabase
        .from("chat_conversations")
        .select("*")
        .in("id", conversationIds);

      if (convError) {
        console.error("Error fetching conversations:", convError);
        setLoading(false);
        return;
      }

      const { data: allParticipants, error: participantsError } = await supabase
        .from("chat_participants")
        .select("*")
        .in("conversation_id", conversationIds);

      if (participantsError) {
        console.error("Error fetching all participants:", participantsError);
        setLoading(false);
        return;
      }

      const participantUserIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, avatar_url, job_title")
        .in("user_id", participantUserIds);

      const conversationsWithData: Conversation[] = await Promise.all(
        (convData || []).map(async (conv) => {
          // Get last message
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const participants =
            allParticipants
              ?.filter((p) => p.conversation_id === conv.id)
              .map((p) => ({
                user_id: p.user_id,
                profile: profilesData?.find((pr) => pr.user_id === p.user_id),
              })) || [];

          // Decrypt last message if encrypted
          let decryptedLastMsg: Message | undefined;
          if (lastMsg) {
            const lastMsgAny = lastMsg as any;
            if (lastMsgAny.is_encrypted && lastMsgAny.encrypted_content && lastMsgAny.nonce) {
              try {
                const decrypted = await decrypt(lastMsgAny.encrypted_content, lastMsgAny.nonce, conv.id);
                decryptedLastMsg = { ...lastMsgAny, content: decrypted };
              } catch {
                decryptedLastMsg = { ...lastMsgAny, content: "[Encrypted]" };
              }
            } else {
              decryptedLastMsg = lastMsg as Message;
            }
          }

          return {
            ...conv,
            description: (conv as any).description || null,
            participants,
            last_message: decryptedLastMsg,
          };
        }),
      );

      // Sort by last message time
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
  }, [user, decrypt]);

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

        // Decrypt messages
        const messagesWithSenders = await Promise.all(
          (data || []).map(async (msg) => {
            const msgAny = msg as any;
            const message: Message = {
              ...msg,
              is_encrypted: msgAny.is_encrypted,
              encrypted_content: msgAny.encrypted_content,
              nonce: msgAny.nonce,
              sender: senderProfiles?.find((p) => p.user_id === msg.sender_id),
            };
            return await decryptMessageContent(message);
          }),
        );

        setMessages(messagesWithSenders);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    },
    [decryptMessageContent],
  );

  // Create or get existing DM conversation using RPC function
  const startConversation = useCallback(
    async (otherUserId: string) => {
      if (!user) return null;

      // Check if conversation already exists locally
      const existingConv = conversations.find(
        (c) => !c.is_group && c.participants.some((p) => p.user_id === otherUserId),
      );

      if (existingConv) {
        setActiveConversation(existingConv);
        await fetchMessages(existingConv.id);
        return existingConv;
      }

      try {
        // Use RPC function to create conversation atomically
        const { data: conversationId, error: rpcError } = await supabase.rpc("create_dm_conversation", {
          _other_user_id: otherUserId,
        });

        if (rpcError) {
          console.error("RPC error:", rpcError);
          throw rpcError;
        }

        if (!conversationId) {
          throw new Error("No conversation ID returned");
        }

        // Create encryption key for this conversation
        try {
          await createConversationKey(conversationId, [user.id, otherUserId]);
        } catch (encryptError) {
          console.warn("Could not create encryption key:", encryptError);
        }

        // Fetch the conversation data
        const { data: newConvData, error: fetchError } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("id", conversationId)
          .single();

        if (fetchError) {
          console.error("Error fetching new conversation:", fetchError);
          throw fetchError;
        }

        const otherProfile = profiles.find((p) => p.user_id === otherUserId);
        const conversation: Conversation = {
          ...newConvData,
          description: null,
          participants: [
            { user_id: user.id, profile: profile as unknown as Profile },
            { user_id: otherUserId, profile: otherProfile },
          ],
        };

        // Refresh conversations list
        await fetchConversations();

        setActiveConversation(conversation);
        setMessages([]);
        return conversation;
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast({
          title: "Error",
          description: "Failed to start conversation. Please try again.",
          variant: "destructive",
        });
        return null;
      }
    },
    [user, profile, conversations, profiles, fetchConversations, fetchMessages, createConversationKey, toast],
  );

  // Create a group chat using RPC function
  const createGroupChat = useCallback(
    async (name: string, memberUserIds: string[]) => {
      if (!user) return null;

      try {
        // Use RPC function to create group atomically
        const { data: conversationId, error: rpcError } = await supabase.rpc("create_group_conversation", {
          _name: name,
          _member_ids: memberUserIds,
        });

        if (rpcError) {
          console.error("RPC error:", rpcError);
          throw rpcError;
        }

        if (!conversationId) {
          throw new Error("No conversation ID returned");
        }

        // Create encryption key for all members
        const allMembers = [user.id, ...memberUserIds];
        try {
          await createConversationKey(conversationId, allMembers);
        } catch (encryptError) {
          console.warn("Could not create encryption key:", encryptError);
        }

        await fetchConversations();

        toast({
          title: "Group created",
          description: `"${name}" group chat has been created`,
        });

        return { id: conversationId };
      } catch (error) {
        console.error("Error creating group chat:", error);
        toast({
          title: "Error",
          description: "Failed to create group chat. Please try again.",
          variant: "destructive",
        });
        return null;
      }
    },
    [user, fetchConversations, createConversationKey, toast],
  );

  // Add member to group using RPC function
  const addGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      if (!user) return false;

      try {
        const { error: rpcError } = await supabase.rpc("add_group_member", {
          _conversation_id: conversationId,
          _new_member_id: userId,
        });

        if (rpcError) {
          console.error("RPC error:", rpcError);
          throw rpcError;
        }

        // Re-create encryption key for all members
        const { data: allParticipants } = await supabase
          .from("chat_participants")
          .select("user_id")
          .eq("conversation_id", conversationId);

        if (allParticipants) {
          try {
            await createConversationKey(
              conversationId,
              allParticipants.map((p) => p.user_id),
            );
          } catch (encryptError) {
            console.warn("Could not update encryption key:", encryptError);
          }
        }

        await fetchConversations();
        return true;
      } catch (error) {
        console.error("Error adding member:", error);
        toast({
          title: "Error",
          description: "Failed to add member to group.",
          variant: "destructive",
        });
        return false;
      }
    },
    [user, fetchConversations, createConversationKey, toast],
  );

  // Send message (with optional encryption)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !activeConversation || !content.trim()) return;

      try {
        let messageData: Record<string, any> = {
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: content.trim(),
          is_encrypted: false,
        };

        // Try to encrypt the message
        try {
          const encrypted = await encrypt(content.trim(), activeConversation.id);
          if (encrypted) {
            messageData = {
              ...messageData,
              content: "[Encrypted message]",
              encrypted_content: encrypted.ciphertext,
              nonce: encrypted.nonce,
              is_encrypted: true,
            };
          }
        } catch (encryptError) {
          console.warn("Encryption failed, sending unencrypted:", encryptError);
          // Continue with unencrypted message
        }

        const { error } = await supabase.from("chat_messages").insert(messageData);

        if (error) {
          console.error("Error inserting message:", error);
          throw error;
        }
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    },
    [user, activeConversation, encrypt, toast],
  );

  // Get presence status for a user
  const getPresenceStatus = useCallback(
    (userId: string): "online" | "away" | "offline" => {
      const userPresence = presence.get(userId);
      if (!userPresence) return "offline";

      const lastSeen = new Date(userPresence.last_seen);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (lastSeen < fiveMinutesAgo) return "offline";
      return userPresence.status;
    },
    [presence],
  );

  // Get conversation display name
  const getConversationName = useCallback(
    (conversation: Conversation): string => {
      if (conversation.name) return conversation.name;

      if (conversation.is_group) {
        const otherParticipants = conversation.participants.filter((p) => p.user_id !== user?.id).slice(0, 3);
        return otherParticipants.map((p) => p.profile?.first_name || "Unknown").join(", ");
      }

      const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.id);
      if (otherParticipant?.profile) {
        return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
      }
      return "Unknown";
    },
    [user],
  );

  // Initialize and set up presence
  useEffect(() => {
    if (user) {
      // Don't wait for encryption to be ready for basic functionality
      updatePresence("online");
      fetchProfiles();
      fetchPresence();
      fetchConversations();

      const interval = setInterval(() => {
        updatePresence("online");
        fetchPresence();
      }, 60000);

      const handleUnload = () => {
        updatePresence("offline");
      };
      window.addEventListener("beforeunload", handleUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener("beforeunload", handleUnload);
        updatePresence("offline");
      };
    }
  }, [user, updatePresence, fetchProfiles, fetchPresence, fetchConversations]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const messagesChannel = supabase
      .channel("chat_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          if (activeConversation && newMessage.conversation_id === activeConversation.id) {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("id, user_id, first_name, last_name, avatar_url, job_title")
              .eq("user_id", newMessage.sender_id)
              .single();

            const messageWithSender: Message = { ...newMessage, sender: senderProfile || undefined };
            const decryptedMessage = await decryptMessageContent(messageWithSender);

            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === decryptedMessage.id)) {
                return prev;
              }
              return [...prev, decryptedMessage];
            });
          }

          // Refresh conversations to update last message
          fetchConversations();
        },
      )
      .subscribe();

    const presenceChannel = supabase
      .channel("user_presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newPresence = payload.new as UserPresence;
            setPresence((prev) => new Map(prev).set(newPresence.user_id, newPresence));
          }
        },
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      presenceChannel.unsubscribe();
    };
  }, [user, activeConversation, fetchConversations, decryptMessageContent]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation, fetchMessages]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    profiles,
    presence,
    loading,
    isOpen,
    setIsOpen,
    sendMessage,
    startConversation,
    createGroupChat,
    addGroupMember,
    getPresenceStatus,
    getConversationName,
    fetchConversations,
    encryptionReady,
  };
}
