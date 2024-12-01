// app/api/twitter/queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';

export async function GET(req: NextRequest) {
  const handler: AuthenticatedHandler = async (supabase, session, cookies) => {
    try {
      const twitterManager = getTwitterManager();
      const tweets = await twitterManager.getQueuedTweets();
      console.log('Queued tweets:', tweets);
      
      return NextResponse.json(tweets || []);
    } catch (error) {
      console.error('Error fetching queued tweets:', error);
      return NextResponse.json(
        { 
          error: true,
          message: error instanceof Error ? error.message : 'Internal server error'
        }, 
        { status: 500 }
      );
    }
  };

  return withAuth(handler);
}