// app/api/admin/update/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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

    // Get updates from request body
    const updates = await req.json();

    // Get the current system state
    const { data: currentState, error: stateError } = await supabase
      .from('system_state')
      .select('*')
      .single();

    if (stateError && stateError.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
      throw stateError;
    }

    // Merge updates with current state
    const newState = {
      ...(currentState || {}),
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Store the updated state
    const { error: updateError } = await supabase
      .from('system_state')
      .upsert(newState);

    if (updateError) throw updateError;

    return NextResponse.json(newState);
  } catch (error) {
    console.error('Error updating system state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}