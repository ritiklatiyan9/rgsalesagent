import { useState, useEffect, useRef, useCallback } from 'react';
import api, { getAccessToken } from '@/lib/axios';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rivergreenbackend.onrender.com';

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
      if (data.success) setConversations(data.conversations);
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
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
      setMessages(prev => {
        const conv = activeConvRef.current;
        if (conv && msg.conversation_id === conv.id) {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      refreshConversations();
    });

    socket.on('chat:messageUpdated', (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    socket.on('chat:messageDeleted', ({ id }) => {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, is_deleted: true, message_text: 'This message was deleted' } : m
      ));
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

  // Load initial data
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    Promise.all([
      api.get('/chat/conversations'),
      api.get('/chat/users'),
      api.get('/chat/my-permissions'),
    ]).then(([convRes, usersRes, permRes]) => {
      if (convRes.data.success) setConversations(convRes.data.conversations);
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
    hasMore, typingUsers,
    loadOlderMessages, startConversation, sendMessage, sendFile,
    editMessage, deleteMessage, emitTyping, refreshConversations,
  };
}
