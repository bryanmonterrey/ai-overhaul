import { 
    BaseMemory, 
    MemoryType,
    MemoryResponse
} from '@/app/types/memory';

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
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(memory),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.error || 
                    `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            return data;
        });
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