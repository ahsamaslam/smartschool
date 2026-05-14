import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChatContext } from "../../context/ChatContext";
import chatService from "../../services/chatService";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const ROLE_COLORS = {
  teacher: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
  manager: "bg-purple-100 text-purple-700",
  admin: "bg-orange-100 text-orange-700",
};

function RoleChip({ role }) {
  if (!role) return null;
  const cls = ROLE_COLORS[role] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}
    >
      {role}
    </span>
  );
}

function Avatar({ name, size = "md" }) {
  const sz = size === "lg" ? "w-11 h-11 text-base" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UnifiedChat() {
  const { user } = useAuth();
  const { incomingMessage, wsConnected } = useChatContext();

  // Conversations
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Selected conversation
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Input
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const searchTimerRef = useRef(null);
  const selectedConvRef = useRef(null);

  // Keep ref in sync for use inside callbacks
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  // ── Load conversations ──────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await chatService.listConversations();
      setConversations(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Real-time incoming messages ─────────────────────────────────────────

  useEffect(() => {
    if (!incomingMessage) return;
    const {
      conversation_id,
      message_id,
      sender_id,
      sender_name,
      content,
      created_at,
    } = incomingMessage;

    const current = selectedConvRef.current;

    // Append to open chat if it belongs to the current conversation
    if (current?.id === conversation_id) {
      setMessages((prev) => {
        // Avoid duplicates (send_message also triggers WS back to sender)
        if (prev.some((m) => m.id === message_id)) return prev;
        return [
          ...prev,
          {
            id: message_id,
            conversation_id,
            sender_id,
            content,
            created_at,
            delivery_status: "delivered",
          },
        ];
      });
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }

    // Update conversation list preview + unread badge
    setConversations((prev) => {
      let found = false;
      const updated = prev.map((c) => {
        if (c.id === conversation_id) {
          found = true;
          return {
            ...c,
            last_message_preview: content,
            last_message_at: created_at,
            unread_count:
              current?.id === conversation_id ? 0 : (c.unread_count || 0) + 1,
          };
        }
        return c;
      });

      if (!found) {
        // New conversation appeared — reload the list
        loadConversations();
        return prev;
      }

      return [...updated].sort((a, b) => {
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at) - new Date(a.last_message_at);
      });
    });
  }, [incomingMessage, loadConversations]);

  // ── Search ──────────────────────────────────────────────────────────────

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    clearTimeout(searchTimerRef.current);

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await chatService.searchSchoolMembers(q);
        setSearchResults(res.data?.data || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // ── Open conversation ───────────────────────────────────────────────────

  const openConversation = useCallback(async (conv) => {
    setSelectedConv(conv);
    setMessages([]);
    setLoadingMsgs(true);

    // Clear unread badge immediately on click
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)),
    );

    try {
      const res = await chatService.getMessages(conv.id);
      setMessages(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMsgs(false);
    }

    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }),
      100,
    );
  }, []);

  // ── Start conversation from search ──────────────────────────────────────

  const startConversationWithMember = async (member) => {
    try {
      const res = await chatService.createConversation(member.id);
      const conv = res.data;

      const enriched = {
        ...conv,
        full_name: conv.full_name || member.full_name,
        other_user_id: member.id,
        other_user_role: conv.other_user_role || member.role,
        unread_count: 0,
      };

      setConversations((prev) => {
        if (prev.find((c) => c.id === conv.id)) {
          // Already exists — just move it to the top
          return [enriched, ...prev.filter((c) => c.id !== conv.id)];
        }
        return [enriched, ...prev];
      });

      setSearchQuery("");
      setSearchResults([]);
      await openConversation(enriched);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      alert(err.response?.data?.detail || "Failed to start conversation");
    }
  };

  // ── Send message ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic bubble
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversation_id: selectedConv.id,
        sender_id: user?.id,
        content,
        created_at: new Date().toISOString(),
        delivery_status: "sending",
      },
    ]);
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    try {
      const res = await chatService.sendMessage(selectedConv.id, content);
      const realMsg = res.data?.message;

      setMessages((prev) => {
        // Socket.IO may have already delivered the real message before the
        // HTTP response came back — if so, just drop the temp bubble.
        if (realMsg && prev.some((m) => m.id === realMsg.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        // Otherwise swap the temp bubble for the confirmed message.
        return prev.map((m) =>
          m.id === tempId ? (realMsg ? { ...realMsg } : m) : m,
        );
      });

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === selectedConv.id
            ? {
                ...c,
                last_message_preview: content,
                last_message_at: new Date().toISOString(),
              }
            : c,
        );
        return [...updated].sort((a, b) => {
          if (!a.last_message_at) return 1;
          if (!b.last_message_at) return -1;
          return new Date(b.last_message_at) - new Date(a.last_message_at);
        });
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic bubble and restore input
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      {/* ── LEFT PANEL 30% ── */}
      <div className="w-[30%] min-w-[240px] max-w-[340px] flex flex-col bg-white border-r border-gray-200">
        {/* Header + Search */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Messages</h1>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search people…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 placeholder-gray-400"
            />
            <svg
              className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            /* Search results */
            <>
              {searchLoading && (
                <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">
                  No members found
                </p>
              )}
              {searchResults.map((member) => (
                <button
                  key={member.id}
                  onClick={() => startConversationWithMember(member)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar name={member.full_name} />
                    {member.is_online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {member.full_name}
                    </p>
                    <RoleChip role={member.role} />
                  </div>
                </button>
              ))}
            </>
          ) : (
            /* Conversation list */
            <>
              {loadingConvs && (
                <p className="px-4 py-3 text-sm text-gray-400">Loading…</p>
              )}
              {!loadingConvs && conversations.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-gray-400">
                    No conversations yet
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    Search for someone to start chatting
                  </p>
                </div>
              )}
              {conversations.map((conv) => {
                const isActive = selectedConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                      isActive
                        ? "bg-indigo-50 border-r-2 border-indigo-600"
                        : "hover:bg-gray-50 border-r-2 border-transparent"
                    }`}
                  >
                    <Avatar name={conv.full_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1">
                        <p
                          className={`text-sm truncate ${
                            isActive
                              ? "font-bold text-indigo-900"
                              : "font-semibold text-gray-900"
                          }`}
                        >
                          {conv.full_name}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.last_message_preview || "No messages yet"}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">
                        {conv.unread_count > 9 ? "9+" : conv.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL 70% ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-indigo-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-400">
              Select a conversation
            </p>
            <p className="text-sm text-gray-300 mt-1">
              or search for someone to start messaging
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <Avatar name={selectedConv.full_name} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">
                  {selectedConv.full_name}
                </h2>
                <RoleChip role={selectedConv.other_user_role} />
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-gray-50">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">Loading messages…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isMine
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isMine
                                ? "text-indigo-200 text-right"
                                : "text-gray-400"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isMine && msg.delivery_status === "sending" && (
                              <span className="ml-1 opacity-70">· sending</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 placeholder-gray-400"
                  style={{ maxHeight: "120px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
