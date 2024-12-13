// app/api/letta/memories/route.ts

import { NextResponse } from 'next/server';

// In-memory storage (replace with database in production)
const memoryStore = new Map<string, any>();

export async function POST(request: Request) {
    try {
        const { key, memory_type, data, metadata } = await request.json();

        if (!key || !memory_type || !data) {
            return NextResponse.json({ 
                error: 'Missing required fields' 
            }, { status: 400 });
        }

        const memory = {
            key,
            memory_type,
            data,
            metadata,
            timestamp: new Date().toISOString()
        };

        memoryStore.set(key, memory);

        return NextResponse.json({
            success: true,
            message: 'Memory stored successfully',
            data: memory
        });
    } catch (error) {
        console.error('Memory storage error:', error);
        return NextResponse.json({ 
            error: 'Failed to store memory' 
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const type = searchParams.get('type');

        if (!key) {
            return NextResponse.json({ 
                error: 'Key is required' 
            }, { status: 400 });
        }

        const memory = memoryStore.get(key);

        if (!memory) {
            return NextResponse.json({ 
                success: true, 
                data: null 
            });
        }

        if (type && memory.memory_type !== type) {
            return NextResponse.json({ 
                success: true, 
                data: null 
            });
        }

        return NextResponse.json({
            success: true,
            data: memory
        });
    } catch (error) {
        console.error('Memory retrieval error:', error);
        return NextResponse.json({ 
            error: 'Failed to retrieve memory' 
        }, { status: 500 });
    }
}