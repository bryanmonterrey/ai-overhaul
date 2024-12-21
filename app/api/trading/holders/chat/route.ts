// app/api/trading/holders/chat/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { StreamingTextResponse } from '@vercel/ai';

const LETTA_SERVICE_URL = 'http://localhost:3001'; // Your local LettA service

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, userAddress } = await req.json();

    if (!messages || !Array.isArray(messages) || !userAddress) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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

    // Create response stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(
            `${LETTA_SERVICE_URL}/holders/trading/chat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                messages, 
                userId: session.user.id,
                userAddress,
                type: 'trading_holder'
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