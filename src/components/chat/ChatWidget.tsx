import { useState, useMemo } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { ChatConversationList } from './ChatConversationList';
import { ChatMessageView } from './ChatMessageView';
import { ChatUserList } from './ChatUserList';
import { CreateGroupDialog } from './CreateGroupDialog';
import { GroupSettingsDialog } from './GroupSettingsDialog';

export function ChatWidget() {
  const { user } = useAuth();
  const {
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
    getPresenceStatus,
    getConversationName,
  } = useChat();

  const [showUserList, setShowUserList] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const onlineCount = useMemo(
    () => profiles.filter((p) => onlineUsers.has(p.user_id)).length,
    [profiles, onlineUsers]
  );

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

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg relative"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold animate-pulse">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
          {totalUnreadCount === 0 && onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-medium">
              {onlineCount}
            </span>
          )}
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] bg-card border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          {showUserList ? (
            <ChatUserList
              profiles={profiles}
              onSelectUser={handleStartChat}
              onBack={() => setShowUserList(false)}
              getPresenceStatus={getPresenceStatus}
            />
          ) : activeConversation ? (
            <>
              <ChatMessageView
                messages={messages}
                conversation={activeConversation}
                userId={user.id}
                onBack={handleBack}
                onSendMessage={sendMessage}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                onOpenSettings={
                  activeConversation.is_group ? () => setShowGroupSettings(true) : undefined
                }
                getPresenceStatus={getPresenceStatus}
                getConversationName={getConversationName}
              />
              {activeConversation.is_group && (
                <GroupSettingsDialog
                  open={showGroupSettings}
                  onOpenChange={setShowGroupSettings}
                  conversation={activeConversation}
                  allProfiles={profiles}
                  userId={user.id}
                  onRename={renameConversation}
                  onAddMember={addGroupMember}
                  getPresenceStatus={getPresenceStatus}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-3 border-b border-border bg-primary/5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Messages</h3>
                  <p className="text-xs text-muted-foreground">{onlineCount} online</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ChatConversationList
                conversations={conversations}
                loading={loading}
                userId={user.id}
                onSelectConversation={(conv) => setActiveConversation(conv as any)}
                onNewChat={() => setShowUserList(true)}
                onCreateGroup={() => setShowCreateGroup(true)}
                getPresenceStatus={getPresenceStatus}
                getConversationName={getConversationName}
              />
            </div>
          )}

          <CreateGroupDialog
            open={showCreateGroup}
            onOpenChange={setShowCreateGroup}
            profiles={profiles}
            onCreateGroup={createGroupChat}
          />
        </div>
      )}
    </div>
  );
}
