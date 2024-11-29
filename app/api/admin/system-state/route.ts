import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    // Create cookie store and get the auth cookie directly
    const cookieStore = cookies();
    const authCookie = cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value;

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ 
      cookies: () => {
        return new Map([
          ['sb-dbavznzqcwnwxsgfbsxw-auth-token', authCookie || '']
        ])
      }
    });
    
    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Get system state from database
    const { data: systemState, error: stateError } = await supabase
      .from('system_state')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (stateError && stateError.code !== 'PGRST116') {
      throw stateError;
    }

    return NextResponse.json(systemState || {
      consciousness: {
        emotionalState: 'neutral'
      },
      emotionalProfile: {
        volatility: 0.5
      },
      traits: {},
      tweet_style: 'shitpost',
      narrative_mode: 'philosophical',
      currentContext: {},
      memories: []
    });

  } catch (error) {
    console.error('System state error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}