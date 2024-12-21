// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { StreamingTextResponse } from '@vercel/ai';

const LETTA_SERVICE_URL = 'http://localhost:3001'; // Your local LettA service

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient<Database>({ cookies });

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

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid message format', { status: 400 });
    }

    // Create response stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(
            `${LETTA_SERVICE_URL}/admin/trading/chat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages,
                userId: session.user.id,
                type: 'trading_admin'
              })
            }
          );

          if (!response.ok) {
            throw new Error(`LettA service error: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Stream the response
          controller.enqueue(encoder.encode(data.response));
          controller.close();
        } catch (error) {
          console.error('Chat processing error:', error);
          controller.error(error);
        }
      }
    });

    return new StreamingTextResponse(stream);
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