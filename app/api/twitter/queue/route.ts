// app/api/twitter/queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { TwitterApiClient } from '@/app/lib/twitter-client';

// Initialize services
const twitterClient = new TwitterApiClient({
  apiKey: process.env.TWITTER_API_KEY || '',
  apiSecret: process.env.TWITTER_API_SECRET || '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
  accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
});

const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
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