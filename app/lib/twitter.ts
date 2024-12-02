// src/app/lib/twitter.ts

import { TwitterApi, TweetV2, UserV2, TweetV2PostTweetResult } from 'twitter-api-v2';
import { createClient } from '@supabase/supabase-js';
import { EnvironmentalFactors } from '@/app/core/types';
import {
  TwitterMetrics,
  TweetMetrics,
  CachedTweet,
  TwitterStatus,
  ScheduledTweet,
  TweetThread,
  TweetSearchResult
} from './types/twitter';
import { TwitterAuthError, TwitterRateLimitError, TwitterNetworkError, TwitterDataError, TwitterError } from '@/app/lib/errors/TwitterErrors';

export class TwitterManager {
  private client: TwitterApi;
  private supabase;
  private recentTweets: Map<string, CachedTweet> = new Map();

  constructor() {
    const requiredEnvVars = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET'
    ];

    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        throw new Error(`${varName} is not defined`);
      }
    });

    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.loadRecentTweets();
  }

  async monitorTargetTweets(target: EngagementTargetRow): Promise<void> {
    try {
      const timelineResponse = await this.client.userTimeline({
        user_id: target.username,
        max_results: 10,
        exclude: ['retweets', 'replies']
      });
  
      const timeline = timelineResponse.data.data;
      const lastCheck = target.last_interaction ? new Date(target.last_interaction) : new Date(0);
  
      console.log(`Monitoring tweets for ${target.username}`, {
        tweetsFound: timeline?.length,
        lastCheck: lastCheck.toISOString()
      });
  
      for (const tweet of (timeline || [])) {
        const tweetDate = new Date(tweet.created_at || '');
        if (tweetDate > lastCheck && await this.shouldReplyToTweet(tweet, target)) {
          await this.generateAndSendReply(tweet, target);
          
          await this.supabase
            .from('engagement_targets')
            .update({ last_interaction: new Date().toISOString() })
            .eq('id', target.id);
        }
      }
    } catch (error) {
      console.error(`Error monitoring tweets for ${target.username}:`, error);
    }
  }

  // Add these methods to your TwitterManager class
  public startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      const { data: targets } = await this.supabase
        .from('engagement_targets')
        .select('*');
        
      if (targets) {
        for (const target of targets) {
          await this.monitorTargetTweets(target);
        }
      }
    }, 5 * 60 * 1000);  // Every 5 minutes
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  private monitoringInterval?: NodeJS.Timeout;

private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries === 0) throw this.handleTwitterError(error);
      
      if (error.code === 429) {  // Rate limit
        const resetTime = new Date(error.reset * 1000);
        throw new TwitterRateLimitError(resetTime);
      }
  
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryOperation(operation, retries - 1, delay * 2);
    }
  }
  
  private handleTwitterError(error: any): Error {
    // Rate limit handling
    if (error.code === 429) {
      return new TwitterRateLimitError(new Date(error.reset * 1000));
    }
  
    // Auth errors
    if (error.code === 401 || error.code === 403) {
      return new TwitterAuthError(error.message);
    }
  
    // Network errors
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      return new TwitterNetworkError(error.message);
    }
  
    // Data validation errors
    if (error.code === 400) {
      return new TwitterDataError(error.message);
    }
  
    // Log unknown errors
    console.error('Unexpected Twitter error:', error);
    return new TwitterError('An unexpected error occurred', 'UNKNOWN', 500);
  }
  
  // Example usage in a method:
  async postTweet(content: string, replyToId?: string): Promise<TweetV2> {
    // Validate content length
    if (content.length > 280) {
      throw new TwitterDataError('Tweet exceeds maximum length');
    }
  
    return this.retryOperation(async () => {
      try {
        const tweetData = replyToId 
          ? { text: content, reply: { in_reply_to_tweet_id: replyToId } }
          : { text: content };
  
        const tweet = await this.client.v2.tweet(tweetData);
  
        // Add missing property to match TweetV2 type
        const tweetWithEditHistory = {
          ...tweet.data,
          edit_history_tweet_ids: [tweet.data.id]
        };
  
        // Store in Supabase
        await this.supabase
          .from('tweets')
          .insert({
            tweet_id: tweetWithEditHistory.id,
            content: content,
            reply_to: replyToId,
            timestamp: new Date().toISOString()
          })
          .then(result => {
            if (result.error) {
              console.error('Supabase storage error:', result.error);
            }
          });
  
        this.recentTweets.set(tweetWithEditHistory.id, {
          content,
          timestamp: new Date(),
          engagement: { likes: 0, retweets: 0, replies: 0 }
        });
  
        return tweetWithEditHistory;
      } catch (error) {
        throw this.handleTwitterError(error);
      }
    });
  }

  private async loadRecentTweets(): Promise<void> {
    try {
      const timeline = await this.client.v2.userTimeline(
        process.env.TWITTER_USER_ID!,
        {
          max_results: 100,
          "tweet.fields": ["public_metrics", "created_at"]
        }
      );

      for (const tweet of timeline.data.data) {
        this.recentTweets.set(tweet.id, {
          content: tweet.text,
          timestamp: new Date(tweet.created_at!),
          engagement: {
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0
          }
        });
      }
    } catch (error) {
      console.error('Error loading recent tweets:', error);
    }
  }

  async getEnvironmentalFactors(): Promise<Partial<EnvironmentalFactors>> {
    try {
      const [timeline, mentions] = await Promise.all([
        this.client.v2.userTimeline(process.env.TWITTER_USER_ID!, {
          max_results: 100,
          "tweet.fields": ["public_metrics", "created_at"]
        }),
        this.client.v2.userMentionTimeline(process.env.TWITTER_USER_ID!)
      ]);

      const platformActivity = this.calculateActivity(timeline.data.data, mentions.data.data);
      const trends = await this.getTrends();
      const { sentiment, momentum } = this.analyzeEngagement(timeline.data.data);

      return {
        platformActivity,
        socialContext: this.extractTopics(timeline.data.data),
        marketConditions: {
          sentiment,
          volatility: this.calculateVolatility(timeline.data.data),
          momentum,
          trends
        }
      };
    } catch (error) {
      console.error('Error getting Twitter environment:', error);
      return {};
    }
  }

  private async getTrends(): Promise<string[]> {
    try {
      // Get trends for worldwide (id: 1) or specify another location
      const { data } = await this.client.v2.get('trends/place.json?id=1');
      return data[0].trends
        .slice(0, 5)
        .map((trend: { name: string }) => trend.name);
    } catch (error) {
      console.error('Error getting trends:', error);
      return [];
    }
  }

  private calculateActivity(timeline: TweetV2[], mentions: TweetV2[]): number {
    const recentTime = Date.now() - 3600000;
    const recentInteractions = [...timeline, ...mentions]
      .filter(t => new Date(t.created_at!).getTime() > recentTime);
    
    return Math.min(1, recentInteractions.length / 20);
  }

  private analyzeEngagement(tweets: TweetV2[]): { sentiment: number; momentum: number } {
    const engagements = tweets.map(tweet => ({
      total: (tweet.public_metrics?.like_count || 0) + 
             (tweet.public_metrics?.retweet_count || 0) * 2 + 
             (tweet.public_metrics?.reply_count || 0) * 3,
      timestamp: new Date(tweet.created_at!).getTime()
    }));

    const averageEngagement = engagements.reduce((acc, curr) => acc + curr.total, 0) / engagements.length;
    const recentEngagement = engagements
      .filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((acc, curr) => acc + curr.total, 0) / engagements.length;

    return {
      sentiment: Math.min(1, recentEngagement / averageEngagement),
      momentum: (recentEngagement - averageEngagement) / averageEngagement
    };
  }

  private calculateVolatility(tweets: TweetV2[]): number {
    const engagements = tweets
      .map(t => t.public_metrics?.like_count || 0)
      .slice(0, 20);
    
    if (engagements.length < 2) return 0;

    const diffs = engagements
      .slice(1)
      .map((e, i) => Math.abs(e - engagements[i]));
    
    return Math.min(1, diffs.reduce((a, b) => a + b, 0) / (engagements.length * 100));
  }

  private extractTopics(tweets: TweetV2[]): string[] {
    const text = tweets.map(t => t.text).join(' ');
    const words = text.toLowerCase().split(' ');
    const wordFreq = new Map<string, number>();
    
    words.forEach(word => {
      if (word.length > 4 && !word.startsWith('@') && !word.startsWith('http')) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  async getStatus(): Promise<TwitterStatus> {
    try {
      const user = await this.client.v2.me();
      const userDetails = await this.client.v2.user(user.data.id, {
        "user.fields": ["public_metrics", "created_at"]
      });

      const recentTweets = Array.from(this.recentTweets.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      const averageEngagement = recentTweets.reduce((acc, tweet) => {
        return acc + tweet.engagement.likes + 
               tweet.engagement.retweets * 2 + 
               tweet.engagement.replies * 3;
      }, 0) / recentTweets.length;

      return {
        account: {
          username: user.data.username,
          followers: userDetails.data.public_metrics?.followers_count || 0,
          following: userDetails.data.public_metrics?.following_count || 0,
          tweetsCount: userDetails.data.public_metrics?.tweet_count || 0
        },
        activity: {
          recentTweetsCount: this.recentTweets.size,
          averageEngagement,
          lastTweetTime: recentTweets[0]?.timestamp || null
        },
        limits: await this.getRateLimits()
      };
    } catch (error) {
      console.error('Error getting Twitter status:', error);
      throw error;
    }
  }

  private async getRateLimits() {
    try {
      const response = await this.client.v2.get('application/rate_limit_status.json');
      return {
        tweets: response.resources?.tweets,
        users: response.resources?.users
      };
    } catch (error) {
      console.error('Error getting rate limits:', error);
      return null;
    }
  }

  async createThread(tweets: string[]): Promise<TweetV2[]> {
    try {
      let previousTweetId: string | undefined;
      const threadTweets: TweetV2[] = [];

      for (const tweetContent of tweets) {
        const tweet = await this.postTweet(tweetContent, previousTweetId);
        threadTweets.push(tweet);
        previousTweetId = tweet.id;
      }

      await this.supabase
        .from('tweet_threads')
        .insert({
          thread_id: threadTweets[0].id,
          tweets: threadTweets.map(t => t.id),
          timestamp: new Date().toISOString()
        });

      return threadTweets;
    } catch (error) {
      console.error('Error creating thread:', error);
      throw error;
    }
  }

  async searchRelevantTweets(query: string, limit: number = 100): Promise<TweetSearchResult[]> {
    try {
      const results = await this.client.v2.search(query, {
        max_results: limit,
        "tweet.fields": ["public_metrics", "created_at", "context_annotations"]
      });

      return results.data.data.map(tweet => ({
        id: tweet.id,
        content: tweet.text,
        metrics: tweet.public_metrics || {},
        created_at: tweet.created_at,
        context: tweet.context_annotations
      }));
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async scheduleTweet(content: string, scheduledTime: Date): Promise<boolean> {
    try {
      await this.supabase
        .from('scheduled_tweets')
        .insert({
          content,
          scheduled_time: scheduledTime.toISOString(),
          status: 'pending'
        });

      return true;
    } catch (error) {
      console.error('Error scheduling tweet:', error);
      throw error;
    }
  }

  

  async processScheduledTweets(): Promise<number> {
    try {
      const { data: scheduledTweets, error } = await this.supabase
        .from('scheduled_tweets')
        .select('*')
        .eq('status', 'pending')
        .lt('scheduled_time', new Date().toISOString());

      if (error) throw error;

      for (const tweet of scheduledTweets) {
        await this.postTweet(tweet.content);
        
        await this.supabase
          .from('scheduled_tweets')
          .update({ status: 'completed' })
          .eq('id', tweet.id);
      }

      return scheduledTweets.length;
    } catch (error) {
      console.error('Error processing scheduled tweets:', error);
      throw error;
    }
  }
}

export default TwitterManager;