// app/lib/twitter-client.ts

import { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';
import type { TwitterApi as TwitterApiType } from 'twitter-api-v2';

let TwitterApi: typeof TwitterApiType;
try {
  TwitterApi = require('twitter-api-v2').TwitterApi;
} catch (e) {
  console.error('Failed to load twitter-api-v2:', e);
  throw e;
}

export class TwitterApiClient implements TwitterClient {
  private client: TwitterApiType;
  private lastReset: number = 0;
  private remainingRequests: number = 300;

  constructor(private credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  }) {
    try {
      this.client = new TwitterApi({
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

  private async getUserIdByUsername(username: string): Promise<string> {
    try {
      console.log('Looking up user ID for username:', username);
      const user = await this.client.v2.userByUsername(username);
      if (!user.data) {
        throw new Error(`User not found: ${username}`);
      }
      console.log(`Resolved username ${username} to ID ${user.data.id}`);
      return user.data.id;
    } catch (error) {
      console.error('Error getting user ID:', error);
      throw new Error(`Failed to get user ID for username: ${username}`);
    }
  }

  async tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse> {
    try {
      console.log('Posting tweet:', { content, options });

      if (this.remainingRequests <= 5) {
        await this.waitForRateLimit();
      }

      let tweet;
      if (options?.reply) {
        tweet = await this.client.v2.tweet({
          text: content,
          reply: {
            in_reply_to_tweet_id: options.reply.in_reply_to_tweet_id
          }
        });
        console.log('Posted reply tweet:', { id: tweet.data.id, inReplyTo: options.reply.in_reply_to_tweet_id });
      } else {
        tweet = await this.client.v2.tweet(content);
        console.log('Posted new tweet:', { id: tweet.data.id });
      }
      
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
      if (error.code === 429) {
        await this.handleRateLimit(error);
        return this.tweet(content, options);
      }
      console.error('Error posting tweet:', error);
      throw new Error(error.message || 'Failed to post tweet');
    }
  }

  async userTimeline(options?: { user_id?: string; max_results?: number; exclude?: Array<'retweets' | 'replies'> }): Promise<TwitterTimelineResponse> {
    try {
        console.log('Fetching user timeline...', options);

        if (this.remainingRequests <= 5) {
            await this.waitForRateLimit();
        }

        // Get user ID (either from username or directly)
        let userId: string;
        if (options?.user_id) {
            if (!options.user_id.match(/^\d+$/)) {
                userId = await this.getUserIdByUsername(options.user_id);
            } else {
                userId = options.user_id;
            }
        } else {
            userId = await this.getCurrentUserId();
        }

        console.log('Fetching timeline for user ID:', userId);

        const timeline = await this.client.v2.userTimeline(
            userId,
            {
                max_results: options?.max_results || 10,
                "tweet.fields": ["created_at", "public_metrics", "conversation_id"],
                exclude: options?.exclude || []
            }
        );

        // Update rate limit info
        if (timeline.rateLimit) {
            this.remainingRequests = timeline.rateLimit.remaining || 0;
            const resetTimestamp = timeline.rateLimit.reset;
            if (resetTimestamp) {
                this.lastReset = new Date(resetTimestamp * 1000).getTime();
            }
        }

        const tweets = timeline.data.data || [];
        console.log('Timeline response:', {
            userId,
            tweetsFound: tweets.length,
            firstTweet: tweets[0]?.text,
            rateLimit: {
                remaining: this.remainingRequests,
                resetIn: Math.round((this.lastReset - Date.now()) / 1000) + ' seconds'
            }
        });

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
        if (error.code === 429) {
            console.log('Hit rate limit, waiting before retry...');
            await this.handleRateLimit(error);
            return this.userTimeline(options);
        }
        console.error('Error fetching user timeline:', error);
        throw new Error(error.message || 'Failed to fetch user timeline');
    }
  }

  async userMentionTimeline(): Promise<TwitterTimelineResponse> {
    try {
      console.log('Fetching user mention timeline...');
      if (this.remainingRequests <= 5) {
        await this.waitForRateLimit();
      }

      const mentions = await this.client.v2.userMentionTimeline(
        await this.getCurrentUserId(),
        {
          max_results: 10,
          "tweet.fields": ["created_at", "public_metrics", "conversation_id", "referenced_tweets"]
        }
      );

      if (mentions.rateLimit) {
        this.remainingRequests = mentions.rateLimit.remaining;
        this.lastReset = Date.now() + ((mentions.rateLimit.reset || 900) * 1000);
      }

      const tweets = mentions.data.data || [];
      console.log('Mentions response:', {
        mentionsFound: tweets.length,
        firstMention: tweets[0]?.text
      });

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
      if (error.code === 429) {
        await this.handleRateLimit(error);
        return this.userMentionTimeline();
      }
      console.error('Error fetching mentions:', error);
      throw new Error(error.message || 'Failed to fetch mentions');
    }
  }

  private async handleRateLimit(error: any) {
    try {
        let waitTime = 2 * 60 * 1000;  // Default 2 minutes

        if (error.rateLimit) {
            const resetDate = new Date(error.rateLimit.reset * 1000);
            const now = new Date();
            const secondsUntilReset = Math.max(1, Math.floor((resetDate.getTime() - now.getTime()) / 1000));
            waitTime = Math.min((secondsUntilReset + 5) * 1000, 15 * 60 * 1000);
        }

        console.log(`Rate limit reached. Waiting ${Math.round(waitTime/1000)} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (e) {
        console.error('Error handling rate limit:', e);
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    }
  }

  private async waitForRateLimit() {
    try {
        let waitTime = 60 * 1000;  // Default 1 minute

        if (this.lastReset > Date.now()) {
            waitTime = Math.min(this.lastReset - Date.now(), 15 * 60 * 1000);
        }

        console.log(`Rate limit precaution - waiting ${Math.round(waitTime/1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (error) {
        console.error('Error in waitForRateLimit:', error);
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
    }
  }

  private async getCurrentUserId(): Promise<string> {
    try {
        const me = await this.client.v2.me();
        return me.data.id;
    } catch (error) {
        console.error('Error getting current user ID:', error);
        throw new Error('Failed to get current user ID');
    }
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

    if (!credentials.apiKey || !credentials.apiSecret || 
        !credentials.accessToken || !credentials.accessSecret) {
      throw new Error('Missing Twitter API credentials');
    }

    twitterClientInstance = new TwitterApiClient(credentials);
  }
  return twitterClientInstance;
}