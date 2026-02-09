import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Settings, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
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
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  participants: { user_id: string; profile?: Profile }[];
}

interface Props {
  messages: Message[];
  conversation: Conversation;
  userId: string;
  onBack: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onOpenSettings?: () => void;
  getPresenceStatus: (userId: string) => 'online' | 'offline';
  getConversationName: (conv: Conversation) => string;
}

export function ChatMessageView({
  messages,
  conversation,
  userId,
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onOpenSettings,
  getPresenceStatus,
  getConversationName,
}: Props) {
  const [messageInput, setMessageInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    await onSendMessage(messageInput);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId) {
        handleSaveEdit();
      } else {
        handleSend();
      }
    }
  };

  const handleStartEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    await onEditMessage(editingId, editContent.trim());
    setEditingId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const otherParticipant = conversation.participants.find((p) => p.user_id !== userId);
  const otherStatus = otherParticipant ? getPresenceStatus(otherParticipant.user_id) : 'offline';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border bg-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold text-sm">{getConversationName(conversation)}</h3>
            {!conversation.is_group && (
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    otherStatus === 'online' ? 'bg-green-500' : 'bg-muted-foreground/50'
                  )}
                />
                <span className="text-xs text-muted-foreground capitalize">{otherStatus}</span>
              </div>
            )}
            {conversation.is_group && (
              <p className="text-xs text-muted-foreground">
                {conversation.participants.length} members
              </p>
            )}
          </div>
        </div>
        {conversation.is_group && onOpenSettings && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((message) => {
            const isOwn = message.sender_id === userId;
            const isEditing = editingId === message.id;

            return (
              <div
                key={message.id}
                className={cn('flex gap-2 group', isOwn && 'flex-row-reverse')}
              >
                {!isOwn && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.sender?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {message.sender?.first_name?.[0]}
                      {message.sender?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn('max-w-[75%] space-y-1', isOwn && 'items-end')}>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="icon" className="h-8 w-8" onClick={handleSaveEdit}>
                        <Send className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1">
                      <div
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm',
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        )}
                      >
                        {message.content}
                      </div>
                      {isOwn && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                              <Pencil className="h-3 w-3 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => onDeleteMessage(message.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                  <p className={cn('text-[10px] text-muted-foreground', isOwn && 'text-right')}>
                    {format(new Date(message.created_at), 'HH:mm')}
                    {message.updated_at && message.updated_at !== message.created_at && (
                      <span className="ml-1 italic">(edited)</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyPress}
            className="h-9"
          />
          <Button size="icon" className="h-9 w-9" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
