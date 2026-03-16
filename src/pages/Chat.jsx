import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, useTransition, memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Send, Paperclip, MoreVertical, Pencil, Trash2, FileText,
  Download, Search, MessageSquare, X, Loader2, Check, ArrowDown,
  UserPlus, Users, UsersRound,
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

const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || '');

// ─── File Preview ───
const FilePreview = memo(function FilePreview({ fileUrl, fileName }) {
  const isImage = isImageFile(fileName);
  return (
    <div className="mt-2 rounded-2xl overflow-hidden border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-sm">
      {isImage ? (
        <img src={fileUrl} alt={fileName} className="max-w-65 max-h-50 object-cover" loading="lazy" />
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-3.5">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-emerald-50 to-green-100 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
            <p className="text-[11px] text-slate-400">Document</p>
          </div>
        </div>
      )}
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName}
        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors border-t border-slate-100">
        <Download className="h-3.5 w-3.5" /> Download
      </a>
    </div>
  );
});

// ─── Message Bubble ───
const MessageBubble = memo(function MessageBubble({ msg, isOwn, permissions, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isEdited = msg.updated_at && msg.updated_at !== msg.created_at && !msg.is_deleted;
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isPending = msg._pending;

  if (msg.is_deleted) {
    return (
      <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[75%] px-4 py-3 rounded-2xl text-sm italic bg-slate-50 text-slate-400 border border-slate-100">
          <span>This message was deleted</span>
          <span className="block text-[10px] mt-1 opacity-50">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-3 group', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[78%] relative')}>
        {!isOwn && (
          <p className="text-[11px] text-slate-400 mb-0.5 ml-3 font-medium tracking-wide">{msg.sender_name}</p>
        )}
        <div className={cn(
          'px-4 py-3 rounded-2xl text-[14px] relative transition-all',
          isOwn
            ? 'bg-linear-to-br from-green-500 to-emerald-600 text-white rounded-br-md shadow-md shadow-green-200/60'
            : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-bl-md',
          isPending && 'opacity-60'
        )}>
          {msg.message_text && <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{msg.message_text}</p>}
          {msg.file_url && <FilePreview fileUrl={msg.file_url} fileName={msg.file_name} />}
          <div className={cn('flex items-center gap-1.5 mt-1.5', isOwn ? 'justify-end' : 'justify-start')}>
            <span className={cn('text-[10px] tracking-wide', isOwn ? 'text-green-100/90' : 'text-slate-400')}>{time}</span>
            {isEdited && <span className={cn('text-[10px]', isOwn ? 'text-green-200/80' : 'text-slate-400')}>(edited)</span>}
            {isPending && <Loader2 className="h-3 w-3 animate-spin text-green-200/80" />}
          </div>
        </div>

        {isOwn && (permissions.can_edit_message || permissions.can_delete_message) && !isPending && (
          <div className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 hover:shadow transition-all">
                  <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36">
                {permissions.can_edit_message && msg.message_type === 'text' && (
                  <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(msg); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                )}
                {permissions.can_delete_message && (
                  <DropdownMenuItem onClick={() => { setMenuOpen(false); onDelete(msg); }} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Conversation Item ───
const ConversationItem = memo(function ConversationItem({ conv, isActive, onClick, unreadCount = 0 }) {
  const isGroup = !!conv?.is_group;
  const other = conv.other_participants?.[0];
  const participants = conv.other_participants || [];
  const title = isGroup
    ? (conv.group_name || participants.map((p) => p.name).slice(0, 2).join(', ') || 'Group Chat')
    : (other?.name || 'Unknown');
  const lastMsg = conv.last_message;
  const time = lastMsg?.created_at
    ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 cursor-pointer rounded-2xl transition-all duration-200',
        isActive
          ? 'bg-linear-to-r from-green-50 to-emerald-50 border border-green-200/80 shadow-sm'
          : 'hover:bg-slate-50 border border-transparent'
      )}
    >
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-white shadow-sm">
        {!isGroup && other?.profile_photo ? <AvatarImage src={other.profile_photo} alt={other.name} /> : null}
        <AvatarFallback className={cn(
          'text-white font-bold text-sm',
          isGroup
            ? 'bg-linear-to-br from-green-500 via-emerald-500 to-teal-500'
            : (ROLE_AVATAR_COLORS[other?.role] || 'from-slate-400 to-slate-600')
        )}>
          {isGroup ? <UsersRound className="h-4 w-4" /> : (other?.name?.charAt(0)?.toUpperCase() || '?')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 truncate pr-1">{title}</span>
          <div className="ml-2 shrink-0 flex flex-col items-end gap-1">
            {time && <span className="text-[10px] text-slate-400">{time}</span>}
            {!isActive && unreadCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none shadow-sm shadow-rose-200/80">
                {unreadLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isGroup ? (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium border bg-emerald-100 text-emerald-700 border-emerald-200">
              GROUP {conv.participant_count || participants.length + 1}
            </Badge>
          ) : (
            <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-medium border', ROLE_COLORS[other?.role] || 'bg-slate-100 text-slate-600')}>
              {other?.role || 'USER'}
            </Badge>
          )}
          <span className="text-xs text-slate-500 truncate flex-1">
            {lastMsg?.is_deleted ? 'Message deleted' : (lastMsg?.message_text || (lastMsg?.file_name ? '📎 File' : ''))}
          </span>
        </div>
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
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium rounded-lg border-dashed border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700">
          <UserPlus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={8}>
        <div className="p-2.5 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm rounded-lg bg-slate-50 border-slate-200"
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
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-green-50/80 transition-colors text-left"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {u.profile_photo ? <AvatarImage src={u.profile_photo} alt={u.name} /> : null}
                  <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-xs', ROLE_AVATAR_COLORS[u.role] || 'from-slate-400 to-slate-600')}>
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
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

function GroupCreatorDialog({ open, onOpenChange, users, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (userId) => {
    setSelected((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  };

  const resetState = () => {
    setGroupName('');
    setSearch('');
    setSelected([]);
    setSubmitting(false);
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    const finalGroupName = groupName.trim() || 'New Group';
    setSubmitting(true);
    try {
      await onCreate(finalGroupName, selected);
      onOpenChange(false);
      resetState();
    } catch {
      alert('Failed to create group. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) resetState(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <div className="bg-linear-to-r from-green-600 to-emerald-600 px-5 py-4 text-white">
          <DialogTitle className="text-base font-semibold">Create New Group</DialogTitle>
          <p className="text-xs text-emerald-100 mt-1">Pick members and start team chat instantly.</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Group Name</p>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Eg. Site Followups"
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members"
                className="pl-8 h-9 rounded-xl bg-slate-50"
              />
            </div>

            <ScrollArea className="h-60 rounded-xl border border-slate-200">
              <div className="p-2 space-y-1">
                {filtered.map((u) => {
                  const isSelected = selected.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors border',
                        isSelected
                          ? 'border-green-200 bg-green-50/80'
                          : 'border-transparent hover:bg-slate-50'
                      )}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        {u.profile_photo ? <AvatarImage src={u.profile_photo} alt={u.name} /> : null}
                        <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-xs', ROLE_AVATAR_COLORS[u.role] || 'from-slate-400 to-slate-600')}>
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-green-600" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="text-xs text-slate-500">
            {selected.length} member{selected.length === 1 ? '' : 's'} selected
          </div>
        </div>

        <DialogFooter className="px-5 pb-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || selected.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UsersRound className="h-4 w-4 mr-1.5" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Chat ───
export default function Chat() {
  const { user } = useAuth();
  const {
    conversations, activeConversation, setActiveConversation,
    messages, users, permissions, loading, messagesLoading,
    hasMore, typingUsers, unreadCounts,
    loadOlderMessages, startConversation, startGroupConversation, sendMessage: sendMsg,
    sendFile, editMessage, deleteMessage, deleteConversation, emitTyping, markConversationAsRead,
  } = useChat(user);

  const [messageInput, setMessageInput] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteConversationConfirm, setDeleteConversationConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isConversationSwitching, startConversationTransition] = useTransition();
  const messagesEndRef = useRef(null);
  const deferredSidebarSearch = useDeferredValue(sidebarSearch);

  const scrollAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleScroll = useCallback((e) => {
    const t = e.target;
    if (t.scrollTop < 80 && hasMore && !messagesLoading) loadOlderMessages();
    setShowScrollBtn(t.scrollHeight - t.scrollTop - t.clientHeight > 120);
  }, [hasMore, messagesLoading, loadOlderMessages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    const text = messageInput;
    setMessageInput('');
    emitTyping(false);
    await sendMsg(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    emitTyping(true);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File size must be less than 10 MB'); return; }
    setUploading(true);
    try { await sendFile(file); }
    catch { alert('Failed to upload file'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleEdit = (msg) => { setEditingMsg(msg); setEditText(msg.message_text); };

  const handleEditSubmit = async () => {
    if (!editingMsg || !editText.trim()) return;
    try { await editMessage(editingMsg.id, editText.trim()); setEditingMsg(null); setEditText(''); }
    catch { alert('Failed to edit message'); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try { await deleteMessage(deleteConfirm.id); setDeleteConfirm(null); }
    catch { alert('Failed to delete message'); }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConversationConfirm) return;
    try {
      await deleteConversation(deleteConversationConfirm.id);
      setDeleteConversationConfirm(null);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete conversation');
    }
  };

  const handleStartChat = async (userId) => {
    await startConversation(userId);
  };

  const handleCreateGroup = async (name, participantIds) => {
    await startGroupConversation(name, participantIds);
  };

  const filteredConversations = useMemo(() => {
    if (!deferredSidebarSearch.trim()) return conversations;
    const q = deferredSidebarSearch.toLowerCase();
    return conversations.filter(c => {
      if (c.is_group) {
        const groupName = c.group_name?.toLowerCase() || '';
        const participantNames = (c.other_participants || []).map((p) => p.name?.toLowerCase() || '').join(' ');
        return groupName.includes(q) || participantNames.includes(q);
      }
      const other = c.other_participants?.[0];
      return other?.name?.toLowerCase().includes(q) || other?.email?.toLowerCase().includes(q);
    });
  }, [conversations, deferredSidebarSearch]);

  const unreadTotal = useMemo(
    () => Object.values(unreadCounts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0),
    [unreadCounts]
  );

  const typingDisplay = activeConversation && typingUsers[activeConversation.id];
  const activeConversationData = activeConversation
    ? conversations.find(c => c.id === activeConversation.id) || activeConversation
    : null;
  const otherUser = activeConversationData?.other_participants?.[0] || null;
  const isActiveGroup = !!activeConversationData?.is_group;
  const activeTitle = isActiveGroup
    ? (activeConversationData?.group_name || 'Group Chat')
    : (otherUser?.name || 'Chat');

  if (loading) {
    return (
      <div className="flex gap-4 h-[calc(100vh-7rem)]">
        <div className="w-80 shrink-0 space-y-3 p-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_100%_0%,rgba(34,197,94,0.07),transparent_35%),#f8fafc] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Messages</h1>
          <p className="text-sm text-slate-600">Fast team communication with live updates</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {conversations.length} Conversations
          </Badge>
          <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-200">
            {unreadTotal} Unread
          </Badge>
          {isConversationSwitching && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Switching
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ─── Left Sidebar ─── */}
        <Card className="w-84 shrink-0 flex flex-col overflow-hidden border-slate-200/80 bg-white/92 backdrop-blur-sm rounded-3xl shadow-sm">
          <div className="p-4 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide">Conversations</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupDialogOpen(true)}
                  className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                >
                  <UsersRound className="h-3.5 w-3.5" />
                  New Group
                </Button>
                <UserPicker users={users} onSelect={handleStartChat} />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="pl-8 h-9 text-sm rounded-xl bg-slate-50/90 border-slate-200"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2.5 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="h-7 w-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No conversations</p>
                  <p className="text-xs text-slate-400 mt-1">Click "New Chat" to start messaging</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <div key={conv.id} className="group relative">
                    {(() => {
                      const canDeleteConversation = !conv?.is_group || String(conv?.created_by || '') === String(user?.id || '');
                      return (
                        <>
                    <ConversationItem
                      conv={conv}
                      isActive={activeConversation?.id === conv.id}
                      unreadCount={unreadCounts[String(conv.id)] || 0}
                      onClick={() => {
                        startConversationTransition(() => {
                          setActiveConversation(conv);
                          markConversationAsRead(conv.id);
                        });
                      }}
                    />
                    {canDeleteConversation && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteConversationConfirm(conv)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          {conv?.is_group ? 'Delete Group' : 'Delete Chat'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* ─── Right Chat Panel ─── */}
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200/80 bg-white/94 backdrop-blur-sm rounded-3xl shadow-sm">
          {activeConversation ? (
            <>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white/85 backdrop-blur-sm">
                <Avatar className="h-9 w-9">
                  {otherUser?.profile_photo ? <AvatarImage src={otherUser.profile_photo} alt={otherUser.name} /> : null}
                  <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-sm', ROLE_AVATAR_COLORS[otherUser?.role] || 'from-slate-400 to-slate-600')}>
                    {isActiveGroup ? <UsersRound className="h-4 w-4" /> : (otherUser?.name?.charAt(0)?.toUpperCase() || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-slate-800 truncate">{activeTitle}</p>
                  <div className="flex items-center gap-1.5">
                    {!isActiveGroup && otherUser?.role && (
                      <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-3.5 border', ROLE_COLORS[otherUser.role])}>
                        {otherUser.role}
                      </Badge>
                    )}
                    {isActiveGroup && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 border bg-emerald-100 text-emerald-700 border-emerald-200">
                        {(activeConversationData?.participant_count || (activeConversationData?.other_participants?.length || 0) + 1)} members
                      </Badge>
                    )}
                    {typingDisplay && (
                      <span className="text-xs text-green-500 animate-pulse font-medium">typing...</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto px-5 py-4 relative bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,1)),radial-gradient(circle_at_top_left,rgba(16,185,129,0.06),transparent_35%)]"
                onScroll={handleScroll}
                ref={scrollAreaRef}
              >
                {messagesLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-green-400" />
                  </div>
                )}
                {!messagesLoading && hasMore && messages.length > 0 && (
                  <button onClick={loadOlderMessages} className="w-full text-center py-2 text-xs text-green-500 hover:text-green-700 font-medium transition-colors">
                    Load older messages
                  </button>
                )}
                {messages.length === 0 && !messagesLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No messages yet</p>
                    <p className="text-xs text-slate-400 mt-1">Send a message to start the conversation</p>
                  </div>
                )}
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.sender_id === user?.id}
                    permissions={permissions}
                    onEdit={handleEdit}
                    onDelete={(m) => setDeleteConfirm(m)}
                  />
                ))}
                <div ref={messagesEndRef} />

                {showScrollBtn && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-4 h-9 w-9 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all duration-200"
                  >
                    <ArrowDown className="h-4 w-4 text-slate-600" />
                  </button>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.zip,.xlsx,.xls" />
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-9 w-9 rounded-xl shrink-0 text-slate-400 hover:text-green-600 hover:bg-green-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 h-10 text-sm rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageInput.trim()}
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-green-600 hover:bg-green-700 shadow-md shadow-green-200/60 shrink-0 transition-all"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
                <MessageSquare className="h-10 w-10 text-slate-300" />
              </div>
              <p className="text-lg font-semibold text-slate-600">Select a conversation</p>
              <p className="text-sm text-slate-400 mt-1">Choose from existing chats or start a new one</p>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingMsg} onOpenChange={() => setEditingMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditSubmit()}
              placeholder="Edit your message..."
              className="text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMsg(null)} size="sm">Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={!editText.trim()} size="sm">
              <Check className="h-3.5 w-3.5 mr-1.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">Are you sure you want to delete this message? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} size="sm">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} size="sm">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConversationConfirm} onOpenChange={() => setDeleteConversationConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleteConversationConfirm?.is_group ? 'Delete Group' : 'Delete Chat'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            {deleteConversationConfirm?.is_group
              ? 'Are you sure you want to delete this group and all messages? This cannot be undone.'
              : 'Are you sure you want to delete this chat thread and all messages? This cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConversationConfirm(null)} size="sm">Cancel</Button>
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
