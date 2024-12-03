import { TwitterError, TwitterRateLimitError, TwitterAuthError, TwitterNetworkError, TwitterDataError } from './twitter-errors';
import type { TwitterClient, TwitterData } from './types';
import type { EngagementTargetRow } from '@/app/types/supabase';
import { PersonalitySystem } from '../personality/PersonalitySystem';
import { Context, TweetStyle } from '../personality/types';
import { TweetStats } from './TweetStats';
import { SupabaseClient } from '@supabase/supabase-js';

interface QueuedTweet {
  id: string;
  content: string;
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

interface ReplyContext {
    type?: 'mention' | 'reply';
    content?: string;
    user: string;
}

export class TwitterManager {
private client: TwitterClient;
  private supabase: SupabaseClient;
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private nextTweetTimeout?: NodeJS.Timeout;
  private isReady: boolean = true;
  private recentTweets = new Map<string, any>();
  private hourlyEngagementWeights: Record<number, number> = {};
  private stats: TweetStats;
  private trainingService: any;
  private is24HourMode = false;
  private monitoringInterval?: NodeJS.Timeout;
private lastTweetTime: Date | null = null;
private isMonitoring: boolean = false;
    private lastMonitoringCheck: Date | null = null;
    private monitoringStats = {
        targetsChecked: 0,
        repliesSent: 0,
        lastError: null as Error | null
    };
  

  constructor(
    client: TwitterClient,
    private personality: PersonalitySystem,
    supabase: SupabaseClient,
    trainingService: any
) {
    this.client = client;
    this.supabase = supabase;
    this.stats = new TweetStats();
    this.trainingService = trainingService;
}

  // Your existing methods
  async postTweet(content: string): Promise<TwitterData> {
    try {
        console.log('Attempting to post tweet:', { content });

        if (content.length > 25000) {
            throw new TwitterDataError('Tweet exceeds Twitter Premium character limit');
        }

        if (!this.client?.tweet) {
            throw new TwitterError('Twitter client not initialized', 'INITIALIZATION_ERROR', 500);
        }

        const MIN_WAIT = 2 * 60 * 1000; // 2 minutes minimum between tweets
        const lastTweetTime = this.lastTweetTime?.getTime() || 0;
        const timeSinceLastTweet = Date.now() - lastTweetTime;
        
        if (timeSinceLastTweet < MIN_WAIT) {
            const waitTime = MIN_WAIT - timeSinceLastTweet;
            console.log(`Waiting ${Math.round(waitTime/1000)}s before next tweet`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
            const result = await this.client.tweet(content);
            this.lastTweetTime = new Date();
            this.recentTweets.set(result.data.id, {
                ...result.data,
                timestamp: this.lastTweetTime
            });

            if (this.recentTweets.size > 100) {
                const oldestKey = this.recentTweets.keys().next().value;
                this.recentTweets.delete(oldestKey);
            }

            return result.data;
        } catch (tweetError: any) {
            if (tweetError.code === 429) {
                const waitTime = 15 * 60 * 1000 + (Math.random() * 60000);
                console.log(`Rate limit hit, waiting ${Math.round(waitTime/1000)}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                const retryResult = await this.client.tweet(content);
                return retryResult.data;
            }
            throw tweetError;
        }
    } catch (error: any) {
        console.error('Error posting tweet:', {
            error,
            message: error.message,
            code: error.code,
            stack: error.stack,
            details: error.response?.data
        });

        if (error instanceof TwitterDataError) throw error;
        if (error.code === 429) throw new TwitterRateLimitError('Rate limit exceeded');
        if (error.code === 401 || error.message?.includes('Invalid credentials')) {
            throw new TwitterAuthError('Authentication failed');
        }
        if (error.message?.includes('timeout')) throw new TwitterNetworkError('Network timeout occurred');
        if (error.message?.includes('Failed')) throw new TwitterDataError('Thread creation failed');

        throw new TwitterNetworkError(`Network error occurred: ${error.message}`);
    }
}

private async syncQueueWithDatabase(): Promise<void> {
  try {
      const tweets = await this.getQueuedTweets();
      this.queuedTweets = tweets;
      console.log('Queue synced with database:', {
          queueLength: this.queuedTweets.length,
          approvedCount: this.queuedTweets.filter(t => t.status === 'approved').length
      });
  } catch (error) {
      console.error('Error syncing queue with database:', error);
  }
}

  // Auto-tweeter methods
  public async generateTweetBatch(count: number = 10): Promise<void> {
    const newTweets: Omit<QueuedTweet, 'id'>[] = [];
    
    for (let i = 0; i < count; i++) {
        const style = this.personality.getCurrentTweetStyle();
        const content = await this.personality.processInput(
            'Generate a tweet', 
            { platform: 'twitter', style }
        );

        newTweets.push({
            content: this.cleanTweet(content),
            style,
            status: 'pending',
            generatedAt: new Date()
        });
    }

    await this.addTweetsToQueue(newTweets);
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

  public async updateTweetStatus(
    id: string, 
    status: 'approved' | 'rejected',
    scheduledTime?: Date
 ): Promise<void> {
    try {
        await this.syncQueueWithDatabase();
 
        console.log('Starting tweet status update:', {
            id,
            status,
            currentTime: new Date().toISOString()
        });
 
        const delay = this.getEngagementBasedDelay();
        const finalScheduledTime = status === 'approved' 
            ? (scheduledTime || new Date(Date.now() + delay))
            : null;
 
        console.log('Calculated scheduling details:', {
            delay,
            scheduledTime: finalScheduledTime?.toISOString(),
            isAutoMode: this.isAutoMode
        });
 
        const { data, error } = await this.supabase
            .from('tweet_queue')
            .update({ 
                status,
                scheduled_for: finalScheduledTime?.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
 
        if (error) {
            console.error('Database update error:', {
                error,
                operation: 'updateTweetStatus',
                tweetId: id
            });
            throw error;
        }
 
        console.log('Database update successful:', {
            updatedTweet: data?.[0],
            affectedRows: data?.length
        });
 
        const updatedQueue = this.queuedTweets.map(tweet => {
            if (tweet.id === id) {
                return {
                    ...tweet,
                    status,
                    scheduledFor: finalScheduledTime || undefined
                };
            }
            return tweet;
        });
 
        const oldQueueLength = this.queuedTweets.length;
        this.queuedTweets = updatedQueue;
        
        console.log('Local queue updated:', {
            previousLength: oldQueueLength,
            newLength: updatedQueue.length,
            approvedCount: updatedQueue.filter(t => t.status === 'approved').length
        });
 
        this.stats.increment(status);
 
        if (status === 'approved') {
            console.log('Tweet approved, preparing to schedule...');
            await this.persistAutoMode(true);
            await this.scheduleNextTweet();
            
            console.log('Scheduling process completed', {
                nextScheduledTweet: this.getNextScheduledTime()?.toISOString(),
                autoModeActive: this.isAutoMode
            });
        }
    } catch (error) {
        console.error('Error in updateTweetStatus:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            tweetId: id,
            requestedStatus: status
        });
        throw error;
    }
 }

public toggleAutoMode(enabled: boolean): void {
  console.log('Toggling auto mode:', {
      currentState: this.isAutoMode,
      newState: enabled
  });
  
  this.isAutoMode = enabled;
  if (enabled) {
      this.scheduleNextTweet().catch(error => {
          console.error('Error scheduling next tweet:', error);
      });
  } else {
      if (this.nextTweetTimeout) {
          clearTimeout(this.nextTweetTimeout);
      }
  }
}



  private async persistAutoMode(enabled: boolean): Promise<void> {
    const { error } = await this.supabase
        .from('system_settings')
        .upsert({ 
            key: 'twitter_auto_mode',
            value: enabled,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;
    this.isAutoMode = enabled;
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

  private async persistScheduledTweet(tweetId: string, scheduledTime: Date): Promise<void> {
    try {
        const { error } = await this.supabase
            .from('tweet_queue')
            .update({
                scheduled_for: scheduledTime.toISOString()
            })
            .eq('id', tweetId);

        if (error) {
            console.error('Error persisting scheduled tweet:', error);
            throw error;
        }
    } catch (error) {
        console.error('Failed to persist scheduled tweet:', error);
        throw error;
    }
}

private async scheduleNextTweet(): Promise<void> {
  try {
      console.log('Scheduling next tweet, automode:', this.isAutoMode);
      
      if (!this.isAutoMode) {
          console.log('Auto mode is disabled, not scheduling');
          return;
      }

      await this.syncQueueWithDatabase();

      const approvedTweets = this.queuedTweets
          .filter(t => t.status === 'approved')
          .sort((a, b) => {
              const timeA = a.scheduledFor?.getTime() || Infinity;
              const timeB = b.scheduledFor?.getTime() || Infinity;
              return timeA - timeB;
          });

      console.log('Found approved tweets:', approvedTweets.length);
      
      if (approvedTweets.length === 0) {
          console.log('No approved tweets to schedule');
          return;
      }

      const nextTweet = approvedTweets[0];
      
      if (!nextTweet.scheduledFor) {
          console.log('Next tweet has no scheduled time:', nextTweet);
          return;
      }

      const now = new Date().getTime();
      const scheduledTime = nextTweet.scheduledFor.getTime();
      const delay = Math.max(0, scheduledTime - now);

      console.log('Scheduling details:', {
          tweetId: nextTweet.id,
          content: nextTweet.content,
          scheduledTime: nextTweet.scheduledFor.toISOString(),
          delay: delay
      });

      if (this.nextTweetTimeout) {
          clearTimeout(this.nextTweetTimeout);
      }

      this.nextTweetTimeout = setTimeout(async () => {
          try {
              console.log('Executing scheduled tweet:', nextTweet);
              await this.postTweet(nextTweet.content);
              
              // Remove from database and local queue
              await this.supabase
                  .from('tweet_queue')
                  .delete()
                  .eq('id', nextTweet.id);
                  
              this.queuedTweets = this.queuedTweets
                  .filter(t => t.id !== nextTweet.id);
              
              console.log('Tweet posted successfully, scheduling next');
              this.scheduleNextTweet();
          } catch (error) {
              console.error('Failed to post scheduled tweet:', error);
              setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
          }
      }, delay);
  } catch (error) {
      console.error('Error in scheduleNextTweet:', error);
  }
}

public async getQueuedTweets(): Promise<QueuedTweet[]> {
  try {
      // First check if table exists by attempting a count
      const { count, error: countError } = await this.supabase
          .from('tweet_queue')
          .select('*', { count: 'exact', head: true });

      console.log('Tweet queue table check:', {
          count,
          error: countError,
          exists: !countError
      });

      if (countError) {
          console.log('Tweet queue table might not exist:', countError);
          return [];
      }

      // If table exists, get tweets
      const { data, error } = await this.supabase
          .from('tweet_queue')
          .select('*')
          .order('created_at', { ascending: false });

      console.log('Tweet queue fetch results:', {
          data,
          error,
          hasData: !!data,
          count: data?.length,
          approvedCount: data?.filter(t => t.status === 'approved').length
      });

      if (error) {
          console.error('Error fetching tweets:', error);
          return [];
      }

      if (!data) {
          console.log('No data returned from tweet queue');
          return [];
      }

      const mappedTweets = data.map(tweet => ({
          id: tweet.id,
          content: tweet.content,
          style: tweet.style,
          status: tweet.status,
          generatedAt: new Date(tweet.generated_at),
          scheduledFor: tweet.scheduled_for ? new Date(tweet.scheduled_for) : undefined
      }));

      console.log('Mapped tweets:', {
          totalTweets: mappedTweets.length,
          approvedTweets: mappedTweets.filter(t => t.status === 'approved').length,
          scheduledTweets: mappedTweets.filter(t => t.scheduledFor).length
      });

      return mappedTweets;
  } catch (error) {
      console.error('Error in getQueuedTweets:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
      });
      return [];
  }
}

public async addTweetsToQueue(tweets: Omit<QueuedTweet, 'id'>[]): Promise<void> {
  const { error } = await this.supabase
      .from('tweet_queue')
      .insert(
          tweets.map(tweet => ({
              content: tweet.content,
              style: tweet.style,
              status: tweet.status,
              generated_at: tweet.generatedAt.toISOString(),
              scheduled_for: tweet.scheduledFor?.toISOString()
          }))
      );

  if (error) {
      console.error('Error adding tweets to queue:', error);
      throw error;
  }
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

  // Add this method after getEnvironmentalFactors
  private async trackEngagement() {
    try {
        const timeline = await this.client.userTimeline();
        const tweets = timeline.data.data || []; // Access the correct data property
        
        // Analyze engagement patterns
        const engagementData = tweets.map((tweet: {
            created_at?: string;
            public_metrics?: {
                like_count: number;
                retweet_count: number;
                reply_count: number;
            }
        }) => ({
            hour: new Date(tweet.created_at || '').getHours(),
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0
        }));

        // Update your engagement patterns based on this data
        this.updateEngagementPatterns(engagementData);
    } catch (error) {
        console.error('Error tracking engagement:', error);
    }
}

  // Add this method to handle the engagement data
  private updateEngagementPatterns(engagementData: Array<{
    hour: number;
    likes: number;
    retweets: number;
    replies: number;
}>) {
    // Group by hour
    const hourlyEngagement = engagementData.reduce((acc, data) => {
        if (!acc[data.hour]) {
            acc[data.hour] = {
                totalEngagement: 0,
                count: 0
            };
        }
        
        const engagement = data.likes + data.retweets + data.replies;
        acc[data.hour].totalEngagement += engagement;
        acc[data.hour].count++;
        
        return acc;
    }, {} as Record<number, { totalEngagement: number; count: number }>);

    // Calculate average engagement per hour
    this.hourlyEngagementWeights = Object.entries(hourlyEngagement).reduce((acc, [hour, data]) => {
        acc[parseInt(hour)] = data.totalEngagement / data.count;
        return acc;
    }, {} as Record<number, number>);
}

private getEngagementBasedDelay(): number {
    if (this.is24HourMode) return 0;
    
    const minDelay = 15 * 60 * 1000;  // 15 minutes
    const maxDelay = 30 * 60 * 1000;  // 30 minutes
    const baseDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    const hour = new Date().getHours();
    const weight = this.hourlyEngagementWeights[hour] || 0.5;
    return Math.floor(baseDelay * (1 + (1 - weight)));
}

  // Engagement-related methods
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
                
                // Update last interaction time
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

private shouldReplyToTweet(tweet: any, target: EngagementTargetRow): boolean {
    // Reply based on probability alone
    return Math.random() < target.reply_probability;
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
            style: target.preferred_style as TweetStyle,
            additionalContext: JSON.stringify({
                originalTweet: tweet.text,
                replyingTo: target.username,
                topics: target.topics,
                relationship: target.relationship_level
            }),
            trainingExamples: await this.trainingService.getTrainingExamples(3, 'replies')
        };

        console.log('Generating reply for target:', {
            username: target.username,
            tweetText: tweet.text,
            context
        });

        const reply = await this.personality.processInput(
            `Generate a reply to: ${tweet.text}`,
            context as unknown as Partial<Context>
        );

        if (reply) {
            console.log('Sending reply:', {
                to: target.username,
                replyText: reply,
                originalTweet: tweet.id
            });

            await this.client.tweet(reply, {
                reply: {
                    in_reply_to_tweet_id: tweet.id
                }
            });

            this.monitoringStats.repliesSent++;
            console.log(`Reply sent to ${target.username}:`, reply);

            // First get the current total_interactions
            const { data: currentTarget } = await this.supabase
                .from('engagement_targets')
                .select('total_interactions')
                .eq('id', target.id)
                .single();

            // Update last interaction time and increment total_interactions
            await this.supabase
                .from('engagement_targets')
                .update({ 
                    last_interaction: new Date().toISOString(),
                    total_interactions: ((currentTarget?.total_interactions || 0) + 1)
                })
                .eq('id', target.id);
        }
    } catch (error) {
        console.error(`Error generating reply for ${target.username}:`, error);
        throw error;
    }
}

private async generateReply(context: ReplyContext): Promise<string | null> {
    try {
        console.log('Generating reply with context:', context);
        
        const reply = await this.personality.processInput(
            `Generate a reply to: ${context.content}`,
            {
                platform: 'twitter',
                additionalContext: JSON.stringify({
                    originalTweet: context.content,
                    replyingTo: context.user
                })
            }
        );

        console.log('Generated reply content:', reply);
        return reply;
    } catch (error) {
        console.error('Error generating reply:', error);
        return null;
    }
}

private async handleMention(mention: {
    created_at?: string;
    text?: string;
    id: string;
}): Promise<void> {
    try {
        console.log('Processing mention:', {
            id: mention.id,
            text: mention.text,
            created_at: mention.created_at
        });

        const lastCheck = await this.getLastInteractionTime();
        const mentionTime = new Date(mention.created_at || '');
  
        console.log('Time comparison:', {
            mentionTime: mentionTime.toISOString(),
            lastCheck: lastCheck.toISOString(),
            shouldReply: mentionTime > lastCheck
        });

        if (mentionTime > lastCheck) {
            console.log('Generating reply to mention...');
            // Remove unused context object and directly pass the required data
            const reply = await this.generateReply({
                type: 'mention',
                content: mention.text,
                user: mention.id
            });

            console.log('Generated reply:', { reply });

            if (reply) {
                console.log('Attempting to send reply...');
                await this.client.tweet(reply, {
                    reply: { in_reply_to_tweet_id: mention.id }
                });
                console.log('Reply sent successfully');
                
                // Update last interaction time
                await this.supabase
                    .from('last_interaction')
                    .upsert({
                        id: 1, // Use a constant ID for the single row
                        timestamp: new Date().toISOString()
                    });
            } else {
                console.log('No reply was generated');
            }
        } else {
            console.log('Skipping mention - older than last check');
        }
    } catch (error) {
        console.error('Error handling mention:', error);
        throw error;
    }
}

private async handleReply(tweet: {
    created_at?: string;
    text?: string;
    id: string;
}): Promise<void> {
    const lastCheck = await this.getLastInteractionTime();
    const replyTime = tweet.created_at ? new Date(tweet.created_at) : new Date();
  
    if (replyTime.getTime() > lastCheck.getTime()) {
        const context: Context = {
            platform: 'twitter',
            environmentalFactors: {
                timeOfDay: this.getTimeOfDay(),
                platformActivity: 0.5,
                socialContext: ['casual'],
                platform: 'twitter'
            },
            style: 'casual',
            additionalContext: JSON.stringify({
                originalTweet: tweet.text,
                replyingTo: tweet.id
            }),
            recentInteractions: [],
            activeNarratives: []
        };

        const reply = await this.personality.processInput(
            `Generate a reply to: ${tweet.text}`,
            context
        );

        if (reply) {
            await this.client.tweet(reply, {
                reply: { in_reply_to_tweet_id: tweet.id }
            });
        }
    }
}


public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
        console.log('Monitoring already running');
        return;
    }

    console.log('Starting Twitter monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
        try {
            this.lastMonitoringCheck = new Date();
            console.log('Running monitoring check at:', this.lastMonitoringCheck);

            // Monitor engagement targets
            const { data: targets, error: targetsError } = await this.supabase
                .from('engagement_targets')
                .select('*');

            if (targetsError) {
                throw new Error(`Failed to fetch targets: ${targetsError.message}`);
            }

            console.log(`Found ${targets?.length || 0} engagement targets to monitor`);
            
            if (targets) {
                for (const target of targets) {
                    await this.monitorTargetTweets(target);
                    this.monitoringStats.targetsChecked++;
                }
            }

            // Monitor mentions and replies
            const [mentions, replies] = await Promise.all([
                this.client.userMentionTimeline(),
                this.client.userTimeline({
                    user_id: process.env.TWITTER_USER_ID!,
                    max_results: 10
                })
            ]);

            console.log('Monitoring results:', {
                mentions: mentions.data.data?.length || 0,
                replies: replies.data.data?.length || 0
            });

            // Handle mentions
            for (const mention of mentions.data.data || []) {
                await this.handleMention(mention);
            }

            // Handle replies
            for (const tweet of replies.data.data || []) {
                await this.handleReply(tweet);
            }

        } catch (error) {
            console.error('Error in monitoring cycle:', error);
            this.monitoringStats.lastError = error as Error;
        }
    }, 2 * 60 * 1000); // Check every 2 minutes
}

public async getMonitoringStatus(): Promise<any> {
    return {
        isMonitoring: this.isMonitoring,
        lastCheck: this.lastMonitoringCheck,
        stats: this.monitoringStats,
        recentTweets: Array.from(this.recentTweets.values()).slice(0, 5)
    };
}

public stopMonitoring(): void {
    if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
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


public toggle24HourMode(enabled: boolean) {
    this.is24HourMode = enabled;
    if (enabled) {
        this.schedule24Hours().catch(console.error);
    }
}

private async schedule24Hours() {
    const baseTime = new Date();
    const tweets = await this.getQueuedTweets();
    const pendingTweets = tweets.filter(t => t.status === 'pending');
    
    // Spread tweets over 24 hours
    const interval = (24 * 60 * 60 * 1000) / (pendingTweets.length || 1);
    
    for (let i = 0; i < pendingTweets.length; i++) {
        const scheduledTime = new Date(baseTime.getTime() + (interval * i));
        await this.updateTweetStatus(pendingTweets[i].id, 'approved', scheduledTime);
    }
}

private async getLastInteractionTime(): Promise<Date> {
    try {
        const { data, error } = await this.supabase
            .from('last_interaction')
            .select('timestamp')
            .single();
        
        if (error) {
            console.error('Error fetching last interaction time:', error);
            // If there's an error, return a very old date to ensure we process messages
            return new Date(0);
        }
        
        console.log('Last interaction time from DB:', data?.timestamp);
        return data ? new Date(data.timestamp) : new Date(0);
    } catch (error) {
        console.error('Error in getLastInteractionTime:', error);
        return new Date(0);
    }
}

  public getRecentTweets() {
    return this.recentTweets;
  }

  public getTweetStats() {
    return this.stats.getStats();
  }

  public resetTweetStats(): void {
    this.stats?.reset();
  }
}