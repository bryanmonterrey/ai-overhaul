// app/lib/memory/test-connection.ts
import { MemGPTClient } from './memgpt-client';

export async function testMemGPTConnection() {
    const memgpt = new MemGPTClient();
    try {
        const response = await memgpt.storeMemory({
            key: 'test',
            memory_type: 'chat_history',
            data: { 
                messages: [{
                    role: 'assistant',
                    content: 'Connection test message',
                    timestamp: new Date().toISOString()
                }]
            }
        });
        console.log('MemGPT connection successful:', response);
        return true;
    } catch (error) {
        console.error('MemGPT connection failed:', error);
        return false;
    }
}