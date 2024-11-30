// app/api/twitter/targets/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/app/types/supabase';
import type { EngagementTargetRow } from '@/app/types/supabase';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    const { data: targets, error } = await supabase
      .from('engagement_targets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
    }

    return NextResponse.json(targets);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body = await req.json();

    const target = {
      username: body.username,
      topics: body.topics,
      reply_probability: body.replyProbability,
      relationship_level: 'new' as const,
      preferred_style: body.preferredStyle,
      last_interaction: null
    };

    const { data, error } = await supabase
      .from('engagement_targets')
      .insert([target])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
