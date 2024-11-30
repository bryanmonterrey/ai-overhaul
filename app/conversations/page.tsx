'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ConversationPreview } from '@/app/core/types/conversation';

export default function ConversationsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'upvoted'>('recent');

  useEffect(() => {
    checkAuth();
    fetchConversations();
  }, [sortBy]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
    }
  };

  const fetchConversations = async () => {
    try {
      // Base query
      let query = supabase
        .from('chat_sessions')
        .select(`
          id,
          started_at,
          chat_messages!chat_messages_session_id_fkey (
            content,
            created_at
          ),
          upvotes,
          message_count
        `);

      // Apply sorting
      if (sortBy === 'recent') {
        query = query.order('started_at', { ascending: false });
      } else {
        query = query.order('upvotes', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedConversations: ConversationPreview[] = data.map(session => ({
        id: session.id,
        timestamp: session.started_at,
        preview: session.chat_messages?.[0]?.content || 'No messages',
        upvotes: session.upvotes || 0,
        messageCount: session.message_count || 0
      }));

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpvote = async (conversationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // First, check if user has already upvoted
      const { data: existingUpvote } = await supabase
        .from('conversation_upvotes')
        .select()
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id)
        .single();

      if (existingUpvote) {
        // Remove upvote
        await supabase
          .from('conversation_upvotes')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', session.user.id);

        // Decrement upvote count
        await supabase.rpc('decrement_upvotes', {
          conversation_id: conversationId
        });
      } else {
        // Add upvote
        await supabase
          .from('conversation_upvotes')
          .insert({
            conversation_id: conversationId,
            user_id: session.user.id
          });

        // Increment upvote count
        await supabase.rpc('increment_upvotes', {
          conversation_id: conversationId
        });
      }

      // Refresh conversations
      await fetchConversations();
    } catch (error) {
      console.error('Error handling upvote:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-green-500 p-4 flex items-center justify-center">
        <div className="text-xl font-mono">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-500 p-4">
      {/* Search Bar */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex gap-2">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-black border border-green-500 p-2 text-green-500 font-mono"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-3xl mx-auto mb-8 flex gap-4 justify-center">
        <button 
          onClick={() => setSortBy('recent')}
          className={`font-mono px-4 py-2 border ${
            sortBy === 'recent' 
              ? 'bg-green-500 text-black border-green-500' 
              : 'border-green-500 text-green-500'
          }`}
        >
          SORT_BY_RECENT
        </button>
        <button 
          onClick={() => setSortBy('upvoted')}
          className={`font-mono px-4 py-2 border ${
            sortBy === 'upvoted' 
              ? 'bg-green-500 text-black border-green-500' 
              : 'border-green-500 text-green-500'
          }`}
        >
          SORT_BY_UPVOTES
        </button>
      </div>

      {/* Conversations List */}
      <div className="max-w-3xl mx-auto space-y-4">
        {filteredConversations.map(conv => (
          <div 
            key={conv.id}
            className="border border-green-500/20 p-4 font-mono"
          >
            <div className="flex justify-between items-start mb-2">
              <Link 
                href={`/conversation/${conv.id}`}
                className="text-green-500 hover:text-green-400 flex-1"
              >
                <h2 className="text-sm opacity-75">
                  {new Date(conv.timestamp).toLocaleString()}
                </h2>
                <p className="mt-2">{conv.preview}</p>
              </Link>
              
              <div className="flex flex-col items-end ml-4">
                <button
                  onClick={() => handleUpvote(conv.id)}
                  className="text-xs border border-green-500/50 px-2 py-1 hover:bg-green-500/10"
                >
                  ↑ {conv.upvotes}
                </button>
                <span className="text-xs mt-2 opacity-75">
                  msgs: {conv.messageCount}
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredConversations.length === 0 && (
          <div className="text-center opacity-75 font-mono">
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
}