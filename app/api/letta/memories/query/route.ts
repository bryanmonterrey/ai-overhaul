// app/api/letta/memories/query/route.ts

import { NextResponse } from 'next/server';

// In-memory storage (shared with other routes)
const memoryStore = new Map<string, any>();

export async function POST(request: Request) {
    try {
        const { type, query } = await request.json();

        if (!type) {
            return NextResponse.json({ 
                error: 'Memory type is required' 
            }, { status: 400 });
        }

        // Get all memories of the specified type
        const memories = Array.from(memoryStore.values())
            .filter(memory => memory.memory_type === type);

        // Apply query filters if they exist
        const filteredMemories = query 
            ? memories.filter(memory => {
                return Object.entries(query).every(([key, value]) => {
                    return memory.data[key] === value;
                });
            })
            : memories;

        return NextResponse.json({
            success: true,
            data: {
                memories: filteredMemories
            }
        });
    } catch (error) {
        console.error('Memory query error:', error);
        return NextResponse.json({ 
            error: 'Failed to query memories' 
        }, { status: 500 });
    }
}