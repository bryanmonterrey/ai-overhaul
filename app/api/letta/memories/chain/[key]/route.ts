// app/api/letta/memories/chain/[key]/route.ts

import { NextResponse } from 'next/server';
import { validate as validateUUID } from 'uuid';

export async function POST(
    request: Request,
    { params }: { params: { key: string } }
) {

    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return NextResponse.json({ 
          error: 'Content-Type must be application/json' 
        }, { status: 400 });
      }
      
    try {
        const config = await request.json();
        const { key } = params;

        if (!validateUUID(key)) {
            return NextResponse.json({ 
                error: 'Invalid memory key format' 
            }, { status: 400 });
        }

        // Forward the request to the Python service
        const response = await fetch(`http://localhost:3001/memories/chain/${key}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Memory chain error:', error);
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create memory chain'
        }, { status: 500 });
    }
}