import { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';
import { TwitterApi } from 'twitter-api-v2';

export class TwitterApiClient implements TwitterClient {
  private client: TwitterApi;

  constructor(private credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  }) {
    this.client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
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
          data: tweets.map(tweet => ({
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
          data: tweets.map(tweet => ({
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