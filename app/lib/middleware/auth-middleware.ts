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

    // For development mode, provide a mock session
    if (process.env.NODE_ENV === 'development') {
      const mockSession = {
        user: { 
          id: 'dev-user',
          role: 'admin'
        }
      };
      const result = await handler(supabase, mockSession);
      return result;
    }

    const sessionResponse = await supabase.auth.getSession();
    
    // Handle session errors silently in development
    if (!sessionResponse.data.session && process.env.NODE_ENV === 'development') {
      const mockSession = {
        user: { 
          id: 'dev-user',
          role: 'admin'
        }
      };
      return handler(supabase, mockSession);
    }

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
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient<Database>({ 
        cookies: () => cookieStore
      });
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