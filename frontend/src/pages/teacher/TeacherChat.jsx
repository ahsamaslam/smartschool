import React, { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext';
import chatService from '../../services/chatService';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';

export default function TeacherChat() {
  const { user } = useAuth();
  const { unreadCount } = useChatContext();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMode, setBusyMode] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Organize conversations into buckets
  const [conversationBuckets, setConversationBuckets] = useState({
    pending: [],
    active: [],
    restricted: [],
    announcements: [],
    teachers: [],
    admins: [],
  });

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await chatService.listConversations();
      const convs = response.data.data || [];

      // Organize into buckets
      const buckets = {
        pending: [],
        active: [],
        restricted: [],
        announcements: [],
        teachers: [],
        admins: [],
      };

      convs.forEach((conv) => {
        if (conv.status === 'pending') {
          buckets.pending.push(conv);
        } else if (conv.is_restricted) {
          buckets.restricted.push(conv);
        } else if (conv.role === 'teacher') {
          buckets.teachers.push(conv);
        } else if (conv.role === 'admin' || conv.role === 'manager') {
          buckets.admins.push(conv);
        } else {
          buckets.active.push(conv);
        }
      });

      setConversationBuckets(buckets);
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBusyMode = async () => {
    try {
      await chatService.setBusyMode(!busyMode);
      setBusyMode(!busyMode);
    } catch (err) {
      console.error('Failed to toggle busy mode:', err);
    }
  };

  const respondToRequest = async (conversationId, action) => {
    try {
      await chatService.respondToRequest(conversationId, action);
      loadConversations();
    } catch (err) {
      console.error('Failed to respond to request:', err);
    }
  };

  if (loading) return <Spinner />;

  const BucketSection = ({ title, conversations: convs }) => {
    if (convs.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          {title}
          <span className="bg-slate-700 px-3 py-1 rounded-full text-sm font-normal">
            {convs.length}
          </span>
        </h3>
        <div className="space-y-2">
          {convs.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="text-white font-semibold">{conv.full_name}</p>
                  <p className="text-slate-400 text-sm">{conv.last_message_preview || 'No messages'}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold ml-3">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Messages</h1>
          <button
            onClick={toggleBusyMode}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              busyMode
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {busyMode ? 'Not Accepting Requests' : 'Accepting Requests'}
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <BucketSection title="Pending Requests" conversations={conversationBuckets.pending} />
          <BucketSection title="Active Conversations" conversations={conversationBuckets.active} />
          <BucketSection title="Restricted Students" conversations={conversationBuckets.restricted} />
          <BucketSection title="Teachers" conversations={conversationBuckets.teachers} />
          <BucketSection title="Managers & Admins" conversations={conversationBuckets.admins} />

          {conversations.length === 0 && (
            <p className="text-slate-300">No conversations yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
