import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/useChat';
import { ChatCtx } from '@/context/ChatContext';

export default function ChatLayout() {
  const { user } = useAuth();
  const chatState = useChat(user);
  return (
    <ChatCtx.Provider value={chatState}>
      <Outlet />
    </ChatCtx.Provider>
  );
}
