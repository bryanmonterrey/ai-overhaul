// app/lib/memory/letta-client.ts

import { 
    BaseMemory, 
    MemoryType,
    MemoryResponse
} from '@/app/types/memory';

interface ChainConfig {
    depth?: number;
    min_similarity?: number;
}

interface ClusterConfig {
    algorithm?: string;
    n_clusters?: number;
}

interface LettaResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export class LettaClient {
    private baseUrl: string;
    private retryCount: number = 3;

    constructor(baseUrl = 'http://localhost:3001') {  // Changed to point to Python service
        this.baseUrl = baseUrl;
    }

    async storeMemory<T extends BaseMemory>(memory: T): Promise<MemoryResponse> {
        return this.withRetry(async () => {
            console.log('Storing memory:', memory);
            const response = await fetch(`${this.baseUrl}/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(memory),
            });
    
            if (!response.ok) {
                const text = await response.text();
                console.error('Store memory failed:', text);
                return {
                    success: false,
                    error: text
                };
            }
    
            const data = await response.json();
            console.log('Store response:', data);
    
            // Return a properly formatted MemoryResponse
            return {
                success: true,
                data: data.data || data
            };
        });
    }

    async getMemory<T extends BaseMemory>(key: string, type: MemoryType): Promise<T | null> {
        return this.withRetry(async () => {
            // Changed from /memories/{key} to /memory/{key}
            const response = await fetch(
                `${this.baseUrl}/memory/${encodeURIComponent(key)}`  // Removed type parameter as it's not needed
            );
    
            if (!response.ok) {
                console.warn(`Get memory failed for key ${key}:`, await response.text());
                return null;
            }
    
            return this.handleResponse(response);
        });
    }

    async queryMemories(type: MemoryType, query: Record<string, any>) {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    type, 
                    query: JSON.stringify(query), // Convert query object to string
                    context: query.context
                }),
            });
    
            return this.handleResponse(response);
        });
    }


    async chainMemories(memory_key: string, config: ChainConfig) {
        return this.withRetry(async () => {
            try {
                const response = await fetch(`${this.baseUrl}/memories/chain/${memory_key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`Chain memories failed for key ${memory_key}:`, errorText);
                    // Instead of throwing, return empty chain
                    return { 
                        success: true, 
                        data: { 
                            chain: [],
                            error: errorText
                        } 
                    };
                }
                
                const data = await response.json();
                
                // Check if we got a valid response
                if (!data || !data.data) {
                    console.warn(`Invalid response format for key ${memory_key}`);
                    return { 
                        success: true, 
                        data: { 
                            chain: [] 
                        } 
                    };
                }
    
                return this.handleResponse(response);
            } catch (error) {
                console.error('Chain memories error:', error);
                // Return empty chain instead of throwing
                return { 
                    success: true, 
                    data: { 
                        chain: [],
                        error: error instanceof Error ? error.message : 'Unknown error'
                    } 
                };
            }
        }, {
            retries: this.retryCount,
            backoff: true
        });
    }

    async clusterMemories(config: ClusterConfig) {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/cluster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return this.handleResponse(response);
        });
    }

    async trackEvolution(concept: string) {
        return this.withRetry(async () => {
            const response = await fetch(
                `${this.baseUrl}/evolution/${encodeURIComponent(concept)}`
            );
            return this.handleResponse(response);
        });
    }

    async getSummary(timeframe: string = 'recent', limit: number = 5) {
        return this.withRetry(async () => {
            const response = await fetch(
                `${this.baseUrl}/summary?timeframe=${timeframe}&limit=${limit}`
            );
            return this.handleResponse(response);
        });
    }

    async analyzeContent(content: string, context?: Record<string, any>): Promise<LettaResponse<any>> {
        return this.withRetry(async () => {
            if (!content) {
                throw new Error('Content is required');
            }
    
            // Using /query endpoint instead of /analyze - this needs to change
            const payload = {
                content,  // Changed from type/query structure
                context: context || {}
            };
    
            try {
                // Should use /analyze endpoint instead of /query
                const response = await fetch(`${this.baseUrl}/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
    
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Analysis failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText,
                        payload
                    });
                }
    
                return this.handleResponse(response);
            } catch (error) {
                console.error('Network error:', error);
                throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    private async handleResponse(response: Response) {
        try {
            if (!response.ok) {
                const text = await response.text();
                try {
                    const errorData = JSON.parse(text);
                    if (Array.isArray(errorData.detail)) {
                        // Handle validation errors
                        const errors = errorData.detail.map((e: any) => e.msg).join(', ');
                        throw new Error(`Validation error: ${errors}`);
                    }
                    throw new Error(errorData?.detail || errorData?.error || `HTTP error! status: ${response.status}`);
                } catch (jsonError) {
                    throw new Error(text || `HTTP error! status: ${response.status}`);
                }
            }
    
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('Error handling response:', {
                error,
                responseStatus: response.status,
                responseUrl: response.url
            });
            throw error;
        }
    }

    private async withRetry<T>(
        operation: () => Promise<T>, 
        options = { retries: 3, backoff: true }
    ): Promise<T> {
        for (let i = 0; i < options.retries; i++) {
            try {
                return await operation();
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i === options.retries - 1) throw error;
                
                const delay = options.backoff 
                    ? Math.min(1000 * Math.pow(2, i), 10000) // Exponential backoff up to 10s
                    : 1000; // Fixed 1s delay
                    
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('Operation failed after retries');
    }
}