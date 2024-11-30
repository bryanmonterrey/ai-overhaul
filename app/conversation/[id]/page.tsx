// app/conversation/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant' | 'simulator';
  content: string;
}

interface ConversationData {
  id: string;
  timestamp: string;
  messages: Message[];
  upvotes: number;
}

export default async function ConversationPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  return (
    <div className="min-h-screen bg-black text-green-500 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/home"
            className="text-green-500 hover:text-green-400"
          >
            return to home
          </Link>
          <h1 className="text-xl mt-4">
            conversation {params.id}
          </h1>
          <p className="text-sm">
            timestamp: {conversation.timestamp}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {conversation.messages.map((msg, i) => (
            <div key={i} className="space-y-2">
              <div className="font-mono">
                {msg.role === 'simulator' && '$ >simulator@zerebro> '}
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Upvote Section */}
        <div className="mt-8">
          <span>upvotes: {conversation.upvotes}</span>
          <button className="ml-4 bg-green-500 text-black px-4 py-1">
            Upvote
          </button>
        </div>
      </div>
    </div>
  );
}