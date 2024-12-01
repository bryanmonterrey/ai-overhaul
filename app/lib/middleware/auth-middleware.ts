import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { NextResponse } from 'next/server';

export async function withAuth(handler: Function) {
    try {
      const cookieStore = await cookies();
      const supabase = createRouteHandlerClient<Database>({ 
        cookies: () => Promise.resolve(cookieStore)
      });
  
      const sessionResponse = await supabase.auth.getSession();
      
      // For development, allow requests without session
      if (process.env.NODE_ENV === 'development') {
        return handler(supabase, sessionResponse.data.session, {
          get: async (name: string) => cookieStore.get(name),
          set: async (name: string, value: string) => cookieStore.set(name, value),
          remove: async (name: string) => cookieStore.delete(name)
        });
      }
  
      // In production, require authentication
      if (!sessionResponse.data.session) {
        return NextResponse.json(
          { error: 'Unauthorized' }, 
          { status: 401 }
        );
      }
  
      return handler(supabase, sessionResponse.data.session, {
        get: async (name: string) => cookieStore.get(name),
        set: async (name: string, value: string) => cookieStore.set(name, value),
        remove: async (name: string) => cookieStore.delete(name)
      });
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.json(
        { error: 'Authentication error', details: process.env.NODE_ENV === 'development' ? error : undefined }, 
        { status: 500 }
      );
    }
  }

export type AuthenticatedHandler = (
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>,
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createRouteHandlerClient>['auth']['getSession']>>['data']['session']>,
  cookies: {
    get: (name: string) => Promise<{ name: string; value: string } | undefined>;
    set: (name: string, value: string) => Promise<void>;
    remove: (name: string) => Promise<void>;
  }
) => Promise<NextResponse>; 