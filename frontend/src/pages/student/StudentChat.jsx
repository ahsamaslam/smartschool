import React, { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext';
import chatService from '../../services/chatService';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';

export default function StudentChat() {
  const { user } = useAuth();
  const { unreadCount } = useChatContext();
  const [conversations, setConversations] = useState([]);
  const [eligibleTeachers, setEligibleTeachers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversation, setSelectedConversation] = useState(null);

  const loadConversations = async () => {
    try {
      const response = await chatService.listConversations();
      setConversations(response.data.data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadEligibleTeachers = async () => {
    try {
      const response = await chatService.getEligibleTeachers();
      console.log('Eligible teachers response:', response);
      console.log('Teachers data:', response.data);
      console.log('Teachers array:', response.data.data);
      setEligibleTeachers(response.data.data || []);
      console.log('State updated with teachers:', response.data.data);
    } catch (err) {
      console.error('Failed to load eligible teachers:', err);
      console.error('Error response:', err.response?.data);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await chatService.listAnnouncements();
      setAnnouncements(response.data.data || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    loadEligibleTeachers();
    loadAnnouncements();
  }, []);

  const startNewChat = async (teacherId) => {
    try {
      const response = await chatService.createConversation(teacherId);
      setSelectedConversation(response.data);
      loadConversations();
      setActiveTab('conversations');
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">Messages</h1>

        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'conversations'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Conversations
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'teachers'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Teachers ({eligibleTeachers.length})
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'announcements'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Announcements ({announcements.length})
          </button>
        </div>

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Your Conversations</h2>
            {conversations.length === 0 ? (
              <p className="text-slate-300">No conversations yet. Start by contacting a teacher.</p>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className="p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition"
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
            )}
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Start a New Chat</h2>
            {eligibleTeachers.length === 0 ? (
              <p className="text-slate-300">No teachers available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibleTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="p-4 bg-slate-700 rounded-lg"
                  >
                    <p className="text-white font-semibold mb-2">{teacher.full_name}</p>
                    <p className="text-slate-400 text-sm mb-4">{teacher.email}</p>
                    {teacher.busy ? (
                      <button
                        disabled
                        className="w-full bg-slate-600 text-slate-400 py-2 rounded-lg cursor-not-allowed"
                      >
                        Not Accepting Requests
                      </button>
                    ) : (
                      <button
                        onClick={() => startNewChat(teacher.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold"
                      >
                        Message
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-slate-300">No announcements.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-lg ${
                      ann.priority === 'urgent'
                        ? 'bg-red-900 border-2 border-red-600'
                        : ann.priority === 'important'
                        ? 'bg-yellow-900 border-2 border-yellow-600'
                        : 'bg-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-semibold">{ann.title}</h3>
                      {ann.priority !== 'normal' && (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          ann.priority === 'urgent' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                        }`}>
                          {ann.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mb-2">{ann.content}</p>
                    <p className="text-slate-400 text-sm">From: {ann.teacher_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
