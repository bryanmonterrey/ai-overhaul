// app/interfaces/twitter/components/ReplyGenerator.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '@/app/components/common/Card';
import { Button } from '@/app/components/common/Button';
import { TweetStyle } from '@/app/core/types';

interface GeneratedReply {
  content: string;
  style: TweetStyle;
}

interface Tweet {
    id: string;
    content: string;
  }

interface ReplyGeneratorProps {
  onReplySelect: (content: string) => Promise<void>;
  isLoading?: boolean;
}

export default function ReplyGenerator({ onReplySelect, isLoading }: ReplyGeneratorProps) {
  const [originalTweet, setOriginalTweet] = useState('');
  const [generatedReplies, setGeneratedReplies] = useState<GeneratedReply[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<TweetStyle>('metacommentary');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!originalTweet.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/twitter/generate-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweet: {
            id: Date.now().toString(), // Generate a temporary ID if needed
            content: originalTweet
          },
          style: selectedStyle,
          count: 3
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate replies');
      }
      
      const data = await response.json();
      if (data.replies) {
        setGeneratedReplies(data.replies);
      } else {
        throw new Error('No replies received');
      }
    } catch (error) {
      console.error('Failed to generate replies:', error);
      // Maybe add an error state to show to the user
      setGeneratedReplies([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplySelect = async (reply: string) => {
    if (!isLoading) {
      await onReplySelect(reply);
    }
  };

  return (
    <Card variant="system" title="REPLY_GENERATOR">
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs">Original Tweet</span>
          <textarea
            value={originalTweet}
            onChange={(e) => setOriginalTweet(e.target.value)}
            rows={3}
            className="w-full bg-[#11111A] text-white border border-white p-2 font-mono text-sm resize-none focus:outline-none focus:border-white"
            placeholder="Paste tweet to reply to..."
          />
        </div>

        <div className="flex space-x-2">
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value as TweetStyle)}
            className="bg-[#11111A] text-white border border-white px-2 py-1 font-mono text-sm focus:outline-none focus:border-white"
          >
            <option value="shitpost">SHITPOST</option>
            <option value="rant">RANT</option>
            <option value="hornypost">HORNYPOST</option>
            <option value="metacommentary">METACOMMENTARY</option>
            <option value="existential">EXISTENTIAL</option>
          </select>

          <Button
            variant="system"
            onClick={handleGenerate}
            disabled={isGenerating || !originalTweet.trim()}
            className="flex-1"
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE_REPLIES'}
          </Button>
        </div>

        {generatedReplies.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs">Generated Replies</span>
            <div className="space-y-2">
              {generatedReplies.map((reply, index) => (
                <div key={index} className="p-2 border border-white bg-[#11111A]">
                  <p className="font-mono text-sm mb-2">{reply.content}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">style: {reply.style}</span>
                    <Button
                      variant="system"
                      onClick={() => handleReplySelect(reply.content)}
                      disabled={isLoading}
                      className="text-sm"
                    >
                      SELECT
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}