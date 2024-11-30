// app/api/twitter/queue/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { getPersonalitySystem } from '@/app/lib/services/ai';
import { getTwitterClient } from '@/app/lib/twitter-client';

const twitterClient = getTwitterClient();
const personalitySystem = getPersonalitySystem();
const twitterManager = new TwitterManager(twitterClient, personalitySystem);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const session = await supabase.auth.getSession();
    
    if (!session.data.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    twitterManager.updateTweetStatus(params.id, body.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating tweet status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
