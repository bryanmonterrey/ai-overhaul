// app/core/twitter/TwitterEngagementSystem.ts

import { 
    PersonalitySystem,
    EmotionalState, 
    EngagementTarget,
    EngagementMetrics,
    TweetStyle,
    Memory
  } from '../personality/types';
  import { TwitterService } from '@/lib/twitter-client';
  
  interface RateLimitConfig {
    maxRepliesPerHour: number;
    minTimeBetweenReplies: number; // in milliseconds
    maxDailyRepliesPerTarget: number;
  }
  
  export class TwitterEngagementSystem {
    private rateLimits: RateLimitConfig = {
      maxRepliesPerHour: 30,
      minTimeBetweenReplies: 120000, // 2 minutes
      maxDailyRepliesPerTarget: 10
    };
  
    private replyHistory: Map<string, Date[]> = new Map();
    private targetEngagementStats: Map<string, EngagementMetrics> = new Map();
  
    constructor(
      private personality: PersonalitySystem,
      private twitter: TwitterService
    ) {}
  
    public async monitorTargetTweets(target: EngagementTarget): Promise<void> {
      try {
        // Get recent tweets since last interaction
        const lastCheck = target.lastInteraction || new Date(0);
        const tweets = await this.twitter.getUserTimeline(target.username);
  
        for (const tweet of tweets) {
          const tweetDate = new Date(tweet.created_at);
          if (tweetDate > lastCheck && this.shouldReplyToTweet(tweet, target)) {
            await this.generateAndSendReply(tweet, target);
          }
        }
      } catch (error) {
        console.error(`Error monitoring tweets for ${target.username}:`, error);
      }
    }
  
    private shouldReplyToTweet(tweet: any, target: EngagementTarget): boolean {
      // Check rate limits
      if (!this.checkRateLimits(target.id)) return false;
  
      // Check if tweet contains relevant topics
      const hasTopic = target.topics.some(topic => 
        tweet.text.toLowerCase().includes(topic.toLowerCase())
      );
      if (!hasTopic) return false;
  
      // Apply probability check
      return Math.random() < target.replyProbability;
    }
  
    private checkRateLimits(targetId: string): boolean {
      const now = new Date();
      const replies = this.replyHistory.get(targetId) || [];
  
      // Clean up old entries
      const recentReplies = replies.filter(date => 
        now.getTime() - date.getTime() < 24 * 60 * 60 * 1000
      );
      this.replyHistory.set(targetId, recentReplies);
  
      // Check daily limit
      if (recentReplies.length >= this.rateLimits.maxDailyRepliesPerTarget) {
        return false;
      }
  
      // Check hourly limit
      const lastHourReplies = recentReplies.filter(date => 
        now.getTime() - date.getTime() < 60 * 60 * 1000
      ).length;
      if (lastHourReplies >= this.rateLimits.maxRepliesPerHour) {
        return false;
      }
  
      // Check minimum time between replies
      const lastReply = recentReplies[recentReplies.length - 1];
      if (lastReply && now.getTime() - lastReply.getTime() < this.rateLimits.minTimeBetweenReplies) {
        return false;
      }
  
      return true;
    }
  
    private async generateAndSendReply(tweet: any, target: EngagementTarget): Promise<void> {
      try {
        // Build context for personality system
        const context = {
          platform: 'twitter' as const,
          recentInteractions: await this.getRecentInteractions(target.id),
          environmentalFactors: {
            timeOfDay: this.getTimeOfDay(),
            platformActivity: 0.5, // You can implement actual platform activity tracking
            socialContext: [target.relationshipLevel],
            platform: 'twitter'
          },
          style: target.preferredStyle,
          activeNarratives: []
        };
  
        // Generate reply using personality system
        const reply = await this.personality.processInput(tweet.text, context);
  
        // Clean and format reply
        const formattedReply = this.formatReply(reply);
  
        // Send tweet
        const response = await this.twitter.postTweet(formattedReply, {
          reply: { in_reply_to_tweet_id: tweet.id }
        });
  
        // Update history and stats
        this.updateEngagementHistory(target.id, tweet.id, response.data.id);
  
        // Store interaction in memory
        const memory: Memory = {
          id: response.data.id,
          content: formattedReply,
          type: 'twitter_reply',
          timestamp: new Date(),
          emotionalContext: this.personality.getCurrentEmotion(),
          platform: 'twitter',
          importance: 0.7,
          associations: [target.username, ...target.topics]
        };
  
        await this.personality.storeMemory(memory);
  
      } catch (error) {
        console.error(`Error generating reply for ${target.username}:`, error);
      }
    }
  
    private formatReply(reply: string): string {
      // Remove any state markers added by personality system
      return reply.replace(/\[(\w+)_state\]$/, '').trim();
    }
  
    private getTimeOfDay(): string {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      if (hour >= 17 && hour < 22) return 'evening';
      return 'night';
    }
  
    private async getRecentInteractions(targetId: string): Promise<string[]> {
      const replies = this.replyHistory.get(targetId) || [];
      return replies.slice(-5).map(date => date.toISOString());
    }
  
    private updateEngagementHistory(targetId: string, tweetId: string, replyId: string): void {
      const replies = this.replyHistory.get(targetId) || [];
      replies.push(new Date());
      this.replyHistory.set(targetId, replies);
    }
  
    public async updateEngagementMetrics(target: EngagementTarget): Promise<void> {
      try {
        const tweets = await this.twitter.getUserTimeline(target.username);
        const metrics = this.calculateEngagementMetrics(tweets);
        this.targetEngagementStats.set(target.id, metrics);
      } catch (error) {
        console.error(`Error updating metrics for ${target.username}:`, error);
      }
    }
  
    private calculateEngagementMetrics(tweets: any[]): EngagementMetrics {
      const totals = tweets.reduce((acc, tweet) => ({
        likes: acc.likes + (tweet.public_metrics?.like_count || 0),
        retweets: acc.retweets + (tweet.public_metrics?.retweet_count || 0),
        replies: acc.replies + (tweet.public_metrics?.reply_count || 0),
        impressions: acc.impressions + (tweet.public_metrics?.impression_count || 0)
      }), { likes: 0, retweets: 0, replies: 0, impressions: 0 });
  
      const engagementRate = totals.impressions > 0 
        ? ((totals.likes + totals.retweets + totals.replies) / totals.impressions) * 100
        : 0;
  
      return {
        ...totals,
        engagementRate
      };
    }
  
    public getEngagementStats(targetId: string): EngagementMetrics | undefined {
      return this.targetEngagementStats.get(targetId);
    }
  }