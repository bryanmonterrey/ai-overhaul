export interface TwitterClient {
  tweet: (content: string) => Promise<TwitterResponse>;
  userTimeline: () => Promise<TwitterTimelineResponse>;
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

export interface TwitterTimelineResponse {
  data: {
    data: TwitterData[];
  };
} 