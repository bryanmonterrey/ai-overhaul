// app/api/letta/memories/chain/[key]/route.ts

import { NextResponse } from 'next/server';

// In-memory storage (replace with database in production)
const memoryStore = new Map<string, any>();

// Helper function for similarity calculation
function calculateSimilarity(mem1: any, mem2: any) {
    const content1 = (mem1.data.content || '').toLowerCase().split(' ');
    const content2 = (mem2.data.content || '').toLowerCase().split(' ');
    const intersection = content1.filter((word: string) => content2.includes(word));
    return intersection.length / Math.max(content1.length, content2.length);
}

export async function POST(
    request: Request,
    { params }: { params: { key: string } }
) {
    try {
        const { depth = 3, min_similarity = 0.6 } = await request.json();
        const { key } = params;

        if (!key) {
            return NextResponse.json({ 
                error: 'Memory key is required' 
            }, { status: 400 });
        }

        // Get the base memory
        const baseMemory = memoryStore.get(key);
        if (!baseMemory) {
            return NextResponse.json({
                success: true,
                data: {
                    chain: []
                }
            });
        }

        // Get related memories
        const chain = [baseMemory];
        const allMemories = Array.from(memoryStore.values());

        // Build chain
        for (let i = 0; i < depth && chain.length < depth; i++) {
            const lastMemory = chain[chain.length - 1];
            const nextMemories = allMemories
                .filter(mem => !chain.includes(mem))
                .map(mem => ({
                    memory: mem,
                    similarity: calculateSimilarity(lastMemory, mem)
                }))
                .filter(({ similarity }) => similarity >= min_similarity)
                .sort((a, b) => b.similarity - a.similarity);

            if (nextMemories.length > 0) {
                chain.push(nextMemories[0].memory);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                chain
            }
        });
    } catch (error) {
        console.error('Memory chain error:', error);
        return NextResponse.json({ 
            error: 'Failed to create memory chain' 
        }, { status: 500 });
    }
}