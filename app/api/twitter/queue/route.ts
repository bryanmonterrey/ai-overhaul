// app/api/twitter/queue/route.ts

import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { withConfig } from '@/app/lib/middleware/configMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';

export async function GET(req: NextRequest) {
    const handler = async (
        supabase: SupabaseClient<Database>,
        session: any
    ) => {
        try {
            const twitterManager = getTwitterManager();
            
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const tweets = await twitterManager.getQueuedTweets();
            return NextResponse.json(tweets || []);
            
        } catch (error: any) {
            console.error('Error in queue route:', error);
            return NextResponse.json(
                { 
                    error: true, 
                    message: error.message, 
                    debug: process.env.NODE_ENV === 'development' ? error : undefined 
                },
                { status: 500 }
            );
        }
    };

    return withConfig(withAuth(handler))(req);
}