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

export class LettaClient {
    private baseUrl: string;
    private retryCount: number = 3;

    constructor(baseUrl = 'http://localhost:3001') {  // Changed to point to Python service
        this.baseUrl = baseUrl;
    }

    private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        for (let i = 0; i < this.retryCount; i++) {
            try {
                return await operation();
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i === this.retryCount - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        throw new Error('Operation failed after retries');
    }

    async storeMemory<T extends BaseMemory>(memory: T): Promise<MemoryResponse> {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(memory),
            });

            return this.handleResponse(response);
        });
    }

    async getMemory<T extends BaseMemory>(key: string, type: MemoryType): Promise<T | null> {
        return this.withRetry(async () => {
            const response = await fetch(
                `${this.baseUrl}/memories/${encodeURIComponent(key)}?type=${encodeURIComponent(type)}`
            );

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
                body: JSON.stringify({ type, query }),
            });

            return this.handleResponse(response);
        });
    }


    async chainMemories(memory_key: string, config: ChainConfig) {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/memories/chain/${memory_key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return this.handleResponse(response);
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

    async analyzeContent(content: string) {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            return this.handleResponse(response);
        });
    }

    private async handleResponse(response: Response) {
        const data = await response.json().catch(() => null);
        
        if (!response.ok) {
            throw new Error(data?.error || `HTTP error! status: ${response.status}`);
        }

        if (!data?.success) {
            throw new Error(data?.error || 'Unknown error');
        }

        return data;
    }
}