import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const useChat = (onMessage, onTyping, onDelivery) => {
  const { authToken } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!authToken) return;

    const url = `${WS_BASE_URL}/api/chat/ws?token=${authToken}`;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Setup ping/pong keep-alive (every 25s)
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);

          if (data.type === 'pong') {
            console.log('✅ Pong received');
          } else if (data.type === 'new_message') {
            console.log('💬 New message:', data);
            onMessage?.(data);
          } else if (data.type === 'typing') {
            onTyping?.(data);
          } else if (data.type === 'typing_stop') {
            onTyping?.({ ...data, type: 'typing_stop' });
          } else if (data.type === 'delivery_receipt') {
            onDelivery?.(data);
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        clearInterval(pingIntervalRef.current);

        // Handle auth expiry (code 4001)
        if (event.code === 4001) {
          console.log('Auth token expired, please refresh');
          return;
        }

        // Exponential backoff: 2s, 4s, 8s, 30s cap
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    }
  }, [authToken, onMessage, onTyping, onDelivery]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pingIntervalRef.current);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const sendTypingStart = useCallback((conversationId) => {
    send({ type: 'typing_start', conversation_id: conversationId });
  }, [send]);

  const sendTypingStop = useCallback((conversationId) => {
    send({ type: 'typing_stop', conversation_id: conversationId });
  }, [send]);

  const markMessageRead = useCallback((messageId) => {
    send({ type: 'mark_read', message_id: messageId });
  }, [send]);

  return {
    isConnected,
    send,
    sendTypingStart,
    sendTypingStop,
    markMessageRead,
  };
};
