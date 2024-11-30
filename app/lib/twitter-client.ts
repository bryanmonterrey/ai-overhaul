// app/lib/twitter-client.ts

import { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';

// Use dynamic import for twitter-api-v2 to avoid initialization issues
const TwitterApi = (() => {
  try {
    return require('twitter-api-v2');
  } catch (e) {
    console.error('Failed to load twitter-api-v2:', e);
    throw e;
  }
})();

export class TwitterApiClient implements TwitterClient {
  private client: any;

  constructor(private credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  }) {
    try {
      this.client = new TwitterApi.TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessSecret,
      });
    } catch (e) {
      console.error('Failed to initialize Twitter client:', e);
      throw e;
    }
  }

  async tweet(content: string): Promise<TwitterResponse> {
    try {
      const tweet = await this.client.v2.tweet(content);
      
      return {
        data: {
          id: tweet.data.id,
          text: tweet.data.text,
          created_at: new Date().toISOString(),
          public_metrics: {
            like_count: 0,
            retweet_count: 0,
            reply_count: 0
          }
        }
      };
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      throw new Error(error.message || 'Failed to post tweet');
    }
  }

  async userTimeline(): Promise<TwitterTimelineResponse> {
    try {
      const timeline = await this.client.v2.userTimeline(
        await this.getCurrentUserId(), 
        {
          max_results: 10,
          "tweet.fields": ["created_at", "public_metrics"]
        }
      );

      const tweets = timeline.data.data || [];

      return {
        data: {
          data: tweets.map((tweet: any) => ({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            public_metrics: {
              like_count: tweet.public_metrics?.like_count || 0,
              retweet_count: tweet.public_metrics?.retweet_count || 0,
              reply_count: tweet.public_metrics?.reply_count || 0
            }
          }))
        }
      };
    } catch (error: any) {
      console.error('Error fetching user timeline:', error);
      throw new Error(error.message || 'Failed to fetch user timeline');
    }
  }

  async userMentionTimeline(): Promise<TwitterTimelineResponse> {
    try {
      const mentions = await this.client.v2.userMentionTimeline(
        await this.getCurrentUserId(),
        {
          max_results: 10,
          "tweet.fields": ["created_at", "public_metrics"]
        }
      );

      const tweets = mentions.data.data || [];

      return {
        data: {
          data: tweets.map((tweet: any) => ({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            public_metrics: {
              like_count: tweet.public_metrics?.like_count || 0,
              retweet_count: tweet.public_metrics?.retweet_count || 0,
              reply_count: tweet.public_metrics?.reply_count || 0
            }
          }))
        }
      };
    } catch (error: any) {
      console.error('Error fetching mentions:', error);
      throw new Error(error.message || 'Failed to fetch mentions');
    }
  }

  private async getCurrentUserId(): Promise<string> {
    const me = await this.client.v2.me();
    return me.data.id;
  }
}

// Singleton instance with better error handling
let twitterClientInstance: TwitterApiClient | null = null;

export function getTwitterClient(): TwitterApiClient {
  if (!twitterClientInstance) {
    const credentials = {
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
    };

    // Validate credentials before creating instance
    if (!credentials.apiKey || !credentials.apiSecret || 
        !credentials.accessToken || !credentials.accessSecret) {
      throw new Error('Missing Twitter API credentials');
    }

    twitterClientInstance = new TwitterApiClient(credentials);
  }
  return twitterClientInstance;
}