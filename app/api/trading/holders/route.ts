// app/api/trading/holders/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const SettingsSchema = z.object({
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']),
  maxPositionSize: z.number().positive(),
  tradingEnabled: z.boolean()
});

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify token holder status
    const isHolder = await verifyTokenHolder(params.address);
    if (!isHolder) {
      return new Response('Not a token holder', { status: 403 });
    }

    // Get holder's trading data
    const response = await fetch(
      `${process.env.LETTA_API_URL}/trading/holders/${params.address}/status`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        }
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Holder trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify token holder status
    const isHolder = await verifyTokenHolder(params.address);
    if (!isHolder) {
      return new Response('Not a token holder', { status: 403 });
    }

    const body = await req.json();
    const settings = SettingsSchema.parse(body);

    // Update holder's trading settings
    const response = await fetch(
      `${process.env.LETTA_API_URL}/trading/holders/${params.address}/settings`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        },
        body: JSON.stringify(settings)
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Holder trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}