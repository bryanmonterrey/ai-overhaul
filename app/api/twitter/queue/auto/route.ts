import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const handler: AuthenticatedHandler = async (
    supabase: SupabaseClient<Database>,
    session
  ) => {
    try {
      const twitterManager = getTwitterManager();
      const { enabled } = await req.json();
      
      twitterManager.toggleAutoMode(enabled);
      
      return NextResponse.json({
        success: true,
        autoMode: enabled
      });
    } catch (error) {
      console.error('Error toggling auto mode:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };

  return withAuth(handler);
}