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

const RATE_LIMITS = {
   TWEETS: {
       WINDOW: 15 * 60 * 1000,
       LIMIT: 50,
       MIN_DELAY: 30 * 1000
   },
   TIMELINE: {
       WINDOW: 15 * 60 * 1000,
       LIMIT: 180,
       MIN_DELAY: 5 * 1000
   }
} as const;

const ENDPOINTS = {
   TWEETS: '/2/tweets',
   USER_TIMELINE: '/2/users/:id/tweets',
   USER_MENTIONS: '/2/users/:id/mentions',
   USER_ME: '/2/users/me',
   USER_BY_USERNAME: '/2/users/by/username/:username',
   TWEET_COUNTS: '/2/tweets/counts/recent',
   TWEET_SEARCH: '/2/tweets/search/recent',
   TWEET_LOOKUP: '/2/tweets/:id',
   USER_LOOKUP: '/2/users/:id'
} as const;

export class TwitterApiClient implements TwitterClient {
   private client: TwitterApiType;
   private endpointRateLimits: Map<string, {
       limit: number;
       remaining: number;
       reset: number;
       lastRequest?: number;
       window: number;
       minDelay: number;
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

           Object.values(ENDPOINTS).forEach(endpoint => {
               const isPostEndpoint = endpoint.startsWith('/2/tweets');
               const limits = isPostEndpoint ? RATE_LIMITS.TWEETS : RATE_LIMITS.TIMELINE;

               this.endpointRateLimits.set(endpoint, {
                   limit: limits.LIMIT,
                   remaining: limits.LIMIT,
                   reset: Date.now() + limits.WINDOW,
                   lastRequest: undefined,
                   window: limits.WINDOW,
                   minDelay: limits.MIN_DELAY
               });
           });
       } catch (e) {
           console.error('Failed to initialize Twitter client:', e);
           throw e;
       }
   }

   private async enforceMinDelay(endpoint: string): Promise<void> {
       const rateLimit = this.endpointRateLimits.get(endpoint);
       if (!rateLimit?.lastRequest) return;

       const timeSinceLastRequest = Date.now() - rateLimit.lastRequest;
       if (timeSinceLastRequest < rateLimit.minDelay) {
           const delayNeeded = rateLimit.minDelay - timeSinceLastRequest;
           await new Promise(resolve => setTimeout(resolve, delayNeeded));
       }
   }

   private updateRateLimit(endpoint: string, rateLimit: any) {
       const currentLimit = this.endpointRateLimits.get(endpoint);
       if (!currentLimit) return;

       const currentTime = Date.now();
       const isPostEndpoint = endpoint.startsWith('/2/tweets');
       const defaultLimit = isPostEndpoint ? RATE_LIMITS.TWEETS.LIMIT : RATE_LIMITS.TIMELINE.LIMIT;

       this.endpointRateLimits.set(endpoint, {
           ...currentLimit,
           limit: rateLimit?.limit || defaultLimit,
           remaining: rateLimit?.remaining || 0,
           reset: rateLimit?.reset ? (rateLimit.reset * 1000) : (currentTime + currentLimit.window),
           lastRequest: currentTime
       });

       console.log(`Rate limit updated for ${endpoint}:`, {
           limit: rateLimit?.limit || defaultLimit,
           remaining: rateLimit?.remaining || 0,
           resetIn: Math.round((rateLimit?.reset ? rateLimit.reset * 1000 : currentTime + currentLimit.window - currentTime) / 1000)
       });
   }

   private async handleRateLimit(error: any, endpoint: string) {
       try {
           console.log('Rate limit error details:', { endpoint, error });

           let resetTime: Date;
           if (error.rateLimit?.reset) {
               resetTime = new Date(error.rateLimit.reset * 1000);
           } else {
               const currentLimit = this.endpointRateLimits.get(endpoint);
               resetTime = new Date(Date.now() + (currentLimit?.window || 15 * 60 * 1000));
           }

           const maxResetTime = new Date(Date.now() + 15 * 60 * 1000);
           if (resetTime > maxResetTime) {
               console.warn('Reset time too far in future, using 15 minute default');
               resetTime = maxResetTime;
           }

           const waitTime = Math.max(0, resetTime.getTime() - Date.now()) + 2000;
           console.log(`Rate limit hit for ${endpoint}:`, {
               resetTime: resetTime.toISOString(),
               waitTimeSeconds: Math.round(waitTime / 1000)
           });

           await new Promise(resolve => setTimeout(resolve, waitTime));
       } catch (e) {
           console.error('Error handling rate limit:', e);
           await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
       }
   }

   private async getUserIdByUsername(username: string): Promise<string> {
       try {
           await this.enforceMinDelay(ENDPOINTS.USER_BY_USERNAME);
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
           throw error;
       }
   }

   async tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse> {
       try {
           await this.enforceMinDelay(ENDPOINTS.TWEETS);
           await this.checkRateLimit(ENDPOINTS.TWEETS);

           console.log('Posting tweet:', { content, options });

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
                   await this.handleRateLimit(error, ENDPOINTS.TWEETS);
                   return this.tweet(content, options);
               }
               throw error;
           }
       } catch (error: any) {
           console.error('Error posting tweet:', error);
           throw error;
       }
   }

   async userTimeline(options?: { 
       user_id?: string; 
       max_results?: number; 
       exclude?: Array<'retweets' | 'replies'> 
   }): Promise<TwitterTimelineResponse> {
       try {
           await this.enforceMinDelay(ENDPOINTS.USER_TIMELINE);
           await this.checkRateLimit(ENDPOINTS.USER_TIMELINE);

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

           const timelineParams = {
               max_results: options?.max_results || 10,
               "tweet.fields": ["created_at", "public_metrics", "author_id", "conversation_id"],
               "user.fields": ["username", "name"],
               "expansions": ["author_id"] as TTweetv2Expansion[]
           };

           const timeline = await this.client.v2.userTimeline(userId, timelineParams);
           this.updateRateLimit(ENDPOINTS.USER_TIMELINE, timeline.rateLimit);

           return {
               data: {
                   data: (timeline.data.data || []).map(tweet => ({
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
           throw error;
       }
   }

   async userMentionTimeline(): Promise<TwitterTimelineResponse> {
       try {
           await this.enforceMinDelay(ENDPOINTS.USER_MENTIONS);
           await this.checkRateLimit(ENDPOINTS.USER_MENTIONS);

           const userId = await this.getCurrentUserId();
           const mentions = await this.client.v2.userMentionTimeline(userId, {
               max_results: 10,
               "tweet.fields": ["created_at", "public_metrics", "conversation_id", "referenced_tweets"],
               "user.fields": ["username", "name"],
               "expansions": ["author_id"] as TTweetv2Expansion[]
           });

           this.updateRateLimit(ENDPOINTS.USER_MENTIONS, mentions.rateLimit);

           return {
               data: {
                   data: (mentions.data.data || []).map(tweet => ({
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
           throw error;
       }
   }

   private async getCurrentUserId(): Promise<string> {
       try {
           await this.enforceMinDelay(ENDPOINTS.USER_ME);
           await this.checkRateLimit(ENDPOINTS.USER_ME);
           
           const me = await this.client.v2.me();
           this.updateRateLimit(ENDPOINTS.USER_ME, me.rateLimit);
           return me.data.id;
       } catch (error: any) {
           if (error.code === 429) {
               await this.handleRateLimit(error, ENDPOINTS.USER_ME);
               return this.getCurrentUserId();
           }
           throw error;
       }
   }

   public getRateLimitStatus(): Record<string, any> {
       const status: Record<string, any> = {};
       for (const [endpoint, limit] of this.endpointRateLimits.entries()) {
           status[endpoint] = {
               remaining: limit.remaining,
               resetIn: Math.round((limit.reset - Date.now()) / 1000) + ' seconds',
               lastRequest: limit.lastRequest ? new Date(limit.lastRequest).toISOString() : 'never',
               minDelay: limit.minDelay / 1000 + ' seconds'
           };
       }
       return status;
   }
}

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
       console.log('Twitter client initialized with rate limits:', 
           twitterClientInstance.getRateLimitStatus()
       );
   }
   return twitterClientInstance;
}