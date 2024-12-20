import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function POST(req: NextRequest) {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const body = await req.json();
            const count = body.count || 10;

            await twitterManager.generateTweetBatch(count);
            const tweets = await twitterManager.getQueuedTweets();

            return NextResponse.json({
                success: true,
                tweets
            });
        } catch (error: any) {
            console.error('Error generating tweets:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    });
}