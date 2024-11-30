// app/conversations/page.tsx
import React, { useState } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  timestamp: string;
  preview: string;
  upvotes: number;
}

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);

  return (
    <div className="min-h-screen bg-black text-green-500 p-4">
      {/* Search Bar */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="Search conversations..."
            className="flex-1 bg-black border border-green-500 p-2 text-green-500"
          />
          <button className="bg-gray-700 px-4 py-2">
            Search
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-3xl mx-auto mb-8 flex gap-4 justify-center">
        <button className="bg-green-500 text-black px-4 py-2">
          recent
        </button>
        <button className="bg-gray-700 px-4 py-2">
          most upvoted
        </button>
      </div>

      {/* Conversations List */}
      <div className="max-w-3xl mx-auto space-y-4">
        {conversations.map(conv => (
          <div 
            key={conv.id}
            className="border-b border-green-500/20 pb-4"
          >
            <Link 
              href={`/conversation/${conv.id}`}
              className="text-green-500 hover:text-green-400"
            >
              <h2>conversation {conv.timestamp}</h2>
              <p className="text-sm text-green-500/80">{conv.preview}</p>
              <p className="text-xs">upvotes: {conv.upvotes}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}