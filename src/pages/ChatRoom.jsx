import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChatCtx } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Send, Paperclip, MoreVertical, Pencil, Trash2, FileText,
  Download, Loader2, ArrowDown, ChevronLeft, Check, UsersRound, Lock,
  MessageSquare,
} from 'lucide-react';

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

const getMessageSenderLabel = (msg) => {
  const name = msg?.sender_name || msg?.senderName;
  if (name && String(name).trim()) return String(name).trim();
  const phone = msg?.sender_phone || msg?.senderPhone || msg?.sender_mobile || msg?.senderMobile || msg?.sender_number;
  return phone ? String(phone).trim() : 'Unknown';
};

const isImageFile = (fn) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fn || '');

// ─── File Preview ───
const FilePreview = memo(function FilePreview({ fileUrl, fileName, isOwn }) {
  const isImage = isImageFile(fileName);
  return (
    <div className={cn(
      'mt-2 rounded-xl overflow-hidden shadow-sm',
      isOwn ? 'border border-[#b8deb0]' : 'border border-slate-200/70'
    )}>
      {isImage ? (
        <img src={fileUrl} alt={fileName} className="max-w-[240px] max-h-[200px] object-cover" loading="lazy" />
      ) : (
        <div className={cn('flex items-center gap-3 px-3.5 py-3', isOwn ? 'bg-[#c8f0be]' : 'bg-slate-50')}>
          <div className="h-9 w-9 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
            <p className="text-[11px] text-slate-500">Document</p>
          </div>
        </div>
      )}
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName}
        className={cn(
          'flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors border-t',
          isOwn
            ? 'bg-[#c8f0be] text-emerald-700 hover:bg-[#b8e8ae] border-[#b0d8a8]'
            : 'bg-white text-emerald-700 hover:bg-emerald-50 border-slate-100'
        )}>
        <Download className="h-3 w-3" /> Download
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
        <div className="max-w-[75%] px-3 py-1.5 rounded-xl text-xs italic bg-white/70 text-slate-400 border border-slate-200/60">
          This message was deleted · <span className="text-[9px] opacity-60">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1 group', isOwn ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[80%] relative">
        {!isOwn && (
          <p className="text-[11px] text-slate-400 mb-0.5 ml-3 font-medium">{getMessageSenderLabel(msg)}</p>
        )}
        <div className={cn(
          'px-3 py-2 text-[13.5px] relative shadow-sm',
          isOwn
            ? 'bg-[#dcf8c6] border border-[#c8efb2] text-slate-800 rounded-2xl rounded-br-sm'
            : 'bg-white text-slate-700 border border-slate-200/60 rounded-2xl rounded-bl-sm',
          isPending && 'opacity-60'
        )}>
          {msg.message_text && <p className="whitespace-pre-wrap wrap-break-word leading-snug">{msg.message_text}</p>}
          {msg.file_url && <FilePreview fileUrl={msg.file_url} fileName={msg.file_name} isOwn={isOwn} />}
          <div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
            <span className="text-[10px] text-slate-400">{time}</span>
            {isEdited && <span className="text-[10px] text-slate-400">· edited</span>}
            {isPending && <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400" />}
          </div>
        </div>

        {isOwn && (permissions.can_edit_message || permissions.can_delete_message) && !isPending && (
          <div className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50">
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

// ─── Main ChatRoom Page ───
export default function ChatRoom() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations, activeConversation, setActiveConversation,
    messages, permissions, messagesLoading, hasMore, typingUsers,
    loadOlderMessages, sendMessage: sendMsg, sendFile,
    editMessage, deleteMessage, emitTyping, markConversationAsRead,
  } = useChatCtx();

  const [messageInput, setMessageInput] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Activate the conversation from URL param
  useEffect(() => {
    if (!conversationId || !conversations.length) return;
    const conv = conversations.find(c => String(c.id) === conversationId);
    if (conv) {
      setActiveConversation(conv);
      markConversationAsRead(conv.id);
    }
  }, [conversationId, conversations]);

  // Scroll to bottom on new messages
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

  // Derive conversation info
  const activeConvData = activeConversation
    ? conversations.find(c => c.id === activeConversation.id) || activeConversation
    : null;
  const isGroup = !!activeConvData?.is_group;
  const otherUser = activeConvData?.other_participants?.[0] || null;
  const otherPhone = getParticipantPhone(otherUser);
  const title = isGroup
    ? (activeConvData?.group_name || 'Group Chat')
    : getParticipantDisplayName(otherUser);
  const typing = activeConversation && typingUsers[activeConversation.id];

  // If conversation not found yet, show loading
  if (!activeConvData && !conversations.length) {
    return (
      <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)] flex items-center justify-center bg-[#efeae2]">
        <Loader2 className="h-6 w-6 animate-spin text-[#25d366]" />
      </div>
    );
  }

  if (!activeConvData) {
    return (
      <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)] flex flex-col items-center justify-center bg-[#efeae2]">
        <div className="bg-white/60 rounded-3xl px-8 py-8 flex flex-col items-center gap-3 shadow-sm">
          <MessageSquare className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">Conversation not found</p>
          <button onClick={() => navigate('/chat')} className="text-sm font-semibold text-[#075e54]">← Back to chats</button>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-2 sm:-m-5 md:-m-8 -mb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:-mb-10 h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-[#075e54] px-3 py-2.5 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="h-8 w-8 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-all shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/20">
          {otherUser?.profile_photo ? <AvatarImage src={otherUser.profile_photo} alt={otherUser.name} /> : null}
          <AvatarFallback className={cn(
            'text-white font-bold text-sm',
            isGroup
              ? 'bg-linear-to-br from-green-400 to-emerald-600'
              : ROLE_AVATAR_COLORS[otherUser?.role]
                ? `bg-linear-to-br ${ROLE_AVATAR_COLORS[otherUser.role]}`
                : 'bg-linear-to-br from-slate-400 to-slate-600'
          )}>
            {isGroup ? <UsersRound className="h-4 w-4" /> : (title?.charAt(0)?.toUpperCase() || '?')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold text-white truncate leading-tight">{title}</p>
          <div className="h-4 flex items-center">
            {typing ? (
              <span className="text-[11px] text-[#9debc7] font-medium animate-pulse">typing…</span>
            ) : isGroup ? (
              <span className="text-[11px] text-[#9debc7]/80">
                {(activeConvData?.participant_count || (activeConvData?.other_participants?.length || 0) + 1)} members
              </span>
            ) : otherPhone ? (
              <span className="text-[11px] text-[#9debc7]/80">{otherPhone}</span>
            ) : otherUser?.role ? (
              <span className="text-[11px] text-[#9debc7]/80">{otherUser.role}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 relative"
        style={{ background: '#efeae2' }}
        onScroll={handleScroll}
        ref={scrollRef}
      >
        {messagesLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-[#25d366]" />
          </div>
        )}
        {!messagesLoading && hasMore && messages.length > 0 && (
          <button onClick={loadOlderMessages} className="w-full text-center py-2 text-xs text-[#075e54] hover:text-[#128C7E] font-medium transition-colors">
            Load older messages
          </button>
        )}
        {messages.length === 0 && !messagesLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white/70 rounded-2xl px-5 py-4 flex flex-col items-center gap-2 shadow-sm">
              <Lock className="h-5 w-5 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium text-center">
                Messages are end-to-end encrypted.<br />No messages yet — say hi!
              </p>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.sender_id === user?.id}
            permissions={permissions}
            onEdit={handleEdit}
            onDelete={m => setDeleteConfirm(m)}
          />
        ))}
        <div ref={messagesEndRef} />

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 h-9 w-9 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
          >
            <ArrowDown className="h-4 w-4 text-slate-600" />
          </button>
        )}
      </div>

      {/* Input bar */}
      <div className="px-2.5 py-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-2.5 shrink-0 bg-[#f0f0f0]">
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.zip,.xlsx,.xls" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-10 w-10 rounded-full shrink-0 text-slate-500 hover:text-[#075e54] hover:bg-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Paperclip className="h-4.5 w-4.5" />}
          </button>
          <input
            ref={inputRef}
            value={messageInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="flex-1 h-10 px-4 text-[13.5px] rounded-full bg-white border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all placeholder-slate-400 text-slate-800"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!messageInput.trim()}
            className="h-10 w-10 rounded-full bg-[#25d366] hover:bg-[#1fab5d] text-white shrink-0 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingMsg} onOpenChange={() => setEditingMsg(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="bg-[#075e54] px-5 py-4">
            <DialogTitle className="text-base font-semibold text-white">Edit Message</DialogTitle>
          </div>
          <div className="p-5">
            <Input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEditSubmit()}
              placeholder="Edit your message..."
              className="text-sm rounded-xl h-10"
              autoFocus
            />
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setEditingMsg(null)} size="sm">Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={!editText.trim()} size="sm" className="bg-[#25d366] hover:bg-[#1fab5d] text-white">
              <Check className="h-3.5 w-3.5 mr-1.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Message Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl">
          <div className="bg-[#075e54] px-5 py-4">
            <DialogTitle className="text-base font-semibold text-white">Delete Message</DialogTitle>
          </div>
          <p className="text-sm text-slate-500 px-5 py-4">Are you sure you want to delete this message? This cannot be undone.</p>
          <DialogFooter className="px-5 pb-5">
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
