// app/interfaces/twitter/components/AutoTweetManager.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/common/Card';
import { Button } from '@/app/components/common/Button';
import { Switch } from '@/app/components/common/Switch';

interface QueuedTweet {
  id: string;
  content: string;
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export default function AutoTweetManager() {
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [queuedTweets, setQueuedTweets] = useState<QueuedTweet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueuedTweets();
  }, []);

  const fetchQueuedTweets = async () => {
    try {
      setError(null);
      const response = await fetch('/api/twitter/queue');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || 'Failed to fetch tweets');
      }
      setQueuedTweets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching queued tweets:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tweets');
      setQueuedTweets([]); // Reset to empty array on error
    }
  };

  const generateTweetBatch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/twitter/queue/generate', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Failed to generate tweets: ${response.statusText}`);
      }
      await fetchQueuedTweets();
    } catch (error) {
      console.error('Error generating tweets:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate tweets');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTweetStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      setError(null);
      const response = await fetch(`/api/twitter/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error(`Failed to update tweet status: ${response.statusText}`);
      }
      await fetchQueuedTweets();
    } catch (error) {
      console.error('Error updating tweet status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const toggleAutoMode = async () => {
    try {
      setError(null);
      const response = await fetch('/api/twitter/queue/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isAutoMode })
      });
      if (!response.ok) {
        throw new Error(`Failed to toggle auto mode: ${response.statusText}`);
      }
      setIsAutoMode(!isAutoMode);
    } catch (error) {
      console.error('Error toggling auto mode:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle auto mode');
    }
  };

  return (
    <Card variant="system" title="AUTO_TWEET_MANAGER">
      <div className="space-y-4">
        {error && (
          <div className="text-red-500 text-xs font-mono p-2 border border-red-500 bg-red-500/10">
            ERROR: {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="font-mono text-xs">
            MODE: {isAutoMode ? 'AUTOMATIC' : 'MANUAL'}
          </div>
          <Switch
            checked={isAutoMode}
            onCheckedChange={toggleAutoMode}
            className="data-[state=checked]:bg-green-500"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="system"
            onClick={generateTweetBatch}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'GENERATING...' : 'GENERATE_BATCH'}
          </Button>
        </div>

        <div className="space-y-2">
          {queuedTweets.map(tweet => (
            <div key={tweet.id} className="p-2 border border-white font-mono text-xs">
              <div className="flex justify-between items-start mb-2">
                <div className="opacity-70">
                  {tweet.style.toUpperCase()}_MODE | {
                    tweet.scheduledFor 
                      ? `SCHEDULED: ${new Date(tweet.scheduledFor).toLocaleString()}`
                      : 'UNSCHEDULED'
                  }
                </div>
                <div className={`
                  px-1 
                  ${tweet.status === 'approved' ? 'text-green-500' : ''}
                  ${tweet.status === 'rejected' ? 'text-red-500' : ''}
                  ${tweet.status === 'pending' ? 'text-yellow-500' : ''}
                `}>
                  {tweet.status.toUpperCase()}
                </div>
              </div>
              
              <div className="mb-2 whitespace-pre-wrap">{tweet.content}</div>
              
              {tweet.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    variant="system"
                    onClick={() => updateTweetStatus(tweet.id, 'approved')}
                    className="flex-1 bg-green-900 hover:bg-green-800"
                  >
                    APPROVE
                  </Button>
                  <Button
                    variant="system"
                    onClick={() => updateTweetStatus(tweet.id, 'rejected')}
                    className="flex-1 bg-red-900 hover:bg-red-800"
                  >
                    REJECT
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}