// app/api/twitter/queue/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';

export async function POST(req: NextRequest) {
  const handler: AuthenticatedHandler = async (supabase, session, cookies) => {
    try {
      const twitterManager = getTwitterManager();
      await twitterManager.generateTweetBatch();
      const tweets = await twitterManager.getQueuedTweets();
      
      return NextResponse.json({
        success: true,
        tweets,
        message: 'Tweet batch generated successfully'
      });
    } catch (error) {
      console.error('Error generating tweets:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };

  return withAuth(handler);
}