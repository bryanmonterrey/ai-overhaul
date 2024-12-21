// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { StreamingTextResponse, LangChainStream } from 'ai';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify admin status
    const user = await auth();
    if (!user?.isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await req.json();
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

        const data = await response.json();
        handlers.handleLLMNewToken(data.response);
      } catch (error) {
        handlers.handleLLMError(error);
      } finally {
        handlers.handleLLMEnd();
      }
    };

    runAsync();
    return new StreamingTextResponse(stream);
  } catch (error) {
    return new Response('Error processing request', { status: 500 });
  }
}
