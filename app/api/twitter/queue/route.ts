import { NextRequest, NextResponse } from 'next/server';
const { withAuth } = require('../../../lib/middleware/auth-middleware');
const { getTwitterManager } = require('../../../lib/twitter-manager-instance');

export async function GET() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized' 
                }, { status: 500 });
            }

            const tweets = await twitterManager.getQueuedTweets();
            
            return NextResponse.json({ tweets });
        } catch (error: any) {
            console.error('Error fetching queued tweets:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    }) || NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function POST(req: NextRequest) {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized' 
                }, { status: 500 });
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
    }) || NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}