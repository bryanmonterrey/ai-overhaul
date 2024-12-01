// app/api/twitter/queue/auto/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';

export async function POST(req: NextRequest) {
  const handler: AuthenticatedHandler = async (supabase, session, cookies) => {
    try {
      const twitterManager = getTwitterManager();
      const { enabled } = await req.json();
      
      twitterManager.toggleAutoMode(enabled);
      const tweets = await twitterManager.getQueuedTweets();
      
      return NextResponse.json({
        success: true,
        autoMode: enabled,
        tweets,
        nextTweetTime: enabled ? twitterManager.getNextScheduledTime() : null
      });
    } catch (error) {
      console.error('Error toggling auto mode:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };

  return withAuth(handler);
}