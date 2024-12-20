import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const handler = async (supabase: any, session: any): Promise<NextResponse> => {
      const twitterManager = getTwitterManager();

      // Ensure TwitterManager is initialized
      if (!twitterManager) {
        throw new Error('TwitterManager instance is not initialized');
      }

      const tweets = await twitterManager.getQueuedTweets();
      return NextResponse.json(tweets || []);
    };

    // Chain middlewares
    const authMiddleware = withAuth(handler);
    const configMiddleware = withConfig(authMiddleware);
    return configMiddleware(req);
  } catch (error) {
    console.error('Queue route error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
