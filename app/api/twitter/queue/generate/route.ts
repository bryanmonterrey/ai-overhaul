// app/api/twitter/queue/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { getTwitterClient } from '@/app/lib/twitter-client';

export async function POST(req: NextRequest) {
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

    await twitterManager.generateTweetBatch();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error generating tweets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}