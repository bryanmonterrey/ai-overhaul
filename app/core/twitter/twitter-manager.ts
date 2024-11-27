import { TwitterError, TwitterRateLimitError, TwitterAuthError, TwitterNetworkError, TwitterDataError } from './twitter-errors';
import type { TwitterClient, TwitterData } from './types';

export class TwitterManager {
  private client: TwitterClient;

  constructor(client: TwitterClient) {
    this.client = client;
  }

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
} 