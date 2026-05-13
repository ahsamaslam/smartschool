import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import chatService from '../services/chatService';
import { useChat } from '../hooks/useChat';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [typingState, setTypingState] = useState({}); // { conversationId: { userId: true } }
  const [wsConnected, setWsConnected] = useState(false);

  // Refresh unread count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await chatService.getUnreadCount();
      setUnreadCount(response.data.total);
    } catch (err) {
      console.error('Failed to refresh unread count:', err);
    }
  }, []);

  // WebSocket message handlers
  const handleIncomingMessage = useCallback((data) => {
    setIncomingMessage(data);
    // Increment unread count
    setUnreadCount((prev) => prev + 1);
  }, []);

  const handleTyping = useCallback((data) => {
    if (data.type === 'typing') {
      setTypingState((prev) => ({
        ...prev,
        [data.conversation_id]: {
          ...(prev[data.conversation_id] || {}),
          [data.user_id]: true,
        },
      }));

      // Auto-clear after 5 seconds
      setTimeout(() => {
        setTypingState((prev) => {
          const updated = { ...prev };
          if (updated[data.conversation_id]) {
            const conversationTyping = { ...updated[data.conversation_id] };
            delete conversationTyping[data.user_id];
            if (Object.keys(conversationTyping).length === 0) {
              delete updated[data.conversation_id];
            } else {
              updated[data.conversation_id] = conversationTyping;
            }
          }
          return updated;
        });
      }, 5000);
    } else if (data.type === 'typing_stop') {
      setTypingState((prev) => {
        const updated = { ...prev };
        if (updated[data.conversation_id]) {
          const conversationTyping = { ...updated[data.conversation_id] };
          delete conversationTyping[data.user_id];
          if (Object.keys(conversationTyping).length === 0) {
            delete updated[data.conversation_id];
          } else {
            updated[data.conversation_id] = conversationTyping;
          }
        }
        return updated;
      });
    }
  }, []);

  const handleDelivery = useCallback((data) => {
    // Delivery receipt handling (if needed)
  }, []);

  // Setup WebSocket
  const { isConnected } = useChat(
    handleIncomingMessage,
    handleTyping,
    handleDelivery
  );

  useEffect(() => {
    setWsConnected(isConnected);
  }, [isConnected]);

  // Initial load of unread count
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const value = {
    unreadCount,
    setUnreadCount,
    pendingRequestCount,
    setPendingRequestCount,
    incomingMessage,
    setIncomingMessage,
    typingState,
    wsConnected,
    refreshUnreadCount,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
