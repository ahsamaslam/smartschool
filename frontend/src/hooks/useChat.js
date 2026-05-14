import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./useAuth";

// In production this is the same origin as the API (nginx proxies /socket.io/)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8000";

export const useChat = (onMessage, onTyping, onDelivery) => {
  const { token: authToken } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep callback refs up-to-date without triggering socket reconnects
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onDeliveryRef = useRef(onDelivery);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);
  useEffect(() => { onDeliveryRef.current = onDelivery; }, [onDelivery]);

  // Only depends on authToken — callbacks are accessed via refs
  const connect = useCallback(() => {
    if (!authToken) return;

    // Tear down any existing connection first
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.IO connect error:", err.message);
      setIsConnected(false);
      // Auth rejected — stop reconnecting so we don't hammer the server
      if (err.message === "auth_failed") {
        console.warn("Socket.IO auth rejected — session expired.");
        socket.disconnect();
      }
    });

    socket.on("new_message", (data) => {
      console.log("💬 Socket.IO new_message:", data);
      onMessageRef.current?.(data);
    });

    socket.on("typing", (data) => {
      onTypingRef.current?.({ ...data, type: "typing" });
    });

    socket.on("typing_stop", (data) => {
      onTypingRef.current?.({ ...data, type: "typing_stop" });
    });

    socket.on("delivery_receipt", (data) => {
      onDeliveryRef.current?.(data);
    });

    socketRef.current = socket;
    socket.connect();
  }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((eventName, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(eventName, data);
    } else {
      console.warn("Socket.IO not connected — event dropped:", eventName);
    }
  }, []);

  const sendTypingStart = useCallback(
    (conversationId) => {
      send("typing_start", { conversation_id: conversationId });
    },
    [send],
  );

  const sendTypingStop = useCallback(
    (conversationId) => {
      send("typing_stop", { conversation_id: conversationId });
    },
    [send],
  );

  const markMessageRead = useCallback(
    (messageId) => {
      send("mark_read", { message_id: messageId });
    },
    [send],
  );

  return {
    isConnected,
    send,
    sendTypingStart,
    sendTypingStop,
    markMessageRead,
  };
};
