// src/app/interfaces/twitter/components/TweetComposer.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '@/app/components/common/Card';
import { Input } from '@/app/components/common/Input';
import { Button } from '@/app/components/common/Button';
import { TweetStyle } from '@/core/types';

interface TweetComposerProps {
  onTweet: (content: string, style: TweetStyle) => Promise<void>;
  currentStyle: TweetStyle;
  isLoading?: boolean;
}

export default function TweetComposer({ 
  onTweet, 
  currentStyle, 
  isLoading 
}: TweetComposerProps) {
  const [content, setContent] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<TweetStyle>(currentStyle);

  const charCount = content.length;
  const maxChars = 280;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isLoading) {
      await onTweet(content.trim(), selectedStyle);
      setContent('');
    }
  };

  return (
    <Card variant="system" title="TWEET_COMPOSER">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>style: {selectedStyle}</span>
            <span>chars: {charCount}/{maxChars}</span>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={maxChars}
            rows={3}
            className="w-full bg-[#11111A] text-white border border-white p-2 font-mono text-sm resize-none focus:outline-none focus:border-white"
            placeholder="Initialize tweet sequence..."
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
            type="submit"
            disabled={isLoading || !content.trim()}
            className="flex-1"
          >
            {isLoading ? 'DEPLOYING...' : 'EXECUTE_TWEET'}
          </Button>
        </div>
      </form>
    </Card>
  );
}