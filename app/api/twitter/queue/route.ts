// Refactored route.ts
import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { withConfig } from '@/app/lib/middleware/configMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore,
    });

    if (process.env.NODE_ENV === 'development') {
      const twitterManager = getTwitterManager();

      const { data: tweets, error } = await supabase
        .from('tweet_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Database error', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(tweets || []);
    }

    const handler = async (sb: any, session: any) => {
      try {
        const twitterManager = getTwitterManager();
        const tweets = await twitterManager.getQueuedTweets();
        return NextResponse.json(tweets || []);
      } catch (error) {
        console.error('TwitterManager error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch queued tweets', details: error.message },
          { status: 500 }
        );
      }
    };

    const authMiddleware = await withAuth(handler);
    return withConfig(authMiddleware)(req);
  } catch (error) {
    console.error('Queue route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
