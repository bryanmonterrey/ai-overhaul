// app/api/twitter/tweets/route.ts

import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/lib/twitter';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const session = await supabase.auth.getSession();
    
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const twitterManager = new TwitterManager();
    const status = await twitterManager.getStatus();
    const tweets = Array.from(twitterManager['recentTweets'].values()) || [];
    
    return NextResponse.json({ tweets, status });
  } catch (error: any) {
    console.error('Error fetching tweets:', error);
    return NextResponse.json(
      { 
        error: true,
        message: error.message || 'Failed to fetch tweets',
        code: error.code || 500
      },
      { status: error.statusCode || 500 }
    );
  }
}