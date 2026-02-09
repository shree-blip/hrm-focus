import { useState } from 'react';
import { UserPlus, Pencil, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  participants: { user_id: string; profile?: Profile }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  allProfiles: Profile[];
  userId: string;
  onRename: (conversationId: string, newName: string) => Promise<void>;
  onAddMember: (conversationId: string, userId: string) => Promise<boolean>;
  getPresenceStatus: (userId: string) => 'online' | 'offline';
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  conversation,
  allProfiles,
  userId,
  onRename,
  onAddMember,
  getPresenceStatus,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(conversation.name || '');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const participantIds = new Set(conversation.participants.map((p) => p.user_id));
  const availableMembers = allProfiles.filter(
    (p) =>
      !participantIds.has(p.user_id) &&
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleRename = async () => {
    if (!newName.trim()) return;
    await onRename(conversation.id, newName.trim());
    setIsRenaming(false);
  };

  const handleAddMember = async (memberId: string) => {
    setAdding(true);
    try {
      await onAddMember(conversation.id, memberId);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Group Name</p>
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                />
                <Button size="icon" className="h-9 w-9" onClick={handleRename}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => setIsRenaming(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{conversation.name || 'Unnamed Group'}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setNewName(conversation.name || '');
                    setIsRenaming(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">
                Members ({conversation.participants.length})
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setShowAddMember(!showAddMember)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {showAddMember && (
              <div className="mb-3 space-y-2">
                <Input
                  placeholder="Search members to add..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="h-8"
                />
                <ScrollArea className="h-32 border rounded-md">
                  <div className="p-1 space-y-1">
                    {availableMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No users available to add
                      </p>
                    ) : (
                      availableMembers.map((profile) => (
                        <button
                          key={profile.user_id}
                          onClick={() => handleAddMember(profile.user_id)}
                          disabled={adding}
                          className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left text-sm"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {profile.first_name?.[0]}
                              {profile.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {profile.first_name} {profile.last_name}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <ScrollArea className="h-40">
              <div className="space-y-1">
                {conversation.participants.map((p) => {
                  const isOnline = getPresenceStatus(p.user_id) === 'online';
                  const isYou = p.user_id === userId;
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg"
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {p.profile?.first_name?.[0]}
                            {p.profile?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card',
                            isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.profile?.first_name} {p.profile?.last_name}
                          {isYou && (
                            <span className="text-xs text-muted-foreground ml-1">(You)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
