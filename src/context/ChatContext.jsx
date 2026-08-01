import { createContext, useContext } from 'react';

export const ChatCtx = createContext(null);
export const useChatCtx = () => useContext(ChatCtx);
