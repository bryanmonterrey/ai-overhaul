import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { NextResponse } from 'next/server';

export async function withAuth(handler: Function) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookieStore
    });

    // For development mode, bypass authentication
    if (process.env.NODE_ENV === 'development') {
      return handler(supabase, { user: { id: 'dev-user' } });
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Authentication error', details: sessionError },
        { status: 401 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(supabase, session);
  } catch (error) {
    console.error('Auth middleware error:', error);
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