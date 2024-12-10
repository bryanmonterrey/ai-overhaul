// app/lib/memory/memgpt-client.ts
import { 
    BaseMemory, 
    MemoryType,
    ChatMemory,
    TweetMemory,
    TradingParamsMemory,
    CustomPromptMemory,
    AgentStateMemory,
    MemoryResponse
  } from '@/app/types/memory';
import { useCallback } from 'react';
import { useState } from 'react';
  
  export class MemGPTClient {
    private baseUrl: string;
    private retryCount: number = 3;
  
    constructor(baseUrl = 'http://localhost:3001') {
      this.baseUrl = baseUrl;
    }

    private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        for (let i = 0; i < this.retryCount; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === this.retryCount - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        throw new Error('Operation failed after retries');
    }
  
    async storeMemory<T extends BaseMemory>(memory: T): Promise<MemoryResponse> {
      try {
        const response = await fetch(`${this.baseUrl}/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(memory),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error storing memory:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  
    async getMemory<T extends BaseMemory>(key: string, type: MemoryType): Promise<T | null> {
      try {
        const response = await fetch(`${this.baseUrl}/${key}?type=${type}`);
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        return data.success ? data.data : null;
      } catch (error) {
        console.error('Error retrieving memory:', error);
        return null;
      }
    }
  
    async queryMemories(type: MemoryType, query: Record<string, any>) {
      try {
        const response = await fetch(`${this.baseUrl}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type, query }),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error querying memories:', error);
        return null;
      }
    }
  }
  
  export function useMemGPT() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const client = new MemGPTClient();
  
    const storeChat = useCallback(async (messages: ChatMemory['data']['messages']) => {
      setLoading(true);
      try {
        return await client.storeMemory<ChatMemory>({
          key: `chat-${Date.now()}`,
          memory_type: 'chat_history',
          data: { messages }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);
  
    const storeTweet = useCallback(async (tweet: TweetMemory['data']['generated_tweets'][0]) => {
      setLoading(true);
      try {
        return await client.storeMemory<TweetMemory>({
          key: `tweet-${Date.now()}`,
          memory_type: 'tweet_history',
          data: {
            generated_tweets: [tweet]
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);
  
    const storeTrading = useCallback(async (params: TradingParamsMemory['data']) => {
      setLoading(true);
      try {
        return await client.storeMemory<TradingParamsMemory>({
          key: `trading-${Date.now()}`,
          memory_type: 'trading_params',
          data: params
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);
  
    return {
      storeChat,
      storeTweet,
      storeTrading,
      loading,
      error,
      client, // Expose the client for custom operations
    };
  }