import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MetricsCollector } from '@/app/core/monitoring/MetricsCollector';
export async function GET(req: Request) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get stats from your database
    const { data: messageStats } = await supabase
      .from('chat_messages')
      .select('count');

    const { data: tweetStats } = await supabase
      .from('tweets')
      .select('count');

    const stats = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      activeConnections: 0, // You'll need to track this
      totalChats: messageStats?.[0]?.count || 0,
      totalTweets: tweetStats?.[0]?.count || 0,
      averageResponseTime: 250, // You'll need to track this
      successRate: 0.98,
      totalMemories: 1000,
      memoryEfficiency: 0.95,
      contextSwitches: 150,
      cacheHitRate: 0.92
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}