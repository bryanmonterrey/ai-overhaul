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

  async tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse> {
    try {
      console.log('Posting tweet:', { content, options });
      let tweet;

      if (options?.reply) {
        tweet = await this.client.v2.tweet({
          text: content,
          reply: {
            in_reply_to_tweet_id: options.reply.in_reply_to_tweet_id
          }
        });
      } else {
        tweet = await this.client.v2.tweet(content);
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

        const userId = options?.user_id || await this.getCurrentUserId();
        const timeline = await this.client.v2.userTimeline(
            userId,
            {
                max_results: options?.max_results || 10,
                "tweet.fields": ["created_at", "public_metrics"],
                exclude: options?.exclude || []
            }
        );

        // Update rate limit info if available
        if (timeline.rateLimit) {
            this.remainingRequests = timeline.rateLimit.remaining || 0;
            const resetTimestamp = timeline.rateLimit.reset;
            if (resetTimestamp) {
                this.lastReset = new Date(resetTimestamp * 1000).getTime();
            }
        }

        const tweets = timeline.data.data || [];
        console.log('Timeline response:', {
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
          "tweet.fields": ["created_at", "public_metrics"]
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
        // Default to 2 minutes if we can't get the reset time
        let waitTime = 2 * 60 * 1000;

        if (error.rateLimit) {
            // Calculate seconds until reset
            const resetDate = new Date(error.rateLimit.reset * 1000);
            const now = new Date();
            const secondsUntilReset = Math.max(1, Math.floor((resetDate.getTime() - now.getTime()) / 1000));
            
            // Add 5 seconds buffer and convert to milliseconds
            waitTime = Math.min((secondsUntilReset + 5) * 1000, 15 * 60 * 1000);
        }

        console.log(`Rate limit reached. Waiting ${Math.round(waitTime/1000)} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (e) {
        console.error('Error handling rate limit:', e);
        // Default to 2 minutes wait if something goes wrong
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    }
}


private async waitForRateLimit() {
  try {
      // Default wait of 1 minute
      let waitTime = 60 * 1000;

      if (this.lastReset > Date.now()) {
          waitTime = Math.min(this.lastReset - Date.now(), 15 * 60 * 1000);
      }

      console.log(`Rate limit precaution - waiting ${Math.round(waitTime/1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
  } catch (error) {
      console.error('Error in waitForRateLimit:', error);
      // Default to 1 minute wait if something goes wrong
      await new Promise(resolve => setTimeout(resolve, 60 * 1000));
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

    if (!credentials.apiKey || !credentials.apiSecret || 
        !credentials.accessToken || !credentials.accessSecret) {
      throw new Error('Missing Twitter API credentials');
    }

    twitterClientInstance = new TwitterApiClient(credentials);
  }
  return twitterClientInstance;
}