import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  UserPlus, Users,
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
function FilePreview({ fileUrl, fileName }) {
  const isImage = isImageFile(fileName);
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200/60 bg-white/80 backdrop-blur-sm">
      {isImage ? (
        <img src={fileUrl} alt={fileName} className="max-w-65 max-h-50 object-cover" loading="lazy" />
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
            <p className="text-[11px] text-slate-400">Document</p>
          </div>
        </div>
      )}
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName}
        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50/80 transition-colors border-t border-slate-100">
        <Download className="h-3.5 w-3.5" /> Download
      </a>
    </div>
  );
}

// ─── Message Bubble ───
function MessageBubble({ msg, isOwn, permissions, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isEdited = msg.updated_at && msg.updated_at !== msg.created_at && !msg.is_deleted;
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isPending = msg._pending;

  if (msg.is_deleted) {
    return (
      <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%] px-4 py-2.5 rounded-2xl text-sm italic bg-slate-50 text-slate-400 border border-slate-100">
          <span>This message was deleted</span>
          <span className="block text-[10px] mt-1 opacity-50">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-3 group', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] relative')}>
        {!isOwn && (
          <p className="text-[11px] text-slate-400 mb-0.5 ml-3 font-medium tracking-wide">{msg.sender_name}</p>
        )}
        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm relative transition-all',
          isOwn
            ? 'bg-linear-to-br from-green-500 to-green-600 text-white rounded-br-sm shadow-sm shadow-green-200/50'
            : 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-sm',
          isPending && 'opacity-60'
        )}>
          {msg.message_text && <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{msg.message_text}</p>}
          {msg.file_url && <FilePreview fileUrl={msg.file_url} fileName={msg.file_name} />}
          <div className={cn('flex items-center gap-1.5 mt-1.5', isOwn ? 'justify-end' : 'justify-start')}>
            <span className={cn('text-[10px]', isOwn ? 'text-green-200/80' : 'text-slate-400')}>{time}</span>
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
}

// ─── Conversation Item ───
function ConversationItem({ conv, isActive, onClick }) {
  const other = conv.other_participants?.[0];
  const lastMsg = conv.last_message;
  const time = lastMsg?.created_at
    ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-3 cursor-pointer rounded-xl transition-all duration-200',
        isActive
          ? 'bg-green-50/80 border border-green-100 shadow-sm'
          : 'hover:bg-slate-50/80 border border-transparent'
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        {other?.profile_photo ? <AvatarImage src={other.profile_photo} alt={other.name} /> : null}
        <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-sm', ROLE_AVATAR_COLORS[other?.role] || 'from-slate-400 to-slate-600')}>
          {other?.name?.charAt(0)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 truncate">{other?.name || 'Unknown'}</span>
          {time && <span className="text-[10px] text-slate-400 shrink-0 ml-2">{time}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-medium border', ROLE_COLORS[other?.role] || 'bg-slate-100 text-slate-600')}>
            {other?.role || 'USER'}
          </Badge>
          <span className="text-xs text-slate-400 truncate flex-1">
            {lastMsg?.is_deleted ? 'Message deleted' : (lastMsg?.message_text || (lastMsg?.file_name ? '📎 File' : ''))}
          </span>
        </div>
      </div>
    </div>
  );
}

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

// ─── Main Chat ───
export default function Chat() {
  const { user } = useAuth();
  const {
    conversations, activeConversation, setActiveConversation,
    messages, users, permissions, loading, messagesLoading,
    hasMore, typingUsers,
    loadOlderMessages, startConversation, sendMessage: sendMsg,
    sendFile, editMessage, deleteMessage, emitTyping,
  } = useChat(user);

  const [messageInput, setMessageInput] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
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

  const handleStartChat = async (userId) => {
    await startConversation(userId);
  };

  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter(c => {
      const other = c.other_participants?.[0];
      return other?.name?.toLowerCase().includes(q) || other?.email?.toLowerCase().includes(q);
    });
  }, [conversations, sidebarSearch]);

  const typingDisplay = activeConversation && typingUsers[activeConversation.id];
  const otherUser = activeConversation
    ? conversations.find(c => c.id === activeConversation.id)?.other_participants?.[0]
    : null;

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
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Messages</h1>
          <p className="text-sm text-slate-500">Team communication</p>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ─── Left Sidebar ─── */}
        <Card className="w-80 shrink-0 flex flex-col overflow-hidden border-slate-200/80">
          <div className="p-3 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Conversations</h2>
              <UserPicker users={users} onSelect={handleStartChat} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-slate-50/80 border-slate-200"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
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
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={activeConversation?.id === conv.id}
                    onClick={() => setActiveConversation(conv)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* ─── Right Chat Panel ─── */}
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200/80">
          {activeConversation ? (
            <>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white/80 backdrop-blur-sm">
                <Avatar className="h-9 w-9">
                  {otherUser?.profile_photo ? <AvatarImage src={otherUser.profile_photo} alt={otherUser.name} /> : null}
                  <AvatarFallback className={cn('bg-linear-to-br text-white font-bold text-sm', ROLE_AVATAR_COLORS[otherUser?.role] || 'from-slate-400 to-slate-600')}>
                    {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{otherUser?.name || 'Chat'}</p>
                  <div className="flex items-center gap-1.5">
                    {otherUser?.role && (
                      <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-3.5 border', ROLE_COLORS[otherUser.role])}>
                        {otherUser.role}
                      </Badge>
                    )}
                    {typingDisplay && (
                      <span className="text-xs text-green-500 animate-pulse font-medium">typing...</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto px-5 py-4 relative bg-linear-to-b from-slate-50/30 to-white"
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
                    className="flex-1 h-10 text-sm rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-colors"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageInput.trim()}
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-green-600 hover:bg-green-700 shadow-sm shadow-green-200/50 shrink-0 transition-all"
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
    </div>
  );
}
