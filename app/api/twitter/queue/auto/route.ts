import { NextRequest, NextResponse } from 'next/server';
const { withAuth } = require('../../../../lib/middleware/auth-middleware');
const { withConfig } = require('../../../../lib/middleware/configMiddleware');
const { checkTwitterRateLimit } = require('../../../../lib/middleware/twitter-rate-limiter');
const { getTwitterManager } = require('../../../../lib/twitter-manager-instance');

export async function POST(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('auto_queue');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            const { enabled } = body;

            if (enabled) {
                await twitterManager.startAutoQueue();
                return NextResponse.json({
                    success: true,
                    message: 'Auto queue enabled'
                });
            } else {
                await twitterManager.stopAutoQueue();
                return NextResponse.json({
                    success: true,
                    message: 'Auto queue disabled'
                });
            }
        } catch (error: any) {
            console.error('Error managing auto queue:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'AUTO_QUEUE_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('auto_queue_status');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const status = await twitterManager.getAutoQueueStatus();
            return NextResponse.json({ status });
        } catch (error: any) {
            console.error('Error getting auto queue status:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'AUTO_QUEUE_STATUS_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}