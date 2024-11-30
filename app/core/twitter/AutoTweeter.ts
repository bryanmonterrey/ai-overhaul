// app/core/twitter/AutoTweeter.ts

import { PersonalitySystem } from '../personality/PersonalitySystem';
import { TweetStyle } from '../personality/types';

interface QueuedTweet {
  id: string;
  content: string;
  style: TweetStyle;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export class AutoTweeter {
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private minTimeBetweenTweets = 30 * 60 * 1000; // 30 minutes
  private nextTweetTimeout?: NodeJS.Timeout;

  constructor(
    private personality: PersonalitySystem,
    private twitterService: any // Your Twitter service
  ) {}

  public async generateTweetBatch(count: number = 10): Promise<void> {
    const newTweets: QueuedTweet[] = [];
    
    for (let i = 0; i < count; i++) {
      const style = this.personality.getCurrentTweetStyle();
      const content = await this.personality.processInput(
        'Generate a tweet', 
        { platform: 'twitter', style }
      );

      newTweets.push({
        id: crypto.randomUUID(),
        content: this.cleanTweet(content),
        style,
        status: 'pending',
        generatedAt: new Date()
      });
    }

    this.queuedTweets = [...this.queuedTweets, ...newTweets];
  }

  private cleanTweet(tweet: string): string {
    return tweet
      .replace(/\[(\w+)_state\]$/, '') // Remove state markers
      .trim();
  }

  public updateTweetStatus(id: string, status: 'approved' | 'rejected'): void {
    this.queuedTweets = this.queuedTweets.map(tweet => 
      tweet.id === id ? { ...tweet, status } : tweet
    );

    if (status === 'approved' && this.isAutoMode) {
      this.scheduleNextTweet();
    }
  }

  public toggleAutoMode(enabled: boolean): void {
    this.isAutoMode = enabled;
    if (enabled) {
      this.scheduleNextTweet();
    } else {
      if (this.nextTweetTimeout) {
        clearTimeout(this.nextTweetTimeout);
      }
    }
  }

  private getOptimalTweetTime(): Date {
    const now = new Date();
    const hour = now.getHours();
    
    // Avoid tweeting during low engagement hours (11 PM - 6 AM)
    if (hour >= 23 || hour < 6) {
      now.setHours(7, 0, 0, 0); // Set to 7 AM
      if (hour >= 23) now.setDate(now.getDate() + 1);
    }
    
    return now;
  }

  private async scheduleNextTweet(): Promise<void> {
    if (!this.isAutoMode) return;

    const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
    if (approvedTweets.length === 0) return;

    const nextTweet = approvedTweets[0];
    const optimalTime = this.getOptimalTweetTime();
    const delay = Math.max(
      optimalTime.getTime() - Date.now(),
      this.minTimeBetweenTweets
    );

    nextTweet.scheduledFor = new Date(Date.now() + delay);

    this.nextTweetTimeout = setTimeout(async () => {
      try {
        await this.twitterService.postTweet(nextTweet.content);
        
        // Remove posted tweet from queue
        this.queuedTweets = this.queuedTweets.filter(t => t.id !== nextTweet.id);
        
        // Schedule next tweet if there are more
        this.scheduleNextTweet();
      } catch (error) {
        console.error('Error posting tweet:', error);
        // Retry in 5 minutes if failed
        setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
      }
    }, delay);
  }

  public getQueuedTweets(): QueuedTweet[] {
    return this.queuedTweets;
  }

  public clearRejectedTweets(): void {
    this.queuedTweets = this.queuedTweets.filter(t => t.status !== 'rejected');
  }
}