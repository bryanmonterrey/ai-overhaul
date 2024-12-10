// app/lib/middleware/auth-middleware.ts
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getSupabaseClient } from '../supabase/singleton';

export async function withAuth(handler: Function) {
    try {
        const supabase = getSupabaseClient();

        // For development mode, provide a mock session
        if (process.env.NODE_ENV === 'development') {
            const mockSession = {
                user: { 
                    id: 'dev-user',
                    role: 'admin'
                }
            };
            return handler(supabase, mockSession);
        }

        const sessionResponse = await supabase.auth.getSession();

        if (!sessionResponse.data.session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        return handler(supabase, sessionResponse.data.session);
    } catch (error) {
        console.error('Auth middleware error:', error);
        // In development, continue with mock data
        if (process.env.NODE_ENV === 'development') {
            const supabase = getSupabaseClient();
            const mockSession = {
                user: { 
                    id: 'dev-user',
                    role: 'admin'
                }
            };
            return handler(supabase, mockSession);
        }
        return NextResponse.json(
            { error: 'Authentication error', details: error },
            { status: 500 }
        );
    }
}

export type AuthenticatedHandler = (
    supabase: ReturnType<typeof createRouteHandlerClient<Database>>,
    session: any
) => Promise<NextResponse>;