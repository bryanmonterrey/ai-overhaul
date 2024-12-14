// app/api/letta/memories/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { key, memory_type, data, metadata } = await request.json();
        const supabase = createRouteHandlerClient({ cookies });

        if (!key || !memory_type || !data) {
            return NextResponse.json({ 
                error: 'Missing required fields' 
            }, { status: 400 });
        }

        // Forward to Python service
        const lettaResponse = await fetch('http://localhost:3001/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key,
                memory_type,
                data,
                metadata
            })
        });

        if (!lettaResponse.ok) {
            const error = await lettaResponse.text();
            throw new Error(error);
        }

        const lettaData = await lettaResponse.json();

        return NextResponse.json({
            success: true,
            data: lettaData.data
        });
    } catch (error) {
        console.error('Memory storage error:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to store memory' 
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

        // Forward to Python service
        const lettaResponse = await fetch(`http://localhost:3001/memories/${key}${type ? `?type=${type}` : ''}`, {
            method: 'GET'
        });

        if (!lettaResponse.ok) {
            const error = await lettaResponse.text();
            throw new Error(error);
        }

        const data = await lettaResponse.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Memory retrieval error:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to retrieve memory' 
        }, { status: 500 });
    }
}