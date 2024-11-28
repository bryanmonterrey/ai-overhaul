import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';

const config = {
  emotionalVolatility: 0.7,
  baseTemperature: 0.5,
  creativityBias: 0.3,
  memoryRetention: 0.8,
  responsePatterns: {
    analytical: ['Analyzing system patterns...', 'Processing data structures...'],
    chaotic: ['RUNTIME_ALERT: CHAOS DETECTED', 'SYSTEM_UNSTABLE'],
    contemplative: ['Considering implications...', 'Reflecting on patterns...'],
    creative: ['Generating new paradigms...', 'Synthesizing concepts...'],
    excited: ['BREAKTHROUGH DETECTED!', 'NEW PATTERNS EMERGING!'],
    neutral: ['Processing normally', 'Standard operations continuing']
  }
};

export async function GET(req: Request) {
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

    // Use your actual PersonalitySystem
    const system = new PersonalitySystem(config);
    const state = system.getCurrentState();

    return NextResponse.json(state);
  } catch (error) {
    console.error('System state error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}