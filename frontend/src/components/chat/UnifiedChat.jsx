import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChatContext } from "../../context/ChatContext";
import chatService from "../../services/chatService";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "");

// ─── Emoji set ───────────────────────────────────────────────────────────────
const EMOJI_LIST = [
  "😊","😂","😍","🥺","😎","🙏","😅","😢","😡","😭",
  "🤔","😴","🤗","😇","🥳","😬","🤩","😏","🙄","😤",
  "👍","👎","👏","🤝","✌️","🤞","👋","🤜","💪","🫶",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️",
  "🔥","✅","❌","⭐","🎉","🎊","🎁","🏆","📚","✏️",
  "📝","📌","🔔","💡","🚀","⚡","🌟","💯","🙌","👀",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const ROLE_COLORS = {
  teacher: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
  manager: "bg-purple-100 text-purple-700",
  admin: "bg-orange-100 text-orange-700",
  super_admin: "bg-red-100 text-red-700",
};

function RoleChip({ role }) {
  if (!role) return null;
  const cls = ROLE_COLORS[role] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {role.replace("_", " ")}
    </span>
  );
}

function Avatar({ name, size = "md" }) {
  const sz = size === "lg" ? "w-11 h-11 text-base" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnifiedChat() {
  const { user } = useAuth();
  const { incomingMessage, wsConnected } = useChatContext();

  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "people"

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const searchTimerRef = useRef(null);
  const selectedConvRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiRef = useRef(null);

  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

  // Close emoji panel when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await chatService.listConversations();
      // Deduplicate by conversation id
      const raw = res.data?.data || [];
      const seen = new Set();
      const deduped = raw.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
      setConversations(deduped);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Load eligible contacts ────────────────────────────────────────────────
  useEffect(() => {
    chatService.getEligibleContacts()
      .then((res) => setSuggestedGroups(res.data?.groups || []))
      .catch(() => {});
  }, [user?.id]);

  // ── Real-time incoming messages ───────────────────────────────────────────
  useEffect(() => {
    if (!incomingMessage) return;
    const { conversation_id, message_id, sender_id, content, created_at } = incomingMessage;
    const current = selectedConvRef.current;

    if (current?.id === conversation_id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message_id)) return prev;
        return [...prev, { id: message_id, conversation_id, sender_id, content, created_at, delivery_status: "delivered" }];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }

    setConversations((prev) => {
      let found = false;
      const updated = prev.map((c) => {
        if (c.id === conversation_id) {
          found = true;
          return { ...c, last_message_preview: content, last_message_at: created_at,
            unread_count: current?.id === conversation_id ? 0 : (c.unread_count || 0) + 1 };
        }
        return c;
      });
      if (!found) { loadConversations(); return prev; }
      return [...updated].sort((a, b) => {
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at) - new Date(a.last_message_at);
      });
    });
  }, [incomingMessage, loadConversations]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await chatService.searchSchoolMembers(q);
        setSearchResults(res.data?.data || []);
      } catch (err) { console.error("Search failed:", err); }
      finally { setSearchLoading(false); }
    }, 300);
  };

  // ── Open conversation ─────────────────────────────────────────────────────
  const openConversation = useCallback(async (conv) => {
    setSelectedConv(conv);
    setMessages([]);
    setLoadingMsgs(true);
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    try {
      const res = await chatService.getMessages(conv.id);
      setMessages(res.data?.data || []);
    } catch (err) { console.error("Failed to load messages:", err); }
    finally { setLoadingMsgs(false); }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
  }, []);

  // ── Start conversation from contact/search ────────────────────────────────
  const startConversationWithMember = async (member) => {
    // If a conversation with this person already exists locally, just open it
    const alreadyExists = conversations.find(
      (c) => c.other_user_id === member.id ||
             c.participant_a_id === member.id ||
             c.participant_b_id === member.id
    );
    if (alreadyExists) {
      setSearchQuery(""); setSearchResults([]);
      await openConversation(alreadyExists);
      return;
    }

    try {
      const res = await chatService.createConversation(member.id, "");
      const conv = res.data;
      const enriched = { ...conv, full_name: conv.full_name || member.full_name,
        other_user_id: member.id, other_user_role: conv.other_user_role || member.role, unread_count: 0 };
      setConversations((prev) => {
        if (prev.find((c) => c.id === conv.id)) return [enriched, ...prev.filter((c) => c.id !== conv.id)];
        return [enriched, ...prev];
      });
      setSearchQuery(""); setSearchResults([]);
      await openConversation(enriched);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      alert(err.response?.data?.detail || "Failed to start conversation");
    }
  };

  // ── Respond to request (teacher accepting/rejecting student) ─────────────
  const respondToRequest = async (action) => {
    if (!selectedConv) return;
    try {
      await chatService.respondToRequest(selectedConv.id, action);
      if (action === "accept") {
        const updated = { ...selectedConv, status: "active" };
        setSelectedConv(updated);
        setConversations((prev) => prev.map((c) => c.id === selectedConv.id ? updated : c));
      } else {
        setSelectedConv(null);
        setConversations((prev) => prev.filter((c) => c.id !== selectedConv.id));
      }
    } catch (err) {
      console.error("Failed to respond to request:", err);
      alert(err.response?.data?.detail || "Failed to respond");
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || sending) return;
    const content = input.trim();
    setInput(""); setSending(true); setShowEmoji(false);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, conversation_id: selectedConv.id,
      sender_id: user?.id, content, created_at: new Date().toISOString(), delivery_status: "sending" }]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await chatService.sendMessage(selectedConv.id, content);
      const realMsg = res.data?.message;
      setMessages((prev) => {
        if (realMsg && prev.some((m) => m.id === realMsg.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => m.id === tempId ? (realMsg ? { ...realMsg } : m) : m);
      });
      setConversations((prev) => {
        const updated = prev.map((c) => c.id === selectedConv.id
          ? { ...c, last_message_preview: content, last_message_at: new Date().toISOString() } : c);
        return [...updated].sort((a, b) => {
          if (!a.last_message_at) return 1;
          if (!b.last_message_at) return -1;
          return new Date(b.last_message_at) - new Date(a.last_message_at);
        });
      });
      // If this was a pending convo where student just sent first message, keep status as pending
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
    } finally { setSending(false); }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;
    e.target.value = "";

    const MAX_IMAGE = 5 * 1024 * 1024;
    const MAX_DOC = 20 * 1024 * 1024;
    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? MAX_IMAGE : MAX_DOC;
    if (file.size > maxSize) {
      alert(`File too large. Max ${isImage ? "5MB for images" : "20MB for documents"}.`);
      return;
    }

    setUploading(true);
    try {
      const res = await chatService.uploadFile(selectedConv.id, file);
      const msg = res.data?.message;
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        // Reload messages to show the file
        const msgsRes = await chatService.getMessages(selectedConv.id);
        setMessages(msgsRes.data?.data || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert(err.response?.data?.detail || "File upload failed");
    } finally { setUploading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Pending state helpers ─────────────────────────────────────────────────
  const isPending = selectedConv?.status === "pending";
  const iAmInitiator = selectedConv?.initiator_id === user?.id;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="w-[30%] min-w-[240px] max-w-[340px] flex flex-col bg-white border-r border-gray-200">
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Messages</h1>
          <div className="relative">
            <input type="text" value={searchQuery} onChange={handleSearchChange}
              placeholder="Search people…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 placeholder-gray-400" />
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>

        {/* Tab switcher — hidden when searching */}
        {!searchQuery && (
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
            <button onClick={() => setActiveTab("chats")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "chats" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}>
              Chats{conversations.length > 0 ? ` (${conversations.length})` : ""}
            </button>
            <button onClick={() => setActiveTab("people")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "people" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}>
              People
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            /* ── Search results ── */
            <>
              {searchLoading && <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>}
              {!searchLoading && searchResults.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">No members found</p>
              )}
              {searchResults.map((member) => (
                <button key={member.id} onClick={() => startConversationWithMember(member)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left">
                  <div className="relative flex-shrink-0">
                    <Avatar name={member.full_name} />
                    {member.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                    <RoleChip role={member.role} />
                  </div>
                </button>
              ))}
            </>
          ) : activeTab === "chats" ? (
            /* ── Chats tab ── */
            <>
              {loadingConvs && <p className="px-4 py-3 text-sm text-gray-400">Loading…</p>}
              {!loadingConvs && conversations.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-gray-400">No conversations yet</p>
                  <p className="text-xs text-gray-300 mt-1">Go to People tab to start chatting</p>
                </div>
              )}
              {conversations.map((conv) => {
                const isActive = selectedConv?.id === conv.id;
                const isPendingConv = conv.status === "pending";
                const iInitiated = conv.initiator_id === user?.id;
                return (
                  <button key={conv.id} onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                      isActive ? "bg-indigo-50 border-r-2 border-indigo-600" : "hover:bg-gray-50 border-r-2 border-transparent"
                    }`}>
                    <Avatar name={conv.full_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1">
                        <p className={`text-sm truncate ${isActive ? "font-bold text-indigo-900" : "font-semibold text-gray-900"}`}>
                          {conv.full_name}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isPendingConv ? (
                          iInitiated
                            ? <span className="text-xs text-amber-600 font-medium">Pending…</span>
                            : <span className="text-xs text-indigo-600 font-medium">Respond</span>
                        ) : (
                          <p className="text-xs text-gray-500 truncate">{conv.last_message_preview || "No messages yet"}</p>
                        )}
                      </div>
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
          ) : (
            /* ── People tab ── */
            <>
              {suggestedGroups.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-gray-400">No contacts available</p>
                </div>
              )}
              {suggestedGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 border-t border-gray-100 first:border-0">
                    {group.label}
                  </p>
                  {group.members.map((m) => (
                    <button key={m.id} onClick={() => { startConversationWithMember(m); setActiveTab("chats"); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-indigo-50 transition-colors text-left">
                      <div className="relative flex-shrink-0">
                        <Avatar name={m.full_name} />
                        {m.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.full_name}</p>
                        <RoleChip role={m.role} />
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-400">Select a conversation</p>
            <p className="text-sm text-gray-300 mt-1">or search for someone to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <Avatar name={selectedConv.full_name} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{selectedConv.full_name}</h2>
                <RoleChip role={selectedConv.other_user_role} />
              </div>
              {isPending && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {iAmInitiator ? "Waiting for acceptance" : "Request pending"}
                </span>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-gray-50">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">Loading messages…</p>
                </div>
              ) : messages.length === 0 && isPending && iAmInitiator ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-sm text-amber-700 font-medium">Request sent to {selectedConv.full_name}</p>
                    <p className="text-xs text-gray-400 mt-1">They will be notified. You can chat once they accept.</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    const hasFile = msg.file_url;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                          isMine ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                        }`}>
                          {hasFile ? (
                            <a href={`${API_BASE}${msg.file_url}`} target="_blank" rel="noopener noreferrer"
                              download={msg.file_name || "attachment"}
                              className={`flex items-center gap-2 underline ${isMine ? "text-indigo-100" : "text-indigo-600"}`}>
                              <span>📎</span>
                              <span className="truncate max-w-[180px]">{msg.file_name || "Attachment"}</span>
                            </a>
                          ) : (
                            <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          <p className={`text-xs mt-1 ${isMine ? "text-indigo-200 text-right" : "text-gray-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {isMine && msg.delivery_status === "sending" && <span className="ml-1 opacity-70">· sending</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            {isPending && !iAmInitiator ? (
              /* Teacher sees Accept/Decline */
              <div className="px-4 py-4 bg-white border-t border-gray-200 flex flex-col items-center gap-2">
                <p className="text-sm text-gray-600 font-medium">
                  {selectedConv.full_name} wants to start a conversation
                </p>
                {selectedConv.request_message && (
                  <p className="text-xs text-gray-400 italic">"{selectedConv.request_message}"</p>
                )}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => respondToRequest("accept")}
                    className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
                    Accept
                  </button>
                  <button onClick={() => respondToRequest("reject")}
                    className="px-5 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors">
                    Decline
                  </button>
                </div>
              </div>
            ) : isPending && iAmInitiator ? (
              /* Student waiting for acceptance */
              <div className="px-4 py-4 bg-amber-50 border-t border-amber-100 text-center">
                <p className="text-sm text-amber-700 font-medium">
                  Waiting for {selectedConv.full_name} to accept your request
                </p>
              </div>
            ) : (
              /* Normal input bar */
              <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
                <div className="flex items-end gap-2">
                  {/* Emoji button */}
                  <div className="relative flex-shrink-0" ref={emojiRef}>
                    <button type="button" onClick={() => setShowEmoji((v) => !v)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-lg leading-none"
                      title="Emoji">
                      😊
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-10 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-64">
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJI_LIST.map((em) => (
                            <button key={em} type="button"
                              onClick={() => setInput((v) => v + em)}
                              className="text-xl hover:bg-gray-100 rounded p-0.5 transition-colors leading-none">
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File upload button */}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50"
                    title="Attach file">
                    {uploading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
                    onChange={handleFileSelect} />

                  <textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send)"
                    rows={1}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 placeholder-gray-400"
                    style={{ maxHeight: "120px" }} />

                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex-shrink-0">
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
