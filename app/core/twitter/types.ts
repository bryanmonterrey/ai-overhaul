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
  tweet: (content: string, options?: TweetOptions) => Promise<TwitterResponse>;
  userTimeline: (options?: TwitterTimelineOptions) => Promise<TwitterTimelineResponse>;
  userMentionTimeline: () => Promise<TwitterTimelineResponse>;
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

// Add interface for the third parameter in processInput
export interface PersonalitySystem {
  processInput(
    input: string,
    context?: any,
    examples?: any[]
  ): Promise<string>;
}