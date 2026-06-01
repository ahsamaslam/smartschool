import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import chatService from "../services/chatService";
import { useChat } from "../hooks/useChat";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [incomingMessage, setIncomingMessage] = useState(null);
  // typingState: { [conversationId]: boolean }
  const [typingState, setTypingState] = useState({});
  const typingTimers = useRef({});

  // ── Refresh unread badge count from server ──────────────────────────────
  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data } = await chatService.getUnreadCount();
      // API returns { message_count, total } or { unread_messages, pending_requests }
      setUnreadCount(data.unread_messages ?? data.message_count ?? data.total ?? 0);
      setPendingRequestCount(data.pending_requests ?? 0);
    } catch {
      // Best-effort — badge will self-heal on next refresh
    }
  }, []);

  // ── Socket callbacks (stable via refs inside useChat) ───────────────────
  const handleIncomingMessage = useCallback((data) => {
    setIncomingMessage(data);
    setUnreadCount((prev) => prev + 1);
  }, []);

  const handleTyping = useCallback((data) => {
    const convId = data.conversation_id;
    const isTyping = data.type === "typing";

    setTypingState((prev) => ({ ...prev, [convId]: isTyping }));

    // Auto-clear typing indicator after 5 s
    if (isTyping) {
      clearTimeout(typingTimers.current[convId]);
      typingTimers.current[convId] = setTimeout(() => {
        setTypingState((prev) => ({ ...prev, [convId]: false }));
      }, 5000);
    } else {
      clearTimeout(typingTimers.current[convId]);
    }
  }, []);

  const handleDelivery = useCallback(() => {
    // Delivery receipts — consumers can subscribe via incomingMessage
  }, []);

  const {
    isConnected,
    send,
    sendTypingStart,
    sendTypingStop,
    markMessageRead,
  } = useChat(handleIncomingMessage, handleTyping, handleDelivery);

  // ── Initial unread count fetch when token is available ──────────────────
  useEffect(() => {
    if (token) {
      refreshUnreadCount();
    }
  }, [token, refreshUnreadCount]);

  // ── Polling fallback: refresh unread badge every 20 s when socket is down ──
  useEffect(() => {
    if (isConnected || !token) return;
    const interval = setInterval(refreshUnreadCount, 20_000);
    return () => clearInterval(interval);
  }, [isConnected, token, refreshUnreadCount]);

  const value = {
    unreadCount,
    setUnreadCount,
    pendingRequestCount,
    setPendingRequestCount,
    incomingMessage,
    setIncomingMessage,
    typingState,
    wsConnected: isConnected,
    refreshUnreadCount,
    send,
    sendTypingStart,
    sendTypingStop,
    markMessageRead,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

const FALLBACK_CONTEXT = {
  unreadCount: 0,
  setUnreadCount: () => {},
  pendingRequestCount: 0,
  setPendingRequestCount: () => {},
  incomingMessage: null,
  setIncomingMessage: () => {},
  typingState: {},
  wsConnected: false,
  refreshUnreadCount: async () => {},
  send: () => {},
  sendTypingStart: () => {},
  sendTypingStop: () => {},
  markMessageRead: () => {},
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    console.warn("useChatContext called outside ChatProvider — using fallback");
    return FALLBACK_CONTEXT;
  }
  return ctx;
};
