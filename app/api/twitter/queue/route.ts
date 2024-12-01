// app/api/twitter/queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { getTwitterClient } from '@/app/lib/twitter-client';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    const session = await supabase.auth.getSession();
    
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const twitterClient = getTwitterClient();
    const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
    const twitterManager = new TwitterManager(twitterClient, personalitySystem);

    const tweets = await twitterManager.getQueuedTweets();
    console.log('Queued tweets:', tweets); // Add this log
    
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
}