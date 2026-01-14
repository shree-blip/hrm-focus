import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export function ChatWidget() {
  const { user } = useAuth();
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    profiles,
    loading,
    isOpen,
    setIsOpen,
    sendMessage,
    startConversation,
    createGroupChat,
    getPresenceStatus,
    getConversationName
  } = useChat();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    await sendMessage(messageInput);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartChat = async (userId: string) => {
    await startConversation(userId);
    setShowUserList(false);
  };

  const handleBack = () => {
    if (showUserList) {
      setShowUserList(false);
    } else if (activeConversation) {
      setActiveConversation(null);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: 'online' | 'away' | 'offline') => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-muted-foreground/50';
    }
  };

  const onlineCount = profiles.filter(p => getPresenceStatus(p.user_id) === 'online').length;

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          {onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 text-xs flex items-center justify-center text-white font-medium">
              {onlineCount}
            </span>
          )}
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] bg-card border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(activeConversation || showUserList) && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <h3 className="font-semibold text-sm">
                  {showUserList 
                    ? 'Start a Chat' 
                    : activeConversation 
                      ? getConversationName(activeConversation)
                      : 'Messages'
                  }
                </h3>
                {!showUserList && !activeConversation && (
                  <p className="text-xs text-muted-foreground">
                    {onlineCount} online
                  </p>
                )}
                {activeConversation && !activeConversation.is_group && (
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      getStatusColor(getPresenceStatus(
                        activeConversation.participants.find(p => p.user_id !== user?.id)?.user_id || ''
                      ))
                    )} />
                    <span className="text-xs text-muted-foreground capitalize">
                      {getPresenceStatus(
                        activeConversation.participants.find(p => p.user_id !== user?.id)?.user_id || ''
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {showUserList ? (
              // User list for starting new chat
              <div className="flex flex-col h-full">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {filteredProfiles.map(profile => (
                      <button
                        key={profile.user_id}
                        onClick={() => handleStartChat(profile.user_id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {profile.first_name?.[0]}{profile.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
                            getStatusColor(getPresenceStatus(profile.user_id))
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {profile.first_name} {profile.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {profile.job_title || 'Employee'}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredProfiles.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        No users found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : activeConversation ? (
              // Messages view
              <div className="flex flex-col h-full">
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {messages.map(message => {
                      const isOwn = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-2",
                            isOwn && "flex-row-reverse"
                          )}
                        >
                          {!isOwn && (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={message.sender?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {message.sender?.first_name?.[0]}{message.sender?.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            "max-w-[75%] space-y-1",
                            isOwn && "items-end"
                          )}>
                            <div className={cn(
                              "px-3 py-2 rounded-lg text-sm",
                              isOwn 
                                ? "bg-primary text-primary-foreground rounded-br-none" 
                                : "bg-muted rounded-bl-none"
                            )}>
                              {message.content}
                            </div>
                            <p className={cn(
                              "text-[10px] text-muted-foreground",
                              isOwn && "text-right"
                            )}>
                              {format(new Date(message.created_at), 'HH:mm')}
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
                      onKeyPress={handleKeyPress}
                      className="h-9"
                    />
                    <Button size="icon" className="h-9 w-9" onClick={handleSendMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Conversations list
              <div className="flex flex-col h-full">
                <div className="p-2 border-b border-border">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-9"
                    onClick={() => setShowUserList(true)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Start New Chat
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
                      conversations.map(conversation => {
                        const otherParticipant = conversation.participants.find(
                          p => p.user_id !== user?.id
                        );
                        return (
                          <button
                            key={conversation.id}
                            onClick={() => setActiveConversation(conversation)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={otherParticipant?.profile?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {otherParticipant?.profile?.first_name?.[0]}
                                  {otherParticipant?.profile?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className={cn(
                                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
                                getStatusColor(getPresenceStatus(otherParticipant?.user_id || ''))
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {getConversationName(conversation)}
                              </p>
                              {conversation.last_message && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {conversation.last_message.sender_id === user?.id ? 'You: ' : ''}
                                  {conversation.last_message.content}
                                </p>
                              )}
                            </div>
                            {conversation.last_message && (
                              <span className="text-[10px] text-muted-foreground">
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
