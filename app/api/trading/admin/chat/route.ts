// app/api/trading/admin/chat/route.ts
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
    // Initialize Supabase client with proper cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Verify admin session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages }: { messages: Message[] } = await req.json();

    if (!messages?.length) {
      return new Response('No messages provided', { status: 400 });
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
        role: 'admin',
        userId: session.user.id,
        context: {
          isAdmin: true,
          sessionId: session.user.id
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