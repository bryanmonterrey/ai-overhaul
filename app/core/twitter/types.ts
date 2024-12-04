
interface TweetOptions {
  reply?: {
    in_reply_to_tweet_id: string;
  };
}

export interface TweetStyle {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    formality?: 'casual' | 'formal';
}

export interface ContextData {
  platform: 'twitter';
  environmentalFactors: {
      timeOfDay: string;
      platformActivity: number;
      socialContext: string[];
      platform: string;
  };
  style: TweetStyle;
  additionalContext: {
      originalTweet?: string;
      replyingTo?: string;
      topics?: string[];
      relationship?: string;
  };
}


export interface ReplyContext {
  type: 'mention' | 'reply';
  content: string;
  user: string;
}

// app/core/twitter/types.ts
export interface TwitterClient {
  tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse>;
  userTimeline(options?: {
      user_id?: string;
      max_results?: number;
      exclude?: string[];
      'tweet.fields'?: string[];
      'user.fields'?: string[];
      expansions?: string[];
  }): Promise<TwitterTimelineResponse>;
  userMentionTimeline(): Promise<TwitterTimelineResponse>;
}

export type TwitterTimelineOptions = Parameters<TwitterClient['userTimeline']>[0];

export interface TwitterMetrics {
  like_count: number;
  retweet_count: number;
  reply_count: number;
}

export interface TwitterData {
  id: string;
  text: string;
  author_id?: string;
  public_metrics?: TwitterMetrics;
  created_at?: string;
  in_reply_to_user_id?: string;
  referenced_tweet_ids?: string[];
}

export interface TwitterResponse {
  data: TwitterData;
}

export interface TwitterManager {
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface TwitterTimelineResponse {
  data: {
    data: TwitterData[];
  };
}

export interface TweetStats {
  getStats(): any;
  reset(): void;
  increment(status: string): void;
}

export interface LastInteraction {
  timestamp: string;
}

export interface TweetV2 extends TwitterData {
  edit_history_tweet_ids?: string[];
}

export interface TwitterClientV2 extends TwitterClient {
  v2: {
    tweet: (content: string | { text: string, reply?: { in_reply_to_tweet_id: string } }) => Promise<{ data: TweetV2 }>;
    userTimeline: (userId: string, options?: any) => Promise<{ data: { data: TweetV2[] } }>;
    userMentionTimeline: (userId: string, options?: any) => Promise<{ data: { data: TweetV2[] } }>;
    me: () => Promise<{ data: { id: string } }>;
  };
}

// Add interface for the third parameter in processInput
export interface PersonalitySystem {
  processInput(
    input: string,
    context?: any,
    examples?: any[]
  ): Promise<string>;
}

export interface TwitterClientWithV2 extends TwitterClient {
  tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse>;
}