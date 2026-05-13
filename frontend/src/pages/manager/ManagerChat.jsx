import React, { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext';
import chatService from '../../services/chatService';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';

export default function ManagerChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    loadConversations();
  }, []);

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

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">Messages</h1>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">All Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-slate-300">No conversations.</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
