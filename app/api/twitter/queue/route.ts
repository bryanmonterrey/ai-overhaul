// app/api/twitter/queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { getPersonalitySystem } from '@/app/lib/services/ai';
import { getTwitterClient } from '@/app/lib/twitter-client';

// Initialize services
const twitterClient = getTwitterClient();
const personalitySystem = getPersonalitySystem();
const twitterManager = new TwitterManager(twitterClient, personalitySystem);

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const session = await supabase.auth.getSession();
    
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tweets = twitterManager.getQueuedTweets();
    return NextResponse.json(tweets);
  } catch (error) {
    console.error('Error fetching queued tweets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
