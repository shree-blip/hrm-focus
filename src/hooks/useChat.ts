import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
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
  status: 'online' | 'away' | 'offline';
  last_seen: string;
}

export function useChat() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Update user presence
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'offline') => {
    if (!user) return;

    try {
      // Get org_id from supabase profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      const { data: existingPresence } = await supabase
        .from('user_presence')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingPresence) {
        await supabase
          .from('user_presence')
          .update({ status, last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_presence')
          .insert({
            user_id: user.id,
            status,
            org_id: userProfile?.org_id
          });
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [user]);

  // Fetch all profiles for chat
  const fetchProfiles = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name, avatar_url, job_title')
      .neq('user_id', user.id);

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    setProfiles(data || []);
  }, [user]);

  // Fetch presence for all users
  const fetchPresence = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*');

    if (error) {
      console.error('Error fetching presence:', error);
      return;
    }

    const presenceMap = new Map<string, UserPresence>();
    data?.forEach(p => {
      presenceMap.set(p.user_id, p as UserPresence);
    });
    setPresence(presenceMap);
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get all conversations the user is part of
      const { data: participantData, error: participantError } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      // Fetch conversations
      const { data: convData, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .in('id', conversationIds);

      if (convError) throw convError;

      // Fetch all participants for these conversations
      const { data: allParticipants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('*')
        .in('conversation_id', conversationIds);

      if (participantsError) throw participantsError;

      // Fetch profiles for all participants
      const participantUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, avatar_url, job_title')
        .in('user_id', participantUserIds);

      // Fetch last message for each conversation
      const conversationsWithData: Conversation[] = await Promise.all(
        (convData || []).map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const participants = allParticipants
            ?.filter(p => p.conversation_id === conv.id)
            .map(p => ({
              user_id: p.user_id,
              profile: profilesData?.find(pr => pr.user_id === p.user_id)
            })) || [];

          return {
            ...conv,
            participants,
            last_message: lastMsg || undefined
          };
        })
      );

      // Sort by last message time
      conversationsWithData.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(conversationsWithData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Fetch sender profiles
    const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
    const { data: senderProfiles } = await supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name, avatar_url, job_title')
      .in('user_id', senderIds);

    const messagesWithSenders = data?.map(msg => ({
      ...msg,
      sender: senderProfiles?.find(p => p.user_id === msg.sender_id)
    })) || [];

    setMessages(messagesWithSenders);
  }, []);

  // Create or get existing conversation with a user
  const startConversation = useCallback(async (otherUserId: string) => {
    if (!user) return null;

    // Check if conversation already exists
    const existingConv = conversations.find(c => 
      !c.is_group && 
      c.participants.some(p => p.user_id === otherUserId)
    );

    if (existingConv) {
      setActiveConversation(existingConv);
      await fetchMessages(existingConv.id);
      return existingConv;
    }

    try {
      // Get org_id from supabase profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          is_group: false,
          org_id: userProfile?.org_id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: partError } = await supabase
        .from('chat_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId }
        ]);

      if (partError) throw partError;

      // Refresh conversations
      await fetchConversations();

      // Set the new conversation as active
      const otherProfile = profiles.find(p => p.user_id === otherUserId);
      const conversation: Conversation = {
        ...newConv,
        participants: [
          { user_id: user.id, profile: profile as unknown as Profile },
          { user_id: otherUserId, profile: otherProfile }
        ]
      };
      setActiveConversation(conversation);
      setMessages([]);
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive'
      });
      return null;
    }
  }, [user, profile, conversations, profiles, fetchConversations, fetchMessages, toast]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !activeConversation || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Message will be added via realtime subscription
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    }
  }, [user, activeConversation, toast]);

  // Get presence status for a user
  const getPresenceStatus = useCallback((userId: string): 'online' | 'away' | 'offline' => {
    const userPresence = presence.get(userId);
    if (!userPresence) return 'offline';
    
    // Consider offline if last seen more than 5 minutes ago
    const lastSeen = new Date(userPresence.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (lastSeen < fiveMinutesAgo) return 'offline';
    return userPresence.status;
  }, [presence]);

  // Get conversation display name
  const getConversationName = useCallback((conversation: Conversation): string => {
    if (conversation.name) return conversation.name;
    
    const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
    if (otherParticipant?.profile) {
      return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
    }
    return 'Unknown';
  }, [user]);

  // Initialize and set up presence
  useEffect(() => {
    if (user) {
      updatePresence('online');
      fetchProfiles();
      fetchPresence();
      fetchConversations();

      // Update presence periodically
      const interval = setInterval(() => {
        updatePresence('online');
        fetchPresence();
      }, 60000); // Every minute

      // Set offline on page unload
      const handleUnload = () => {
        updatePresence('offline');
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleUnload);
        updatePresence('offline');
      };
    }
  }, [user, updatePresence, fetchProfiles, fetchPresence, fetchConversations]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // If it's for the active conversation, add it to messages
          if (activeConversation && newMessage.conversation_id === activeConversation.id) {
            // Fetch sender profile
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, user_id, first_name, last_name, avatar_url, job_title')
              .eq('user_id', newMessage.sender_id)
              .single();

            setMessages(prev => [...prev, { ...newMessage, sender: senderProfile || undefined }]);
          }

          // Refresh conversations to update last message
          fetchConversations();
        }
      )
      .subscribe();

    // Subscribe to presence changes
    const presenceChannel = supabase
      .channel('user_presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPresence = payload.new as UserPresence;
            setPresence(prev => new Map(prev).set(newPresence.user_id, newPresence));
          }
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      presenceChannel.unsubscribe();
    };
  }, [user, activeConversation, fetchConversations]);

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
    getPresenceStatus,
    getConversationName,
    fetchConversations
  };
}
