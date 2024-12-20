import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '../../../../lib/twitter-manager-instance';
import { withAuth } from '../../../../lib/middleware/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    return withAuth(async (supabase: SupabaseClient<Database>, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const { enabled } = await req.json();
            
            twitterManager.toggleAutoMode(enabled);
            
            return NextResponse.json({
                success: true,
                autoMode: enabled
            });
        } catch (error: any) {
            console.error('Error toggling auto mode:', error);
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

export async function GET(req: NextRequest) {
    return withAuth(async (supabase: SupabaseClient<Database>, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const status = await twitterManager.getStatus();
            return NextResponse.json({
                success: true,
                autoMode: status.autoMode
            });
        } catch (error: any) {
            console.error('Error getting auto mode status:', error);
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