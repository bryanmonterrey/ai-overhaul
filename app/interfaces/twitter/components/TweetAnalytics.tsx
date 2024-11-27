// src/app/interfaces/twitter/components/TweetAnalytics.tsx

import React from 'react';
import { Card } from '@/app/components/common/Card';

interface AnalyticsData {
  engagement: {
    total_likes: number;
    total_retweets: number;
    total_replies: number;
    average_engagement_rate: number;
  };
  performance: {
    best_style: string;
    peak_hours: string[];
    top_themes: string[];
  };
  trends: {
    sentiment: number;
    volatility: number;
    momentum: number;
  };
}

interface TweetAnalyticsProps {
  data: AnalyticsData;
}

export default function TweetAnalytics({ data }: TweetAnalyticsProps) {
  return (
    <Card variant="system" title="PERFORMANCE_METRICS">
      <div className="space-y-6">
        <div>
          <div className="text-xs mb-2">engagement_metrics:</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>total_likes: {data.engagement.total_likes}</div>
            <div>total_retweets: {data.engagement.total_retweets}</div>
            <div>total_replies: {data.engagement.total_replies}</div>
            <div>avg_engagement: {(data.engagement.average_engagement_rate * 100).toFixed(1)}%</div>
          </div>
        </div>

        <div>
          <div className="text-xs mb-2">optimization_data:</div>
          <div className="space-y-1 text-sm">
            <div>optimal_style: {data.performance.best_style}</div>
            <div>peak_hours: {data.performance.peak_hours.join(', ')}</div>
            <div className="space-y-1">
              <div>top_themes:</div>
              {data.performance.top_themes.map((theme, i) => (
                <div key={theme} className="ml-4">
                  [{i}] {theme}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs mb-2">trend_analysis:</div>
          <div className="space-y-2">
            {Object.entries(data.trends).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="text-xs">{key}:</div>
                <div className="w-full bg-black h-2">
                  <div 
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}