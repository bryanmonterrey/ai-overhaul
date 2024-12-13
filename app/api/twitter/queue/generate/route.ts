// app/api/twitter/queue/generate/route.ts

import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

        // Get session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const twitterManager = getTwitterManager();
        await twitterManager.generateTweetBatch();
        const tweets = await twitterManager.getQueuedTweets();
        
        return NextResponse.json({
            success: true,
            tweets
        });
    } catch (error) {
        console.error('Error generating tweets:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 
            { status: 500 }
        );
    }
}