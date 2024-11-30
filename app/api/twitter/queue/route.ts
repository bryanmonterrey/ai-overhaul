// app/api/twitter/queue/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { getTwitterClient } from '@/app/lib/twitter-client';
import { getPersonalitySystem } from '@/app/lib/personality';

// Initialize TwitterManager (you might want to move this to a separate file)
const twitterClient = getTwitterClient();
const personalitySystem = getPersonalitySystem();
const twitterManager = new TwitterManager(twitterClient, personalitySystem);

export async function GET() {
  try {
    const tweets = twitterManager.getQueuedTweets();
    return NextResponse.json(tweets);
  } catch (error) {
    console.error('Error fetching queued tweets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queued tweets' },
      { status: 500 }
    );
  }
}