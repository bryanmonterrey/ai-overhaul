// app/api/letta/memories/query/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { type, query, context } = await request.json();

        if (!type) {
            return NextResponse.json({ 
                error: 'Memory type is required' 
            }, { status: 400 });
        }

        // Forward to Python service
        const response = await fetch('http://localhost:3001/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type,
                query,
                context
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Memory query error:', error);
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Failed to query memories' 
        }, { status: 500 });
    }
}