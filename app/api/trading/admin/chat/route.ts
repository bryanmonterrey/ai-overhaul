// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { Message } from 'ai';

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

    // Instead of WebSocket, make HTTP request to Python backend
    const pythonResponse = await fetch(`${API_URL}/trading/admin/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'trading_chat',
        messages,
        role: 'admin',
        userId: session.user.id,
        context: {
          isAdmin: true,
          sessionId: session.user.id,
          userRole: roleData.role
        }
      })
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python API error: ${pythonResponse.statusText}`);
    }

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process the Python response
    const reader = pythonResponse.body?.getReader();
    if (!reader) {
      throw new Error('No response body from Python API');
    }

    // Read and forward the streaming response
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            await writer.close();
            break;
          }
          // Format the response as SSE
          await writer.write(new TextEncoder().encode(
            `data: ${JSON.stringify({ text: new TextDecoder().decode(value) })}\n\n`
          ));
        }
      } catch (error) {
        console.error('Streaming error:', error);
        await writer.close();
      }
    })();

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