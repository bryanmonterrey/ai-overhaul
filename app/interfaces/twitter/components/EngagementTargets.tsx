// app/interfaces/twitter/components/EngagementTargets.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/common/Card';
import { Button } from '@/app/components/common/Button';
import { Input } from '@/app/components/common/Input';
import type { EngagementTargetRow } from '@/app/types/supabase';
import type { TweetStyle } from '@/app/core/personality/types';

export default function EngagementTargets() {
  const [targets, setTargets] = useState<EngagementTargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTarget, setNewTarget] = useState({
    username: '',
    topics: '',
    replyProbability: 50,
    preferredStyle: 'casual' as TweetStyle
  });

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await fetch('/api/twitter/targets');
      const data = await response.json();
      setTargets(data);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTarget = async () => {
    try {
      const response = await fetch('/api/twitter/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newTarget.username,
          topics: newTarget.topics.split(',').map(t => t.trim()),
          replyProbability: newTarget.replyProbability / 100,
          preferredStyle: newTarget.preferredStyle
        })
      });

      if (response.ok) {
        await fetchTargets();
        setNewTarget({
          username: '',
          topics: '',
          replyProbability: 50,
          preferredStyle: 'casual'
        });
      }
    } catch (error) {
      console.error('Error adding target:', error);
    }
  };

  const removeTarget = async (id: string) => {
    try {
      await fetch(`/api/twitter/targets/${id}`, { method: 'DELETE' });
      await fetchTargets();
    } catch (error) {
      console.error('Error removing target:', error);
    }
  };

  return (
    <Card variant="system" title="ENGAGEMENT_TARGETS">
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="TWITTER_USERNAME"
            value={newTarget.username}
            onChange={(e) => setNewTarget(prev => ({ ...prev, username: e.target.value }))}
          />
          <Input
            placeholder="TOPICS [COMMA_SEPARATED]"
            value={newTarget.topics}
            onChange={(e) => setNewTarget(prev => ({ ...prev, topics: e.target.value }))}
          />
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>REPLY_RATE: {newTarget.replyProbability}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={newTarget.replyProbability}
              onChange={(e) => setNewTarget(prev => ({ 
                ...prev, 
                replyProbability: parseInt(e.target.value) 
              }))}
              className="flex-1 accent-white"
            />
          </div>
          <select
            value={newTarget.preferredStyle}
            onChange={(e) => setNewTarget(prev => ({ 
              ...prev, 
              preferredStyle: e.target.value as TweetStyle 
            }))}
            className="w-full bg-black text-white border border-white p-2 font-mono text-xs"
          >
            <option value="casual">CASUAL_MODE</option>
            <option value="shitpost">SHITPOST_MODE</option>
            <option value="metacommentary">META_MODE</option>
            <option value="rant">RANT_MODE</option>
            <option value="hornypost">HORNY_MODE</option>
          </select>
          <Button
            variant="system"
            onClick={addTarget}
            className="w-full"
          >
            ADD_TARGET
          </Button>
        </div>

        <div className="space-y-2">
          {targets.map(target => (
            <div key={target.id} className="flex items-center justify-between p-2 border border-white font-mono text-xs">
              <div>
                <div>@{target.username}</div>
                <div className="opacity-70">
                  TOPICS: {target.topics.join(', ')}
                </div>
                <div className="opacity-70">
                  MODE: {target.preferred_style} | RATE: {Math.round(target.reply_probability * 100)}%
                </div>
                {target.last_interaction && (
                  <div className="opacity-70">
                    LAST_INTERACTION: {new Date(target.last_interaction).toLocaleDateString()}
                  </div>
                )}
              </div>
              <Button
                variant="system"
                onClick={() => removeTarget(target.id)}
                className="h-8 px-2"
              >
                REMOVE
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}