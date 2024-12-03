// app/lib/twitter-client.ts

import { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';
import type { TwitterApi as TwitterApiType } from 'twitter-api-v2';

// Import twitter-api-v2 dynamically to avoid initialization issues
let TwitterApi: typeof TwitterApiType;
try {
  TwitterApi = require('twitter-api-v2').TwitterApi;
} catch (e) {
  console.error('Failed to load twitter-api-v2:', e);
  throw e;
}

export class TwitterApiClient implements TwitterClient {
  private client: TwitterApiType;

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
        
        let tweetData;
        if (options?.reply) {
            tweetData = await this.client.v2.reply(
                content,
                options.reply.in_reply_to_tweet_id
            );
            console.log('Posted reply:', {
                content,
                inReplyTo: options.reply.in_reply_to_tweet_id,
                result: tweetData
            });
        } else {
            tweetData = await this.client.v2.tweet(content);
        }
      
        return {
            data: {
                id: tweetData.data.id,
                text: tweetData.data.text,
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

  async userTimeline(options?: any): Promise<TwitterTimelineResponse> {
    try {
        console.log('Fetching user timeline...', options);
        if (this.isRateLimited()) {
            await this.waitForRateLimit();
        }

        const timeline = await this.client.v2.userTimeline(
            options?.user_id || await this.getCurrentUserId(), 
            {
                max_results: options?.max_results || 10,
                "tweet.fields": ["created_at", "public_metrics"]
            }
        );

        const tweets = timeline.data.data || [];
        console.log('Timeline response:', {
            tweetsFound: tweets.length,
            firstTweet: tweets[0]?.text
        });

        // Update rate limit info
        this.updateRateLimitInfo(timeline.rateLimit);

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
            console.log('Rate limit hit, waiting before retry...');
            await this.handleRateLimit(error);
            return this.userTimeline(options); // Retry after waiting
        }
        console.error('Error fetching user timeline:', error);
        throw new Error(error.message || 'Failed to fetch user timeline');
    }
}

private lastReset: number = 0;
private remainingRequests: number = 300; // Default Twitter v2 API limit

private isRateLimited(): boolean {
    return this.remainingRequests <= 5; // Buffer of 5 requests
}

private updateRateLimitInfo(rateLimit: any) {
    if (rateLimit) {
        this.remainingRequests = rateLimit.remaining;
        this.lastReset = Date.now() + (rateLimit.reset * 1000);
    }
}

private async handleRateLimit(error: any) {
    const resetTime = error.rateLimit?.reset ? error.rateLimit.reset * 1000 : Date.now() + (15 * 60 * 1000);
    const waitTime = Math.max(resetTime - Date.now(), 0) + 1000; // Add 1 second buffer
    console.log(`Rate limit reached. Waiting ${Math.round(waitTime/1000)} seconds...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
}

private async waitForRateLimit() {
    const now = Date.now();
    if (this.lastReset > now) {
        const waitTime = this.lastReset - now + 1000;
        console.log(`Waiting for rate limit reset: ${Math.round(waitTime/1000)} seconds`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}


async userMentionTimeline(): Promise<TwitterTimelineResponse> {
  try {
      console.log('Fetching user mention timeline...');
      const mentions = await this.client.v2.userMentionTimeline(
          await this.getCurrentUserId(),
          {
              max_results: 10,
              "tweet.fields": ["created_at", "public_metrics"]
          }
      );

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