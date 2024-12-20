// Refactored auth-middleware.ts
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../supabase/server';

export async function withAuth(handler: Function) {
  try {
    const supabase = getSupabaseClient();

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
      console.error('No active session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(supabase, sessionResponse.data.session);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication error', details: error.message },
      { status: 500 }
    );
  }
}
