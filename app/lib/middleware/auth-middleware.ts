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
    const session = sessionResponse.data.session;
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    const routeCookies = {
      get: async (name: string): Promise<{ name: string; value: string } | undefined> => {
        const cookie = cookieStore.get(name);
        return cookie ? { name: cookie.name, value: cookie.value } : undefined;
      },
      set: async (name: string, value: string): Promise<void> => {
        cookieStore.set(name, value);
      },
      remove: async (name: string): Promise<void> => {
        cookieStore.delete(name);
      }
    };

    return handler(supabase, session, routeCookies);
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
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