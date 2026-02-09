import { useState } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface Props {
  profiles: Profile[];
  onSelectUser: (userId: string) => void;
  onBack: () => void;
  getPresenceStatus: (userId: string) => 'online' | 'offline';
}

export function ChatUserList({ profiles, onSelectUser, onBack, getPresenceStatus }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProfiles = profiles.filter((p) =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border bg-primary/5 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-sm">Start a Chat</h3>
      </div>

      {/* Search */}
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

      {/* User list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredProfiles.map((profile) => {
            const isOnline = getPresenceStatus(profile.user_id) === 'online';
            return (
              <button
                key={profile.user_id}
                onClick={() => onSelectUser(profile.user_id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {profile.first_name?.[0]}
                      {profile.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                      isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'
                    )}
                  />
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
            );
          })}
          {filteredProfiles.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
