// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { Message } from 'ai';
import WebSocket from 'ws';

// Use environment variable for API URL with local fallback
const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client with proper cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookieStore 
    });

    // Verify admin session with debug logging
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      error: sessionError
    });

    if (sessionError || !session) {
      console.error('Session error or no session:', sessionError);
      return new Response('Unauthorized: No valid session', { status: 401 });
    }

    // Check if user is admin using user_roles table (matching middleware)
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    console.log('Role check:', {
      roleData,
      roleError,
      userId: session.user.id
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response('Unauthorized: Role check failed', { status: 401 });
    }

    if (roleData?.role !== 'admin') {
      console.log('User not admin:', {
        userId: session.user.id,
        role: roleData?.role
      });
      return new Response('Unauthorized: Not an admin', { status: 401 });
    }

    const { messages }: { messages: Message[] } = await req.json();
    console.log('Processing messages:', messages);

    if (!messages?.length) {
      return new Response('No messages provided', { status: 400 });
    }

    // Log WebSocket connection attempt
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws`;
    console.log('Attempting WebSocket connection to:', wsUrl);

    // Create WebSocket connection to LettA
    const ws = new WebSocket(wsUrl);
    
    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      const payload = {
        type: 'trading_chat',
        messages,
        role: 'admin',
        userId: session.user.id,
        context: {
          isAdmin: true,
          sessionId: session.user.id,
          userRole: roleData.role
        }
      };
      console.log('Sending payload:', payload);
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
        await writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ text: data.text })}\n\n`
          )
        );
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.onclose = async (event) => {
      console.log('WebSocket connection closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      try {
        await writer.close();
      } catch (error) {
        console.error('Error closing writer:', error);
      }
    };

    ws.onerror = async (error) => {
      console.error('WebSocket connection error:', error);
      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing writer:', err);
      }
    };

    console.log('Setting up stream response');
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
      JSON.stringify({ 
        error: 'Error processing request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}