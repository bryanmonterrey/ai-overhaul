// app/api/admin/update/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

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
    console.log('Received updates:', updates);

    // Get the current system state
    let { data: currentState, error: stateError } = await supabase
      .from('system_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('Current state:', currentState);

    if (stateError) {
      if (stateError.code === 'PGRST116') {
        // No state exists yet, create initial state
        const initialState = {
          consciousness: {
            emotionalState: 'neutral'
          },
          emotionalProfile: {
            volatility: 0.5
          },
          traits: {},
          tweetStyle: 'shitpost',
          narrativeMode: 'philosophical',
          currentContext: {}
        };
        
        const { data: newState, error: insertError } = await supabase
          .from('system_state')
          .insert(initialState)
          .select()
          .single();

        if (insertError) throw insertError;
        currentState = newState;
      } else {
        throw stateError;
      }
    }

    // Properly merge nested updates
    const newState = {
      ...currentState,
      ...(updates.narrativeMode ? { narrativeMode: updates.narrativeMode } : {}),
      ...(updates.emotionalState ? { 
        consciousness: {
          ...currentState?.consciousness,
          emotionalState: updates.emotionalState 
        }
      } : {}),
      ...(updates.traits ? { traits: updates.traits } : {}),
      ...(updates.tweetStyle ? { tweetStyle: updates.tweetStyle } : {}),
      updated_at: new Date().toISOString()
    };

    console.log('New state to save:', newState);

    if (!currentState?.id) {
      // Insert new state if no id exists
      const { data: insertedState, error: insertError } = await supabase
        .from('system_state')
        .insert(newState)
        .select()
        .single();

      if (insertError) throw insertError;
      console.log('Inserted new state:', insertedState);
      return NextResponse.json(insertedState);
    }

    // Update existing state
    const { error: updateError } = await supabase
      .from('system_state')
      .update(newState)
      .eq('id', currentState.id);

    if (updateError) throw updateError;

    // Fetch and return the updated state
    const { data: updatedState, error: fetchError } = await supabase
      .from('system_state')
      .select('*')
      .eq('id', currentState.id)
      .single();

    if (fetchError) throw fetchError;

    console.log('Successfully updated state:', updatedState);

    return NextResponse.json(updatedState);
  } catch (error) {
    console.error('Error updating system state:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}