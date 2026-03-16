import { useState, useEffect, useRef, useCallback } from 'react';
import api, { getAccessToken } from '@/lib/axios';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rivergreenbackend.onrender.com';

const normalizeConversationId = (value) => (value === null || value === undefined ? null : String(value));

const extractUnreadCount = (conversation) => {
  const raw = conversation?.unread_count ?? conversation?.unreadCount ?? 0;
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const toLastMessagePreview = (msg) => ({
  id: msg?.id,
  message_text: msg?.is_deleted ? 'Message deleted' : (msg?.message_text || null),
  message_type: msg?.message_type || 'text',
  file_name: msg?.file_name || null,
  sender_id: msg?.sender_id,
  created_at: msg?.created_at,
  is_deleted: !!msg?.is_deleted,
});

export function useChat(currentUser) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState({ can_edit_message: false, can_delete_message: false });
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConvRef = useRef(null);

  // Keep ref in sync so socket callbacks always see the latest value
  useEffect(() => {
    activeConvRef.current = activeConversation;
  }, [activeConversation]);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      if (data.success) {
        setConversations(data.conversations);
        setUnreadCounts((prev) => {
          const next = { ...prev };
          for (const conv of data.conversations || []) {
            const convId = normalizeConversationId(conv?.id);
            if (!convId || next[convId]) continue;
            const initialUnread = extractUnreadCount(conv);
            if (initialUnread > 0) next[convId] = initialUnread;
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, []);

  const markConversationAsRead = useCallback((conversationId) => {
    const normalizedId = normalizeConversationId(conversationId);
    if (!normalizedId) return;
    setUnreadCounts((prev) => {
      if (!prev[normalizedId]) return prev;
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
  }, []);

  const updateConversationPreview = useCallback((msg) => {
    const convId = normalizeConversationId(msg?.conversation_id ?? msg?.conversationId);
    if (!convId) return false;

    let found = false;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => normalizeConversationId(c.id) === convId);
      if (idx === -1) return prev;
      found = true;

      const updated = {
        ...prev[idx],
        last_message: toLastMessagePreview(msg),
      };

      if (idx === 0) return [updated, ...prev.slice(1)];
      return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });

    return found;
  }, []);

  // Initialize socket — single registration, uses ref for activeConversation
  useEffect(() => {
    const token = getAccessToken();
    if (!token || !currentUser) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => console.log('Chat socket connected'));

    socket.on('chat:message', (msg) => {
      const messageConversationId = normalizeConversationId(msg?.conversation_id ?? msg?.conversationId);
      const conv = activeConvRef.current;
      const activeConversationId = normalizeConversationId(conv?.id);
      const isActiveConversation = !!activeConversationId && !!messageConversationId && activeConversationId === messageConversationId;
      const isIncoming = msg.sender_id !== currentUser?.id;

      if (isIncoming && !isActiveConversation && messageConversationId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [messageConversationId]: (prev[messageConversationId] || 0) + 1,
        }));
      }

      setMessages(prev => {
        if (isActiveConversation) {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });

      const updatedLocally = updateConversationPreview(msg);
      if (!updatedLocally) {
        refreshConversations();
      }
    });

    socket.on('chat:messageUpdated', (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    socket.on('chat:messageDeleted', ({ id }) => {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, is_deleted: true, message_text: 'This message was deleted' } : m
      ));
    });

    socket.on('chat:conversationDeleted', ({ conversation_id, conversationId }) => {
      const deletedId = normalizeConversationId(conversation_id ?? conversationId);
      if (!deletedId) return;
      setConversations(prev => prev.filter(c => String(c.id) !== deletedId));
      if (normalizeConversationId(activeConvRef.current?.id) === deletedId) {
        setActiveConversation(null);
        setMessages([]);
      }
      setUnreadCounts(prev => {
        if (!prev[deletedId]) return prev;
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
    });

    socket.on('chat:typing', ({ conversationId, userId, userName, isTyping }) => {
      if (userId === currentUser?.id) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        if (isTyping) next[conversationId] = { userId, userName };
        else delete next[conversationId];
        return next;
      });
    });

    socket.on('connect_error', (err) => console.error('Socket error:', err.message));

    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [currentUser?.id, refreshConversations]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    markConversationAsRead(activeConversation.id);
  }, [activeConversation?.id, markConversationAsRead]);

  // Load initial data
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    Promise.all([
      api.get('/chat/conversations'),
      api.get('/chat/users'),
      api.get('/chat/my-permissions'),
    ]).then(([convRes, usersRes, permRes]) => {
      if (convRes.data.success) {
        setConversations(convRes.data.conversations);
        setUnreadCounts((prev) => {
          const next = { ...prev };
          for (const conv of convRes.data.conversations || []) {
            const convId = normalizeConversationId(conv?.id);
            if (!convId || next[convId]) continue;
            const initialUnread = extractUnreadCount(conv);
            if (initialUnread > 0) next[convId] = initialUnread;
          }
          return next;
        });
      }
      if (usersRes.data.success) setUsers(usersRes.data.users);
      if (permRes.data.success && permRes.data.permission) setPermissions(permRes.data.permission);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  // Load messages on conversation change
  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    setMessagesLoading(true);
    setHasMore(true);
    api.get(`/chat/conversations/${activeConversation.id}/messages?limit=30`)
      .then(({ data }) => {
        if (data.success) {
          setMessages(data.messages);
          setHasMore(data.messages.length >= 30);
        }
      })
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }, [activeConversation?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    try {
      const { data } = await api.get(
        `/chat/conversations/${activeConversation.id}/messages?limit=30&before=${oldestId}`
      );
      if (data.success) {
        setMessages(prev => [...data.messages, ...prev]);
        setHasMore(data.messages.length >= 30);
      }
    } catch (err) { console.error(err); }
  }, [activeConversation?.id, hasMore, messages]);

  const startConversation = useCallback(async (userId) => {
    try {
      const { data } = await api.post('/chat/conversations', { userId });
      if (data.success) {
        const convListRes = await api.get('/chat/conversations');
        if (convListRes.data.success) {
          setConversations(convListRes.data.conversations);
          const fullConv = convListRes.data.conversations.find(c => c.id === data.conversation.id);
          setActiveConversation(fullConv || data.conversation);
          return fullConv || data.conversation;
        }
        setActiveConversation(data.conversation);
        return data.conversation;
      }
    } catch (err) { console.error(err); }
  }, []);

  const startGroupConversation = useCallback(async (name, participantIds) => {
    try {
      const { data } = await api.post('/chat/groups', {
        name,
        participantIds,
      });
      if (data.success) {
        const convListRes = await api.get('/chat/conversations');
        if (convListRes.data.success) {
          setConversations(convListRes.data.conversations);
          const fullConv = convListRes.data.conversations.find(c => c.id === data.conversation.id);
          setActiveConversation(fullConv || data.conversation);
          return fullConv || data.conversation;
        }
        setActiveConversation(data.conversation);
        return data.conversation;
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  // Optimistic send
  const sendMessage = useCallback(async (text) => {
    if (!activeConversation || !text?.trim()) return;
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: currentUser?.id,
      sender_name: currentUser?.name || 'You',
      sender_photo: currentUser?.profile_photo || null,
      sender_role: currentUser?.role || '',
      message_text: text.trim(),
      message_type: 'text',
      file_url: null, file_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const { data } = await api.post(`/chat/conversations/${activeConversation.id}/messages`, { message: text.trim() });
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
        refreshConversations();
        return data.message;
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error(err);
    }
  }, [activeConversation?.id, currentUser, refreshConversations]);

  const sendFile = useCallback(async (file, messageText) => {
    if (!activeConversation || !file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (messageText) formData.append('message', messageText);
    try {
      const { data } = await api.post(
        `/chat/conversations/${activeConversation.id}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (data.success) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        refreshConversations();
        return data.message;
      }
    } catch (err) { console.error(err); throw err; }
  }, [activeConversation?.id, refreshConversations]);

  const editMessage = useCallback(async (messageId, newText) => {
    try {
      const { data } = await api.put(`/chat/messages/${messageId}`, { message: newText });
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === messageId ? data.message : m));
        return data.message;
      }
    } catch (err) { console.error(err); throw err; }
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    try {
      const { data } = await api.delete(`/chat/messages/${messageId}`);
      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted: true, message_text: 'This message was deleted' } : m
        ));
      }
    } catch (err) { console.error(err); throw err; }
  }, []);

  const deleteConversation = useCallback(async (conversationId) => {
    if (!conversationId) return;
    const { data } = await api.delete(`/chat/conversations/${conversationId}`);
    if (data?.success) {
      const deletedId = String(conversationId);
      setConversations(prev => prev.filter(c => String(c.id) !== deletedId));
      if (String(activeConversation?.id || '') === deletedId) {
        setActiveConversation(null);
        setMessages([]);
      }
      setUnreadCounts(prev => {
        if (!prev[deletedId]) return prev;
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      return data.result;
    }
    throw new Error(data?.message || 'Failed to delete conversation');
  }, [activeConversation?.id]);

  const emitTyping = useCallback((isTyping) => {
    if (!socketRef.current || !activeConversation) return;
    socketRef.current.emit('chat:typing', { conversationId: activeConversation.id, isTyping });
    if (isTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('chat:typing', { conversationId: activeConversation.id, isTyping: false });
      }, 3000);
    }
  }, [activeConversation?.id]);

  return {
    conversations, activeConversation, setActiveConversation,
    messages, users, permissions, loading, messagesLoading,
    hasMore, typingUsers, unreadCounts,
    loadOlderMessages, startConversation, startGroupConversation, sendMessage, sendFile,
    editMessage, deleteMessage, deleteConversation, emitTyping, refreshConversations,
    markConversationAsRead,
  };
}
