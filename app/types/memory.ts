// app/types/memory.ts
import { EmotionalState, Platform } from '@/app/core/types';

export type MemoryType = 
  | 'chat_history'
  | 'tweet_history'
  | 'trading_params'
  | 'trading_history'
  | 'custom_prompts'
  | 'agent_state'
  | 'user_interaction';

export interface BaseMemory {
  key: string;
  memory_type: MemoryType;
  metadata?: Record<string, any>;
}

export interface ChatMemory extends BaseMemory {
  memory_type: 'chat_history';
  data: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    context?: string;
  };
}

export interface TweetMemory extends BaseMemory {
  memory_type: 'tweet_history';
  data: {
    generated_tweets: Array<{
      content: string;
      timestamp: string;
      metadata?: Record<string, any>;
    }>;
  };
}

export interface MemoryResponse {
    success: boolean;
    data?: Record<string, any>;
    error?: string;
  }

export interface TradingParamsMemory extends BaseMemory {
  memory_type: 'trading_params';
  data: {
    strategies: Record<string, any>;
    risk_parameters: Record<string, any>;
    custom_settings: Record<string, any>;
  };
}

export interface CustomPromptMemory extends BaseMemory {
  memory_type: 'custom_prompts';
  data: {
    prompt_template: string;
    variables: Record<string, any>;
    results: Array<{
      input: Record<string, any>;
      output: string;
      timestamp: string;
    }>;
  };
}

export interface AgentStateMemory extends BaseMemory {
  memory_type: 'agent_state';
  data: {
    current_state: string;
    context: Record<string, any>;
    last_update: string;
  };
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }
  
  export interface Memory {
    data: {
      messages: Message[];
    };
    metadata: {
      platform: Platform;
      personalityState: any; // Replace with your PersonalityState type
      emotionalState: any; // Replace with your EmotionalState type
    };
  }
  
  export interface MemoryQueryResult {
    data: {
      memories: Memory[];
    };
  }