import React, { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext';
import chatService from '../../services/chatService';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';

export default function TeacherChat() {
  const { user } = useAuth();
  const { unreadCount, incomingMessage } = useChatContext();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMode, setBusyMode] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Listen for incoming messages via WebSocket
  useEffect(() => {
    if (incomingMessage && selectedConversation) {
      // If the message is for the current conversation, add it to messages
      if (incomingMessage.conversation_id === selectedConversation.id) {
        setMessages((prev) => [...prev, {
          id: incomingMessage.message_id,
          content: incomingMessage.content,
          sender_id: incomingMessage.sender_id,
          created_at: new Date().toISOString(),
        }]);
      }
    }
  }, [incomingMessage, selectedConversation]);

  const loadConversations = async () => {
    try {
      const response = await chatService.listConversations();
      setConversations(response.data.data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await chatService.getMessages(conversationId);
      setMessages(response.data.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    loadMessages(conv.id);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      await chatService.sendMessage(selectedConversation.id, messageInput);
      setMessageInput('');
      await loadMessages(selectedConversation.id);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const acceptRequest = async (conversationId) => {
    try {
      await chatService.respondToRequest(conversationId, 'accept');
      await loadConversations();
      // Reload selected conversation if it's the one being accepted
      if (selectedConversation?.id === conversationId) {
        const updated = conversations.find(c => c.id === conversationId);
        if (updated) {
          setSelectedConversation(updated);
        }
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const rejectRequest = async (conversationId) => {
    try {
      await chatService.respondToRequest(conversationId, 'reject');
      await loadConversations();
      setSelectedConversation(null);
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  if (loading) return <Spinner />;

  // Separate pending and active conversations
  const pendingConversations = conversations.filter(c => c.status === 'pending');
  const activeConversations = conversations.filter(c => c.status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Messages</h1>
          <button
            onClick={() => setBusyMode(!busyMode)}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              busyMode
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {busyMode ? 'Not Accepting Requests' : 'Accepting Requests'}
          </button>
        </div>

        {selectedConversation && (
          <div className="mb-8 p-6 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedConversation.full_name}</h2>
                <p className="text-slate-400 text-sm">
                  Status: <span className={selectedConversation.status === 'pending' ? 'text-yellow-400' : 'text-green-400'}>
                    {selectedConversation.status.toUpperCase()}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                {selectedConversation.status === 'pending' && (
                  <>
                    <button
                      onClick={() => acceptRequest(selectedConversation.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectRequest(selectedConversation.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Messages Display */}
            <div className="h-96 bg-slate-900 rounded-lg p-4 mb-4 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-slate-400 text-center py-20">
                  {selectedConversation.status === 'pending'
                    ? 'Student has sent a request. Accept to start chatting.'
                    : 'No messages yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender_id === user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input - Only show if conversation is active */}
            {selectedConversation.status === 'active' ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !messageInput.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Accept the request to send messages</p>
            )}
          </div>
        )}

        {/* Pending Requests Section */}
        {pendingConversations.length > 0 && (
          <div className="mb-8 p-6 bg-slate-800 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Pending Requests ({pendingConversations.length})</h2>
            <div className="space-y-3">
              {pendingConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 rounded-lg cursor-pointer transition ${
                    selectedConversation?.id === conv.id
                      ? 'bg-yellow-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">{conv.full_name}</p>
                      <p className="text-slate-400 text-sm">{conv.request_message || 'No message'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptRequest(conv.id);
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectRequest(conv.id);
                        }}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Conversations Section */}
        {activeConversations.length > 0 && (
          <div className="p-6 bg-slate-800 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Active Conversations ({activeConversations.length})</h2>
            <div className="space-y-3">
              {activeConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 rounded-lg cursor-pointer transition ${
                    selectedConversation?.id === conv.id
                      ? 'bg-blue-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">{conv.full_name}</p>
                      <p className="text-slate-400 text-sm">{conv.last_message_preview || 'No messages'}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="p-6 bg-slate-800 rounded-lg">
            <p className="text-slate-300">No conversations yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
