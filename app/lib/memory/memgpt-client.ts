// app/lib/memory/memgpt-client.ts
interface MemoryRequest {
    key: string;
    data?: Record<string, any>;
    context?: string;
  }
  
  interface MemoryResponse {
    success: boolean;
    data?: Record<string, any>;
    error?: string;
  }
  
  export class MemGPTClient {
    private baseUrl: string;
  
    constructor(baseUrl = 'http://localhost:3001') {
      this.baseUrl = baseUrl;
    }
  
    async storeMemory(request: MemoryRequest): Promise<MemoryResponse> {
      try {
        const response = await fetch(`${this.baseUrl}/memory/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
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
  
    async getMemory(key: string): Promise<MemoryResponse> {
      try {
        const response = await fetch(`${this.baseUrl}/memory/${key}`);
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error retrieving memory:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  }
  
  // Memory manager hook for React components
  import { useState, useCallback } from 'react';
  
  export function useMemGPT() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const client = new MemGPTClient();
  
    const storeMemory = useCallback(async (key: string, data: any) => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.storeMemory({ key, data });
        if (!response.success) {
          throw new Error(response.error || 'Failed to store memory');
        }
        return response.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);
  
    const getMemory = useCallback(async (key: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.getMemory(key);
        if (!response.success) {
          throw new Error(response.error || 'Failed to retrieve memory');
        }
        return response.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);
  
    return {
      storeMemory,
      getMemory,
      loading,
      error,
    };
  }