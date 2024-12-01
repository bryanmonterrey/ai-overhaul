// app/api/twitter/queue/route.ts

import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { withConfig } from '@/app/lib/middleware/configMiddleware';
import { NextRequest } from 'next/server';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { NextResponse } from 'next/server';


export async function GET(req: NextRequest) {
  return withConfig(withAuth(async (supabase, session) => {
    try {
      const twitterManager = getTwitterManager();
      const tweets = await twitterManager.getQueuedTweets();
      return NextResponse.json(tweets || []);
    } catch (error) {
      console.error('Error in queue route:', error);
      return NextResponse.json(
        { error: true, message: error.message, debug: process.env.NODE_ENV === 'development' ? error : undefined },
        { status: 500 }
      );
    }
  }))(req);
}