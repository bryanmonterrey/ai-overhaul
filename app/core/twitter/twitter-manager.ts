import { TwitterError, TwitterRateLimitError, TwitterAuthError, TwitterNetworkError, TwitterDataError } from './twitter-errors';
import type { TwitterClient, TwitterData } from './types';
import type { EngagementTargetRow } from '@/app/types/supabase';
import { PersonalitySystem } from '../personality/PersonalitySystem';
import { TweetStyle } from '../personality/types';

interface QueuedTweet {
  id: string;
  content: string;
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export class TwitterManager {
  private client: TwitterClient;
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private nextTweetTimeout?: NodeJS.Timeout;
  private lastTweetTime?: Date;
  private isReady: boolean = true;
  private recentTweets = new Map<string, any>();
  

  constructor(
    client: TwitterClient,
    private personality: PersonalitySystem
  ) {
    this.client = client;
  }

  // Your existing methods
  async postTweet(content: string): Promise<TwitterData> {
    try {
      if (content.length > 280) {
        throw new TwitterDataError('Tweet exceeds character limit');
      }

      const result = await this.client.tweet(content);
      return result.data;

    } catch (error: any) {
      if (error instanceof TwitterDataError) {
        throw error;
      }
      
      if (error.code === 429) {
        throw new TwitterRateLimitError('Rate limit exceeded');
      }
      if (error.code === 401 || error.message?.includes('Invalid credentials')) {
        throw new TwitterAuthError('Authentication failed');
      }
      if (error.message?.includes('timeout')) {
        throw new TwitterNetworkError('Network timeout occurred');
      }
      if (error.message?.includes('Failed')) {
        throw new TwitterDataError('Thread creation failed');
      }
      throw new TwitterNetworkError('Network error occurred');
    }
  }

  // Auto-tweeter methods
  public async generateTweetBatch(count: number = 10): Promise<void> {
    const newTweets: QueuedTweet[] = [];
    
    for (let i = 0; i < count; i++) {
      const style = this.personality.getCurrentTweetStyle();
      const content = await this.personality.processInput(
        'Generate a tweet', 
        { platform: 'twitter', style }
      );

      newTweets.push({
        id: crypto.randomUUID(),
        content: this.cleanTweet(content),
        style,
        status: 'pending',
        generatedAt: new Date()
      });
    }

    this.queuedTweets = [...this.queuedTweets, ...newTweets];
  }

  private cleanTweet(tweet: string): string {
    return tweet
      .replace(/\[(\w+)_state\]$/, '')
      .trim();
  }

  public getNextScheduledTime(): Date | null {
    const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
    if (approvedTweets.length === 0) return null;
    
    const nextTweet = approvedTweets[0];
    return nextTweet.scheduledFor || null;
  }

  public updateTweetStatus(id: string, status: 'approved' | 'rejected'): void {
    this.queuedTweets = this.queuedTweets.map(tweet => 
      tweet.id === id ? { ...tweet, status } : tweet
    );

    if (status === 'approved' && this.isAutoMode) {
      this.scheduleNextTweet();
    }
  }

  public toggleAutoMode(enabled: boolean): void {
    this.isAutoMode = enabled;
    if (enabled) {
      this.scheduleNextTweet();
    } else {
      if (this.nextTweetTimeout) {
        clearTimeout(this.nextTweetTimeout);
      }
    }
  }

  private getOptimalTweetTime(): Date {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 23 || hour < 6) {
      now.setHours(7, 0, 0, 0);
      if (hour >= 23) now.setDate(now.getDate() + 1);
    }
    
    return now;
  }

  // In twitter-manager.ts update:

private async scheduleNextTweet(): Promise<void> {
  if (!this.isAutoMode) return;

  const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
  if (approvedTweets.length === 0) return;

  const nextTweet = approvedTweets[0];
  const now = new Date();
  const delay = 30 * 60 * 1000; // 30 minutes between tweets

  nextTweet.scheduledFor = new Date(now.getTime() + delay);

  if (this.nextTweetTimeout) {
    clearTimeout(this.nextTweetTimeout);
  }

  console.log(`Scheduling tweet for ${nextTweet.scheduledFor}`);

  this.nextTweetTimeout = setTimeout(async () => {
    try {
      console.log(`Posting scheduled tweet: ${nextTweet.content}`);
      await this.postTweet(nextTweet.content);
      
      // Remove the posted tweet from queue
      this.queuedTweets = this.queuedTweets.filter(t => t.id !== nextTweet.id);
      
      // Log success and schedule next tweet
      console.log('Tweet posted successfully');
      this.scheduleNextTweet();
    } catch (error) {
      console.error('Error posting scheduled tweet:', error);
      // Retry in 5 minutes if posting fails
      setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
    }
  }, delay);
}

  public getQueuedTweets(): QueuedTweet[] {
    return this.queuedTweets;
  }

  public clearRejectedTweets(): void {
    this.queuedTweets = this.queuedTweets.filter(t => t.status !== 'rejected');
  }

  async createThread(tweets: string[]): Promise<TwitterData[]> {
    const results: TwitterData[] = [];
    for (const tweet of tweets) {
      try {
        const result = await this.postTweet(tweet);
        results.push(result);
      } catch (error) {
        if (results.length === 0) {
          throw error; // Throw on first tweet failure
        }
        throw new TwitterDataError('Thread creation failed');
      }
    }
    return results;
  }

  async getEnvironmentalFactors(): Promise<{ platformActivity: number; socialContext: string[] }> {
    try {
      const timeline = await this.client.userTimeline();
      const mentions = await this.client.userMentionTimeline();
      
      return {
        platformActivity: 0.5,
        socialContext: []
      };
    } catch (error) {
      throw new TwitterNetworkError('Failed to fetch environmental factors');
    }
  }

  // Engagement-related methods
  async monitorTargetTweets(target: EngagementTargetRow): Promise<void> {
    try {
      const timelineResponse = await this.client.userTimeline();
      const timeline = timelineResponse.data.data; // Access the tweets array
      const lastCheck = target.last_interaction ? new Date(target.last_interaction) : new Date(0);
  
      for (const tweet of timeline) {
        const tweetDate = new Date(tweet.created_at || '');
        if (tweetDate > lastCheck && this.shouldReplyToTweet(tweet, target)) {
          await this.generateAndSendReply(tweet, target);
        }
      }
    } catch (error) {
      console.error(`Error monitoring tweets for ${target.username}:`, error);
    }
  }

  private shouldReplyToTweet(tweet: any, target: EngagementTargetRow): boolean {
    // Check if tweet contains relevant topics
    const hasTopic = target.topics.some(topic => 
      tweet.text.toLowerCase().includes(topic.toLowerCase())
    );

    return hasTopic && Math.random() < target.reply_probability;
  }

  private async generateAndSendReply(tweet: TwitterData, target: EngagementTargetRow): Promise<void> {
    try {
      const context = {
        platform: 'twitter' as const,
        environmentalFactors: {
          timeOfDay: this.getTimeOfDay(),
          platformActivity: 0.5,
          socialContext: [target.relationship_level],
          platform: 'twitter'
        },
        style: target.preferred_style as TweetStyle, // Cast the style
        additionalContext: `Replying to @${target.username}'s tweet: ${tweet.text}`
      };
  
      const reply = await this.personality.processInput(tweet.text, context);
      
      if (reply) {
        await this.postTweet(reply);
      }
    } catch (error) {
      console.error(`Error generating reply for ${target.username}:`, error);
    }
  }
  

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  async getStatus(): Promise<any> {  // Define return type based on your needs
    return {
      lastTweetTime: this.lastTweetTime,
      isReady: this.isReady,  // Assuming these properties exist
      // Add other status properties as needed
    };
  }

  getRecentTweets() {
    return this.recentTweets;
  }
}