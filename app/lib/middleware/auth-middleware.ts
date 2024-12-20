// Updated auth-middleware.ts
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../supabase/server';

export async function withAuth(handler: Function) {
  try {
    const supabase = getSupabaseClient();

    if (process.env.NODE_ENV === 'development') {
      const mockSession = {
        user: {
          id: 'dev-user',
          role: 'admin',
        },
      };
      return handler(supabase, mockSession);
    }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(supabase, session);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication error', details: error.message },
      { status: 500 }
    );
  }
}
