import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, useTransition, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
  UserPlus, Users, UsersRound, ChevronLeft,
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

const getParticipantPhone = (participant) => {
  const raw = participant?.phone
    || participant?.phone_number
    || participant?.mobile
    || participant?.mobile_number
    || participant?.whatsapp_number
    || participant?.contact_number
    || participant?.number;
  return raw ? String(raw).trim() : '';
};

const getParticipantDisplayName = (participant) => {
  const name = participant?.name || participant?.contact_name || participant?.lead_name;
  if (name && String(name).trim()) return String(name).trim();
  const phone = getParticipantPhone(participant);
  return phone || 'Unknown';
};

const getMessageSenderLabel = (msg) => {
  const name = msg?.sender_name || msg?.senderName;
  if (name && String(name).trim()) return String(name).trim();
  const phone = msg?.sender_phone || msg?.senderPhone || msg?.sender_mobile || msg?.senderMobile || msg?.sender_number;
  return phone ? String(phone).trim() : 'Unknown';
};

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
      <div className={cn('flex mb-1.5', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[75%] px-3 py-1.5 rounded-xl text-xs italic bg-slate-50 text-slate-400">
          This message was deleted · <span className="text-[9px] opacity-60">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1 group', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] relative')}>
        {!isOwn && (
          <p className="text-[10px] text-slate-400 mb-px ml-2.5 font-medium">{getMessageSenderLabel(msg)}</p>
        )}
        <div className={cn(
          'px-3 py-2 rounded-2xl text-[13px] relative',
          isOwn
            ? 'bg-linear-to-br from-green-500 to-emerald-600 text-white rounded-br-sm shadow-sm shadow-green-200/40'
            : 'bg-white text-slate-700 border border-slate-200/80 rounded-bl-sm',
          isPending && 'opacity-60'
        )}>
          {msg.message_text && <p className="whitespace-pre-wrap wrap-break-word leading-snug">{msg.message_text}</p>}
          {msg.file_url && <FilePreview fileUrl={msg.file_url} fileName={msg.file_name} />}
          <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
            <span className={cn('text-[9px]', isOwn ? 'text-green-100/80' : 'text-slate-400')}>{time}</span>
            {isEdited && <span className={cn('text-[9px]', isOwn ? 'text-green-200/70' : 'text-slate-400')}>· edited</span>}
            {isPending && <Loader2 className="h-2.5 w-2.5 animate-spin text-green-200/70" />}
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

// ─── Conversation Item (compact mobile-first) ───
const ConversationItem = memo(function ConversationItem({ conv, isActive, onClick, unreadCount = 0 }) {
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
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-xl transition-all duration-150',
        isActive
          ? 'bg-linear-to-r from-green-50 to-emerald-50 border border-green-200/80'
          : 'hover:bg-slate-50/80 border border-transparent active:bg-slate-100/60'
      )}
    >
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white shadow-sm">
        {!isGroup && other?.profile_photo ? <AvatarImage src={other.profile_photo} alt={other.name} /> : null}
        <AvatarFallback className={cn(
          'text-white font-bold text-xs',
          isGroup
            ? 'bg-linear-to-br from-green-500 via-emerald-500 to-teal-500'
            : (ROLE_AVATAR_COLORS[other?.role] || 'from-slate-400 to-slate-600')
        )}>
          {isGroup ? <UsersRound className="h-3.5 w-3.5" /> : (otherName?.charAt(0)?.toUpperCase() || '?')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-800 truncate pr-1">{title}</span>
          <div className="ml-1.5 shrink-0 flex items-center gap-1.5">
            {time && <span className="text-[10px] text-slate-400">{time}</span>}
            {!isActive && unreadCount > 0 && (
              <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadLabel}
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-px leading-tight">
          {isGroup && <span className="text-emerald-600 font-medium">Group · </span>}
          {!isGroup && other?.role && <span className={cn('font-medium', other.role === 'ADMIN' ? 'text-orange-500' : other.role === 'TEAM_HEAD' ? 'text-violet-500' : 'text-blue-500')}>{other.role} · </span>}
          {lastMsg?.is_deleted ? 'Message deleted' : (lastMsg?.message_text || (lastMsg?.file_name ? '📎 File' : 'No messages yet'))}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConvId = useRef(searchParams.get('conversation')).current;
  const {
    conversations, activeConversation, setActiveConversation,
    messages, users, permissions, loading, messagesLoading,
    hasMore, typingUsers, unreadCounts,
    loadOlderMessages, startConversation, startGroupConversation, sendMessage: sendMsg,
    sendFile, editMessage, deleteMessage, deleteConversation, emitTyping, markConversationAsRead,
  } = useChat(user, { initialConversationId: deepLinkConvId });

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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 767px)')?.matches || false);
  const [mobilePane, setMobilePane] = useState(() => deepLinkConvId ? 'chat' : 'list');
  const messagesEndRef = useRef(null);
  const deferredSidebarSearch = useDeferredValue(sidebarSearch);

  const scrollAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane('chat');
      return;
    }
    if (activeConversation?.id) {
      setMobilePane('chat');
    } else {
      setMobilePane('list');
    }
  }, [isMobile, activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /* ── Auto-open conversation from URL ?conversation=ID ── */
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (!convId) return;
    // Already resolved (from cache or fresh conversations) — clean the URL
    if (activeConversation && String(activeConversation.id) === convId) {
      setSearchParams({}, { replace: true });
      markConversationAsRead(activeConversation.id);
      return;
    }
    // Cache miss on mount — try again once conversations load from network
    if (conversations.length) {
      const conv = conversations.find(c => String(c.id) === convId);
      if (conv) {
        setActiveConversation(conv);
        markConversationAsRead(conv.id);
        if (isMobile) setMobilePane('chat');
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, conversations, activeConversation?.id]);

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
    const conv = await startConversation(userId);
    if (conv) {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
    }
    if (isMobile) setMobilePane('chat');
  };

  const handleCreateGroup = async (name, participantIds) => {
    const conv = await startGroupConversation(name, participantIds);
    if (conv) {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
    }
    if (isMobile) setMobilePane('chat');
  };

  const openConversation = useCallback((conv) => {
    startConversationTransition(() => {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
    });
    if (isMobile) setMobilePane('chat');
  }, [markConversationAsRead, isMobile]);

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
      const otherName = getParticipantDisplayName(other).toLowerCase();
      const otherPhone = getParticipantPhone(other).toLowerCase();
      return otherName.includes(q) || otherPhone.includes(q) || other?.email?.toLowerCase().includes(q);
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
  const otherUserPhone = getParticipantPhone(otherUser);
  const activeTitle = isActiveGroup
    ? (activeConversationData?.group_name || 'Group Chat')
    : getParticipantDisplayName(otherUser);

  if (loading) {
    return (
      <div className="flex items-center justify-center -m-2 sm:-m-5 md:-m-8 h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          <span className="text-xs text-slate-400 font-medium">Loading chats…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-4rem)] overflow-hidden flex flex-col bg-white sm:bg-slate-50/50">

      <div className="flex gap-0 md:gap-2 flex-1 min-h-0 overflow-hidden md:p-2">
        {/* ─── Left Sidebar ─── */}
        <div className={cn(
          'w-full md:w-80 min-h-0 shrink-0 flex flex-col overflow-hidden bg-white md:border md:border-slate-200/80 md:rounded-2xl md:shadow-sm',
          isMobile && mobilePane === 'chat' && 'hidden'
        )}>
          {/* Sidebar header — compact */}
          <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800 flex-1">Chats</h2>
              {unreadTotal > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadTotal}</span>
              )}
              <button
                type="button"
                onClick={() => setGroupDialogOpen(true)}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-green-50 hover:text-green-600 active:scale-95 transition-all"
              >
                <UsersRound className="h-3.5 w-3.5" />
              </button>
              <UserPicker users={users} onSelect={handleStartChat} />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-slate-50 border-slate-200"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-1.5 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-1.5 space-y-0.5">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-400">No conversations</p>
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
                      onClick={() => openConversation(conv)}
                    />
                    {canDeleteConversation && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center opacity-100 pointer-events-auto md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto"
                        >
                          <MoreVertical className="h-3 w-3 text-slate-400" />
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
        </div>

        {/* ─── Right Chat Panel ─── */}
        <div className={cn(
          'flex-1 w-full min-h-0 flex flex-col overflow-hidden bg-white md:border md:border-slate-200/80 md:rounded-2xl md:shadow-sm',
          isMobile && mobilePane === 'list' && 'hidden'
        )}>
          {activeConversation ? (
            <>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setMobilePane('list')}
                    className="h-7 w-7 rounded-lg text-slate-500 flex items-center justify-center shrink-0 active:bg-slate-100"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <Avatar className="h-8 w-8 shrink-0">
                  {otherUser?.profile_photo ? <AvatarImage src={otherUser.profile_photo} alt={otherUser.name} /> : null}
                  <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-xs', ROLE_AVATAR_COLORS[otherUser?.role] || 'from-slate-400 to-slate-600')}>
                    {isActiveGroup ? <UsersRound className="h-3.5 w-3.5" /> : (activeTitle?.charAt(0)?.toUpperCase() || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{activeTitle}</p>
                  <div className="flex items-center gap-1">
                    {!isActiveGroup && !!otherUserPhone && (
                      <span className="text-[10px] text-slate-500 truncate">{otherUserPhone}</span>
                    )}
                    {!isActiveGroup && otherUser?.role && (
                      <span className={cn('text-[9px] font-medium', otherUser.role === 'ADMIN' ? 'text-orange-500' : otherUser.role === 'TEAM_HEAD' ? 'text-violet-500' : 'text-blue-500')}>
                        · {otherUser.role}
                      </span>
                    )}
                    {isActiveGroup && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        · {(activeConversationData?.participant_count || (activeConversationData?.other_participants?.length || 0) + 1)} members
                      </span>
                    )}
                    {typingDisplay && (
                      <span className="text-[10px] text-green-500 animate-pulse font-medium ml-1">typing…</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2.5 md:px-4 py-2 relative bg-slate-50/30"
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
                    <MessageSquare className="h-8 w-8 text-slate-200 mb-2" />
                    <p className="text-xs font-medium text-slate-400">No messages yet</p>
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
                    className="absolute bottom-16 md:bottom-4 right-4 h-8 w-8 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all"
                  >
                    <ArrowDown className="h-4 w-4 text-slate-600" />
                  </button>
                )}
              </div>

              <div className="px-2 py-1.5 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-1.5 border-t border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-1.5">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.zip,.xlsx,.xls" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-8 w-8 rounded-lg shrink-0 text-slate-400 hover:text-green-600 hover:bg-green-50 flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    className="flex-1 h-8 text-sm rounded-lg bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!messageInput.trim()}
                    className="h-8 w-8 rounded-lg bg-green-600 hover:bg-green-700 text-white shrink-0 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
              <MessageSquare className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a conversation</p>
              {isMobile && (
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-green-600 hover:text-green-700"
                  onClick={() => setMobilePane('list')}
                >
                  ← Back to chats
                </button>
              )}
            </div>
          )}
        </div>
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
