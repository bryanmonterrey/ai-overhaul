import { NextRequest } from "next/server";

// app/api/trading/holders/chat/route.ts
export async function POST(req: NextRequest) {
    try {
      const user = await auth();
      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }
  
      const { messages, userAddress } = await req.json();
      const { stream, handlers } = LangChainStream();
  
      const runAsync = async () => {
        try {
          const response = await fetch(
            `${process.env.LETTA_API_URL}/holders/trading/chat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
              },
              body: JSON.stringify({ messages, userAddress })
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