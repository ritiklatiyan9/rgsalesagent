import { useState, useMemo, useDeferredValue, useEffect, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChatCtx } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, X, MessageSquare, Loader2, UsersRound, UserPlus, Users,
  MoreVertical, Trash2, Check,
} from 'lucide-react';

const ROLE_COLORS = {
  ADMIN: 'bg-orange-100 text-orange-700 border-orange-200',
  AGENT: 'bg-blue-100 text-blue-700 border-blue-200',
  TEAM_HEAD: 'bg-violet-100 text-violet-700 border-violet-200',
};

const ROLE_AVATAR_COLORS = {
  ADMIN: 'from-orange-400 to-orange-600',
  AGENT: 'from-blue-400 to-blue-600',
  TEAM_HEAD: 'from-violet-400 to-violet-600',
};

const getParticipantPhone = (p) => {
  const raw = p?.phone || p?.phone_number || p?.mobile || p?.mobile_number
    || p?.whatsapp_number || p?.contact_number || p?.number;
  return raw ? String(raw).trim() : '';
};

const getParticipantDisplayName = (p) => {
  const name = p?.name || p?.contact_name || p?.lead_name;
  if (name && String(name).trim()) return String(name).trim();
  const phone = getParticipantPhone(p);
  return phone || 'Unknown';
};

// ─── Conversation Item ───
const ConversationItem = memo(function ConversationItem({ conv, onClick, unreadCount = 0 }) {
  const isGroup = !!conv?.is_group;
  const other = conv.other_participants?.[0];
  const participants = conv.other_participants || [];
  const otherName = getParticipantDisplayName(other);
  const title = isGroup
    ? (conv.group_name || participants.map((p) => p.name).slice(0, 2).join(', ') || 'Group Chat')
    : otherName;
  const lastMsg = conv.last_message;
  const time = lastMsg?.created_at
    ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 hover:bg-[#f5f5f5] active:bg-slate-100/80"
    >
      <Avatar className="h-11 w-11 shrink-0 ring-1 ring-white/80 shadow-sm">
        {!isGroup && other?.profile_photo ? <AvatarImage src={other.profile_photo} alt={other.name} /> : null}
        <AvatarFallback className={cn(
          'text-white font-bold text-sm',
          isGroup
            ? 'bg-linear-to-br from-green-500 via-emerald-500 to-teal-500'
            : ROLE_AVATAR_COLORS[other?.role]
              ? `bg-linear-to-br ${ROLE_AVATAR_COLORS[other.role]}`
              : 'bg-linear-to-br from-slate-400 to-slate-600'
        )}>
          {isGroup ? <UsersRound className="h-4 w-4" /> : (otherName?.charAt(0)?.toUpperCase() || '?')}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-slate-800 truncate">{title}</span>
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            {time && (
              <span className={cn('text-[11px]', unreadCount > 0 ? 'text-[#25d366] font-semibold' : 'text-slate-400')}>
                {time}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-[#25d366] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadLabel}
              </span>
            )}
          </div>
        </div>
        <p className="text-[12.5px] text-slate-500 truncate mt-0.5 leading-tight">
          {isGroup && <span className="text-[#25d366] font-medium">Group · </span>}
          {!isGroup && other?.role && (
            <span className={cn('font-medium',
              other.role === 'ADMIN' ? 'text-orange-500' :
              other.role === 'TEAM_HEAD' ? 'text-violet-500' : 'text-blue-500'
            )}>{other.role} · </span>
          )}
          {lastMsg?.is_deleted
            ? 'Message deleted'
            : (lastMsg?.message_text || (lastMsg?.file_name ? '📎 File' : 'No messages yet'))}
        </p>
      </div>
    </div>
  );
});

// ─── User Picker ───
function UserPicker({ users, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleSelect = (userId) => {
    onSelect(userId);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="New Chat"
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-xl rounded-2xl border-0 ring-1 ring-slate-200" align="end" sideOffset={8}>
        <div className="bg-[#075e54] px-4 py-3 rounded-t-2xl">
          <p className="text-sm font-semibold text-white">New Chat</p>
        </div>
        <div className="p-2.5 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm rounded-xl bg-slate-50 border-slate-200"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No users found</p>
            </div>
          ) : (
            filtered.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl hover:bg-[#f0fdf4] transition-colors text-left"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {u.profile_photo ? <AvatarImage src={u.profile_photo} alt={u.name} /> : null}
                  <AvatarFallback className={cn(
                    'text-white font-bold text-xs',
                    ROLE_AVATAR_COLORS[u.role] ? `bg-linear-to-br ${ROLE_AVATAR_COLORS[u.role]}` : 'bg-linear-to-br from-slate-400 to-slate-600'
                  )}>
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{u.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-3.5 font-medium border', ROLE_COLORS[u.role])}>
                      {u.role}
                    </Badge>
                    <span className="text-[10px] text-slate-400 truncate">{u.email}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Group Creator ───
function GroupCreatorDialog({ open, onOpenChange, users, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const reset = () => { setGroupName(''); setSearch(''); setSelected([]); setSubmitting(false); };

  const handleCreate = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    try {
      await onCreate(groupName.trim() || 'New Group', selected);
      onOpenChange(false);
      reset();
    } catch {
      alert('Failed to create group. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl">
        <div className="bg-[#075e54] px-5 py-4">
          <DialogTitle className="text-base font-semibold text-white">Create New Group</DialogTitle>
          <p className="text-xs text-[#9debc7] mt-1">Pick members and start team chat instantly.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Group Name</p>
            <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Eg. Site Followups" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members" className="pl-8 h-9 rounded-xl bg-slate-50" />
            </div>
            <ScrollArea className="h-56 rounded-xl border border-slate-200">
              <div className="p-2 space-y-1">
                {filtered.map(u => {
                  const sel = selected.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => toggleUser(u.id)}
                      className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors border',
                        sel ? 'border-[#25d366]/40 bg-[#f0fdf4]' : 'border-transparent hover:bg-slate-50'
                      )}>
                      <Avatar className="h-8 w-8 shrink-0">
                        {u.profile_photo ? <AvatarImage src={u.profile_photo} alt={u.name} /> : null}
                        <AvatarFallback className={cn('text-white font-bold text-xs',
                          ROLE_AVATAR_COLORS[u.role] ? `bg-linear-to-br ${ROLE_AVATAR_COLORS[u.role]}` : 'bg-linear-to-br from-slate-400 to-slate-600'
                        )}>{u.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      {sel && <Check className="h-4 w-4 text-[#25d366] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <p className="text-xs text-slate-500">{selected.length} member{selected.length === 1 ? '' : 's'} selected</p>
        </div>
        <DialogFooter className="px-5 pb-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={submitting || !selected.length} className="bg-[#25d366] hover:bg-[#1fab5d] text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UsersRound className="h-4 w-4 mr-1.5" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ChatList Page ───
export default function ChatList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    conversations, loading, unreadCounts,
    startConversation, startGroupConversation,
    setActiveConversation, markConversationAsRead,
    deleteConversation, users,
  } = useChatCtx();

  const [search, setSearch] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const deferredSearch = useDeferredValue(search);

  // Handle ?conversation=ID deep link (from push notification)
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (!convId) return;
    navigate(`/chat/${convId}`, { replace: true });
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (!deferredSearch.trim()) return conversations;
    const q = deferredSearch.toLowerCase();
    return conversations.filter(c => {
      if (c.is_group) {
        return (c.group_name?.toLowerCase() || '').includes(q)
          || (c.other_participants || []).some(p => p.name?.toLowerCase().includes(q));
      }
      const other = c.other_participants?.[0];
      const name = getParticipantDisplayName(other).toLowerCase();
      const phone = getParticipantPhone(other).toLowerCase();
      return name.includes(q) || phone.includes(q) || other?.email?.toLowerCase().includes(q);
    });
  }, [conversations, deferredSearch]);

  const unreadTotal = useMemo(
    () => Object.values(unreadCounts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [unreadCounts]
  );

  const openConv = (conv) => {
    setActiveConversation(conv);
    markConversationAsRead(conv.id);
    navigate(`/chat/${conv.id}`);
  };

  const handleStartChat = async (userId) => {
    const conv = await startConversation(userId);
    if (conv) {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
      navigate(`/chat/${conv.id}`);
    }
  };

  const handleCreateGroup = async (name, participantIds) => {
    const conv = await startGroupConversation(name, participantIds);
    if (conv) {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
      navigate(`/chat/${conv.id}`);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteConversation(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete conversation');
    }
  };

  if (loading) {
    return (
      <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#25d366]" />
          <span className="text-xs text-slate-400 font-medium">Loading chats…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)] flex flex-col overflow-hidden bg-white">

      {/* Header */}
      <div className="bg-[#075e54] shrink-0 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-[17px] font-semibold text-white flex-1 tracking-tight">Chats</h1>
          {unreadTotal > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#25d366] text-white text-[10px] font-bold flex items-center justify-center">
              {unreadTotal}
            </span>
          )}
          <button
            type="button"
            onClick={() => setGroupDialogOpen(true)}
            title="New Group"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <UsersRound className="h-5 w-5" />
          </button>
          <UserPicker users={users} onSelect={handleStartChat} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9debc7]" />
          <input
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 h-9 text-[13px] rounded-xl bg-[#128C7E]/60 border-0 text-white placeholder-[#9debc7]/80 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-[#9debc7]" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100/80">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4">
            <MessageSquare className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">
              {search ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!search && (
              <p className="text-xs text-slate-400 mt-1">Tap + to start a new chat</p>
            )}
          </div>
        ) : (
          filtered.map(conv => {
            const canDelete = !conv?.is_group || String(conv?.created_by || '') === String(user?.id || '');
            return (
              <div key={conv.id} className="group relative">
                <ConversationItem
                  conv={conv}
                  unreadCount={unreadCounts[String(conv.id)] || 0}
                  onClick={() => openConv(conv)}
                />
                {canDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={e => e.stopPropagation()}
                        className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto shadow-sm transition-opacity"
                      >
                        <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteConfirm(conv)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {conv.is_group ? 'Delete Group' : 'Delete Chat'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
        {/* Bottom padding for mobile nav bar */}
        <div className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:hidden" />
      </div>

      {/* Delete Conversation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl">
          <div className="bg-[#075e54] px-5 py-4">
            <DialogTitle className="text-base font-semibold text-white">
              {deleteConfirm?.is_group ? 'Delete Group' : 'Delete Chat'}
            </DialogTitle>
          </div>
          <p className="text-sm text-slate-500 px-5 py-4">
            {deleteConfirm?.is_group
              ? 'Are you sure you want to delete this group and all messages? This cannot be undone.'
              : 'Are you sure you want to delete this chat and all messages? This cannot be undone.'}
          </p>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} size="sm">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConversation} size="sm">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupCreatorDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        users={users}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}
