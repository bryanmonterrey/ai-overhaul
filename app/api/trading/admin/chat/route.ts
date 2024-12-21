// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { StreamingTextResponse, LangChainStream } from 'ai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAdminAuth(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return false;
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    return profile?.is_admin === true;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin status
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid message format', { status: 400 });
    }

    const { stream, handlers } = LangChainStream();

    // Process in background
    const runAsync = async () => {
      try {
        const response = await fetch(
          `${process.env.LETTA_API_URL}/admin/trading/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
            },
            body: JSON.stringify({ messages })
          }
        );

        if (!response.ok) {
          throw new Error(`LettA API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        handlers.handleLLMNewToken(data.response);
      } catch (error) {
        console.error('Chat processing error:', error);
        handlers.handleLLMError(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        handlers.handleLLMEnd();
      }
    };

    // Start async processing
    runAsync().catch(error => {
      console.error('Async processing error:', error);
    });

    return new StreamingTextResponse(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
      }
    });

  } catch (error) {
    console.error('Route handler error:', error);
    return new Response(
      'Error processing request', 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}