// app/api/twitter/queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const handler: AuthenticatedHandler = async (supabase, session, cookies) => {
        try {
            const twitterManager = getTwitterManager();
            
            if (!twitterManager) {
                return NextResponse.json(
                    { error: true, message: 'Twitter manager not initialized' },
                    { status: 500 }
                );
            }

            // Initialize the tweets table if it doesn't exist
            const { data: existingTweets, error: dbError } = await supabase
                .from('tweet_queue')
                .select('*')
                .limit(1);

            if (dbError) {
                console.error('Database error:', dbError);
                return NextResponse.json(
                    { error: true, message: 'Database error' },
                    { status: 500 }
                );
            }

            const tweets = await twitterManager.getQueuedTweets();
            return NextResponse.json(tweets || []);
            
        } catch (error) {
            console.error('Error in queue route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    code: 'QUEUE_ERROR'
                },
                { status: 500 }
            );
        }
    };

    return withAuth(handler);
}