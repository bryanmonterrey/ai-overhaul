import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';
import { withAuth, AuthenticatedHandler } from '@/app/lib/middleware/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const handler: AuthenticatedHandler = async (
    supabase: SupabaseClient<Database>,
    session
  ) => {
    try {
      const { id } = context.params;
      const twitterManager = getTwitterManager();
      const body = await req.json();
      
      await twitterManager.updateTweetStatus(id, body.status);
      const updatedTweets = await twitterManager.getQueuedTweets();
      
      return NextResponse.json({
        success: true,
        tweets: updatedTweets
      });
    } catch (error) {
      console.error('Error updating tweet status:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };

  return withAuth(handler);
}