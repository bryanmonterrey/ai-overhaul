import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { withConfig } from '@/app/lib/middleware/configMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';

export async function GET(req: NextRequest) {
    const handler = async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            
            if (!twitterManager) {
                return NextResponse.json(
                    { error: 'Twitter manager not initialized' },
                    { status: 500 }
                );
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

    // Apply auth first, then config
    const authMiddleware = await withAuth(handler);
    return withConfig(authMiddleware)(req);
}