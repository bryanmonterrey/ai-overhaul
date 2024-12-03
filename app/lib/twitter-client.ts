// app/lib/twitter-client.ts
import { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';
import type { TwitterApi as TwitterApiType, TTweetv2Expansion } from 'twitter-api-v2';

let TwitterApi: typeof TwitterApiType;
try {
    TwitterApi = require('twitter-api-v2').TwitterApi;
} catch (e) {
    console.error('Failed to load twitter-api-v2:', e);
    throw e;
}

// Twitter API endpoint names
const ENDPOINTS = {
    TWEETS: '2/tweets',
    USER_TIMELINE: '2/users/:id/tweets',
    USER_MENTIONS: '2/users/:id/mentions',
    USER_ME: '2/users/me',
    USER_BY_USERNAME: '2/users/by/username/:username'
} as const;

export class TwitterApiClient implements TwitterClient {
    private client: TwitterApiType;
    private lastReset: number = 0;
    private remainingRequests: number = 300;
    private endpointRateLimits: Map<string, {
        limit: number;
        remaining: number;
        reset: number;
        lastRequest?: number;
    }> = new Map();

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
            
            // Initialize rate limits for endpoints
            Object.values(ENDPOINTS).forEach(endpoint => {
                this.endpointRateLimits.set(endpoint, {
                    limit: 300,
                    remaining: 300,
                    reset: Date.now() + (15 * 60 * 1000),
                    lastRequest: undefined
                });
            });

        } catch (e) {
            console.error('Failed to initialize Twitter client:', e);
            throw e;
        }
    }

    private updateRateLimit(endpoint: string, rateLimit: any) {
      if (rateLimit) {
          const currentTime = Date.now();
          this.endpointRateLimits.set(endpoint, {
              limit: rateLimit.limit || 300,
              remaining: rateLimit.remaining || 0,
              reset: rateLimit.reset ? (rateLimit.reset * 1000) : (currentTime + 15 * 60 * 1000),
              lastRequest: currentTime
          });

          console.log(`Rate limit updated for ${endpoint}:`, {
              limit: rateLimit.limit,
              remaining: rateLimit.remaining,
              resetIn: Math.round((rateLimit.reset * 1000 - currentTime) / 1000) + ' seconds'
          });
      }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
      const rateLimit = this.endpointRateLimits.get(endpoint);
      if (!rateLimit) return;

      const now = Date.now();
      
      // If last request was too recent, add a small delay
      if (rateLimit.lastRequest && (now - rateLimit.lastRequest < 1000)) {
          await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (rateLimit.remaining <= 1) {
          const resetTime = new Date(rateLimit.reset);
          const waitTime = Math.max(0, resetTime.getTime() - now) + 1000;
          
          console.log(`Rate limit precaution for ${endpoint}:`, {
              resetTime: resetTime.toISOString(),
              waitTimeSeconds: Math.floor(waitTime / 1000),
              remainingRequests: rateLimit.remaining
          });
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
      }
  }

  private async handleRateLimit(error: any, endpoint: string) {
      try {
          const resetTime = error.rateLimit?.reset 
              ? new Date(error.rateLimit.reset * 1000)
              : new Date(Date.now() + 15 * 60 * 1000);

          const waitTime = Math.max(0, resetTime.getTime() - Date.now()) + 2000;
          
          this.updateRateLimit(endpoint, {
              limit: error.rateLimit?.limit || 300,
              remaining: 0,
              reset: resetTime.getTime() / 1000
          });
          
          console.log(`Rate limit hit for ${endpoint}:`, {
              resetTime: resetTime.toISOString(),
              waitTimeSeconds: Math.round(waitTime / 1000)
          });

          await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (e) {
          console.error('Error in rate limit handler:', e);
          await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      }
  }

  private async getUserIdByUsername(username: string): Promise<string> {
      try {
          await this.checkRateLimit(ENDPOINTS.USER_BY_USERNAME);
          
          console.log('Looking up user ID for username:', username);
          const user = await this.client.v2.userByUsername(username);
          
          this.updateRateLimit(ENDPOINTS.USER_BY_USERNAME, user.rateLimit);

          if (!user.data) {
              throw new Error(`User not found: ${username}`);
          }
          
          console.log(`Resolved username ${username} to ID ${user.data.id}`);
          return user.data.id;
      } catch (error: any) {
          if (error.code === 429) {
              await this.handleRateLimit(error, ENDPOINTS.USER_BY_USERNAME);
              return this.getUserIdByUsername(username);
          }
          console.error('Error getting user ID:', error);
          throw new Error(`Failed to get user ID for username: ${username}`);
      }
  }

  async tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse> {
    try {
        console.log('Posting tweet:', { content, options });
        await this.checkRateLimit(ENDPOINTS.TWEETS);

        const MIN_TWEET_INTERVAL = 30 * 1000; // 30 seconds minimum between tweets
        await new Promise(resolve => setTimeout(resolve, MIN_TWEET_INTERVAL));

        let tweet;
        try {
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
            
            this.updateRateLimit(ENDPOINTS.TWEETS, tweet.rateLimit);
            
            console.log('Tweet posted successfully:', {
                id: tweet.data.id,
                text: tweet.data.text,
                isReply: !!options?.reply
            });

        } catch (tweetError: any) {
            if (tweetError.code === 429) {
                await this.handleRateLimit(tweetError, ENDPOINTS.TWEETS);
                return this.tweet(content, options);
            }
            throw tweetError;
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
        console.error('Error posting tweet:', {
            error,
            code: error.code,
            message: error.message,
            rateLimit: error.rateLimit,
            data: error.data
        });
        throw error;
    }
}

async userTimeline(options?: { 
    user_id?: string; 
    max_results?: number; 
    exclude?: Array<'retweets' | 'replies'> 
}): Promise<TwitterTimelineResponse> {
    try {
        console.log('Starting userTimeline request with options:', options);
        await this.checkRateLimit(ENDPOINTS.USER_TIMELINE);

        let userId: string;
        try {
            if (options?.user_id) {
                if (!options.user_id.match(/^\d+$/)) {
                    userId = await this.getUserIdByUsername(options.user_id);
                } else {
                    userId = options.user_id;
                }
            } else {
                userId = await this.getCurrentUserId();
            }
        } catch (userError) {
            console.error('Error getting user ID:', userError);
            throw userError;
        }

        console.log('Fetching timeline for user ID:', userId);

        const timelineParams = {
            "max_results": options?.max_results || 10,
            "tweet.fields": ["created_at", "public_metrics", "author_id", "conversation_id"],
            "user.fields": ["username", "name"],
            "expansions": ["author_id"] as TTweetv2Expansion[]
        };

        const timeline = await this.client.v2.userTimeline(userId, timelineParams);
        this.updateRateLimit(ENDPOINTS.USER_TIMELINE, timeline.rateLimit);

        const tweets = timeline.data.data || [];
        console.log('Timeline fetched:', {
            userId,
            tweetsFound: tweets.length,
            firstTweet: tweets[0]?.text,
            rateLimit: timeline.rateLimit
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
            await this.handleRateLimit(error, ENDPOINTS.USER_TIMELINE);
            return this.userTimeline(options);
        }

        console.error('Timeline fetch error:', {
            message: error.message,
            code: error.code,
            data: error.data,
            type: error.type,
            rateLimit: error.rateLimit
        });

        if (process.env.NODE_ENV === 'development') {
            return { data: { data: [] } };
        }
        throw error;
    }
}

async userMentionTimeline(): Promise<TwitterTimelineResponse> {
  try {
      console.log('Fetching user mention timeline...');
      await this.checkRateLimit(ENDPOINTS.USER_MENTIONS);

      const userId = await this.getCurrentUserId();
      const mentions = await this.client.v2.userMentionTimeline(userId, {
          max_results: 10,
          "tweet.fields": ["created_at", "public_metrics", "conversation_id", "referenced_tweets"],
          "user.fields": ["username", "name"],
          "expansions": ["author_id"] as TTweetv2Expansion[]
      });

      this.updateRateLimit(ENDPOINTS.USER_MENTIONS, mentions.rateLimit);

      const tweets = mentions.data.data || [];
      console.log('Mentions response:', {
          mentionsFound: tweets.length,
          firstMention: tweets[0]?.text,
          rateLimit: mentions.rateLimit
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
          await this.handleRateLimit(error, ENDPOINTS.USER_MENTIONS);
          return this.userMentionTimeline();
      }
      console.error('Error fetching mentions:', error);
      throw new Error(error.message || 'Failed to fetch mentions');
  }
}

private async getCurrentUserId(): Promise<string> {
  try {
      await this.checkRateLimit(ENDPOINTS.USER_ME);
      const me = await this.client.v2.me();
      this.updateRateLimit(ENDPOINTS.USER_ME, me.rateLimit);
      return me.data.id;
  } catch (error: any) {
      if (error.code === 429) {
          await this.handleRateLimit(error, ENDPOINTS.USER_ME);
          return this.getCurrentUserId();
      }
      console.error('Error getting current user ID:', error);
      throw new Error('Failed to get current user ID');
  }
}

// Method to get rate limit status for debugging
public getRateLimitStatus(): Record<string, any> {
  const status: Record<string, any> = {};
  for (const [endpoint, limit] of this.endpointRateLimits.entries()) {
      status[endpoint] = {
          remaining: limit.remaining,
          resetIn: Math.round((limit.reset - Date.now()) / 1000) + ' seconds',
          lastRequest: limit.lastRequest ? new Date(limit.lastRequest).toISOString() : 'never'
      };
  }
  return status;
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
  
  // Log initial rate limit status
  console.log('Twitter client initialized with rate limits:', 
      twitterClientInstance.getRateLimitStatus()
  );
}
return twitterClientInstance;
}