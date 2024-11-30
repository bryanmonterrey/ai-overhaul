// app/api/twitter/targets/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/app/types/supabase';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    const { data: targets, error } = await supabase
      .from('engagement_targets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(targets);
  } catch (error) {
    console.error('Error fetching targets:', error);
    return NextResponse.json({ error: 'Error fetching targets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body = await req.json();

    const { data: target, error } = await supabase
      .from('engagement_targets')
      .insert({
        username: body.username,
        topics: body.topics,
        reply_probability: body.replyProbability,
        relationship_level: 'new',
        preferred_style: body.preferredStyle
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(target);
  } catch (error) {
    console.error('Error creating target:', error);
    return NextResponse.json({ error: 'Error creating target' }, { status: 500 });
  }
}