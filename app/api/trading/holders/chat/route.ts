// app/api/trading/holders/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { Message } from 'ai';

// Use environment variable for API URL with local fallback
const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, userAddress }: { messages: Message[], userAddress: string } = await req.json();

    if (!messages?.length || !userAddress) {
      return new Response('Invalid request format', { status: 400 });
    }

    // Verify token holder status
    const tokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/token-validation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress })
      }
    );

    if (!tokenResponse.ok) {
      return new Response('Not a token holder', { status: 403 });
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.isEligible) {
      return new Response('Not eligible', { status: 403 });
    }

    // Create WebSocket connection to LettA
    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/ws`);
    
    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ text: data.text })}\n\n`
          )
        );
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.onclose = async () => {
      try {
        await writer.close();
      } catch (error) {
        console.error('Error closing writer:', error);
      }
    };

    ws.onerror = async (error) => {
      console.error('WebSocket error:', error);
      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing writer:', err);
      }
    };

    // Send message to LettA
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'trading_chat',
        messages,
        role: 'holder',
        userId: session.user.id,
        userAddress,
        context: {
          isHolder: true,
          sessionId: session.user.id,
          walletAddress: userAddress
        }
      }));
    };

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Route handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Error processing request' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}