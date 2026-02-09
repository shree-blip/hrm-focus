import { MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  description: string | null;
  participants: { user_id: string; profile?: Profile }[];
  last_message?: Message;
  unread_count?: number;
  created_at: string;
}

interface Props {
  conversations: Conversation[];
  loading: boolean;
  userId: string;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
  getPresenceStatus: (userId: string) => 'online' | 'offline';
  getConversationName: (conv: Conversation) => string;
}

export function ChatConversationList({
  conversations,
  loading,
  userId,
  onSelectConversation,
  onNewChat,
  onCreateGroup,
  getPresenceStatus,
  getConversationName,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border space-y-1">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9"
          onClick={onNewChat}
        >
          <MessageCircle className="h-4 w-4" />
          New Chat
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9"
          onClick={onCreateGroup}
        >
          <Users className="h-4 w-4" />
          Create Group
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No conversations yet
            </p>
          ) : (
            conversations.map((conversation) => {
              const otherParticipant = conversation.participants.find(
                (p) => p.user_id !== userId
              );
              const isOnline = otherParticipant
                ? getPresenceStatus(otherParticipant.user_id) === 'online'
                : false;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      {conversation.is_group ? (
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          <Users className="h-5 w-5" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={otherParticipant?.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {otherParticipant?.profile?.first_name?.[0]}
                            {otherParticipant?.profile?.last_name?.[0]}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    {!conversation.is_group && (
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                          isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">
                        {getConversationName(conversation)}
                      </p>
                      {(conversation.unread_count || 0) > 0 && (
                        <span className="h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    {conversation.last_message && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.last_message.sender_id === userId ? 'You: ' : ''}
                        {conversation.last_message.content}
                      </p>
                    )}
                  </div>
                  {conversation.last_message && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {format(new Date(conversation.last_message.created_at), 'HH:mm')}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
