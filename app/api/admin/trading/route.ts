// app/api/admin/trading/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Validation schemas
const TradeSchema = z.object({
  token: z.string(),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().optional()
});

const StrategySchema = z.object({
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']),
  maxDrawdown: z.number(),
  targetProfit: z.number()
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get trading status and portfolio data
    const response = await fetch(
      `${process.env.LETTA_API_URL}/admin/trading/status`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        }
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Admin trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const trade = TradeSchema.parse(body);

    // Execute trade through LettA service
    const response = await fetch(
      `${process.env.LETTA_API_URL}/admin/trading/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        },
        body: JSON.stringify(trade)
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Admin trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}