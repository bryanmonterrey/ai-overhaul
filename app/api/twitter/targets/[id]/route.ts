import { NextRequest, NextResponse } from 'next/server';
const { withAuth } = require('../../../../lib/middleware/auth-middleware');
const { withConfig } = require('../../../../lib/middleware/configMiddleware');
const { checkTwitterRateLimit } = require('../../../../lib/middleware/twitter-rate-limiter');
const { getTwitterManager } = require('../../../../lib/twitter-manager-instance');

export async function DELETE(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('targets_delete');
            
            const { id } = context.params;
            if (!id) {
                return NextResponse.json({ 
                    error: 'Target ID is required',
                    code: 'MISSING_TARGET_ID'
                }, { status: 400 });
            }

            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            await twitterManager.removeEngagementTarget(id);
            const targets = await twitterManager.getEngagementTargets();

            return NextResponse.json({
                success: true,
                targets
            });
            
        } catch (error: any) {
            console.error('Error removing engagement target:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TARGET_DELETE_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}

export async function PATCH(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('targets_update');
            
            const { id } = context.params;
            if (!id) {
                return NextResponse.json({ 
                    error: 'Target ID is required',
                    code: 'MISSING_TARGET_ID'
                }, { status: 400 });
            }

            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            await twitterManager.updateEngagementTarget(id, body);
            const targets = await twitterManager.getEngagementTargets();

            return NextResponse.json({
                success: true,
                targets
            });
            
        } catch (error: any) {
            console.error('Error updating engagement target:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TARGET_UPDATE_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}