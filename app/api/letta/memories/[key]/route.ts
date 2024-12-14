// app/api/letta/memories/[key]/route.ts
import { NextResponse } from 'next/server';
import { MemoryType } from '@/app/types/memory';

export async function GET(
    request: Request,
    { params }: { params: { key: string } }
) {
    try {
        const { key } = params;
        const url = new URL(request.url);
        const type = url.searchParams.get('type') as MemoryType;

        // Forward to Python service
        const response = await fetch(`http://localhost:3001/memories/${key}${type ? `?type=${type}` : ''}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Memory retrieval error:', error);
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve memory' 
        }, { status: 500 });
    }
}