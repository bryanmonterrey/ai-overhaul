// app/api/admin/system-state/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Create an async cookie store
        const cookieStore = cookies();
        // Initialize Supabase client with async cookies
        const supabase = createRouteHandlerClient({
          cookies: async () => cookieStore
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
      return new NextResponse(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
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

    // If no state exists, return default state
    if (!systemState) {
      const defaultState = {
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
      };

      const { data: newState, error: insertError } = await supabase
        .from('system_state')
        .insert(defaultState)
        .select()
        .single();

      if (insertError) throw insertError;
      return NextResponse.json(newState);
    }

    return NextResponse.json(systemState);
  } catch (error) {
    console.error('System state error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}