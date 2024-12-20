import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '../../../../lib/twitter-manager-instance';
import { withAuth } from '../../../../lib/middleware/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withAuth(async (supabase: SupabaseClient<Database>, session: any) => {
        try {
            const { id } = context.params;
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const body = await req.json();
            await twitterManager.updateTweetStatus(id, body.status);
            const updatedTweets = await twitterManager.getQueuedTweets();
            
            return NextResponse.json({
                success: true,
                tweets: updatedTweets
            });
        } catch (error: any) {
            console.error('Error updating tweet status:', error);
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