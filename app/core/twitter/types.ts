// Types for Twitter API requests
interface TwitterTimelineOptions {
  user_id?: string;
  max_results?: number;
  exclude?: string[];
}

interface TweetOptions {
  reply?: {
    in_reply_to_tweet_id: string;
  };
}

export interface TwitterClient {
  tweet: (content: string, options?: { reply?: { in_reply_to_tweet_id: string } }) => Promise<TwitterResponse>;
  userTimeline: (options?: { user_id: string; max_results?: number; exclude?: string[] }) => Promise<TwitterTimelineResponse>;
  userMentionTimeline: (options?: { max_results?: number }) => Promise<TwitterTimelineResponse>;
}

export interface TwitterMetrics {
  like_count: number;
  retweet_count: number;
  reply_count: number;
}

export interface TwitterData {
  id: string;
  text: string;
  public_metrics?: TwitterMetrics;
  created_at?: string;
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