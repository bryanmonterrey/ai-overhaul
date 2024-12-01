// app/api/twitter/queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';

export async function GET(req: NextRequest) {
    const handler: AuthenticatedHandler = async (supabase, session, cookies) => {
        try {
            const twitterManager = getTwitterManager();
            
            // First check if the manager is properly initialized
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const tweets = await twitterManager.getQueuedTweets();
            return NextResponse.json(tweets || []);
            
        } catch (error) {
            console.error('Error fetching queued tweets:', error);
            
            // More specific error handling
            if (error instanceof Error) {
                return NextResponse.json(
                    { 
                        error: true,
                        message: error.message,
                        code: 'QUEUE_FETCH_ERROR'
                    },
                    { status: 500 }
                );
            }
            
            return NextResponse.json(
                { 
                    error: true,
                    message: 'Internal server error',
                    code: 'UNKNOWN_ERROR'
                },
                { status: 500 }
            );
        }
    };

    return withAuth(handler);
}