import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/lib/twitter';

const twitterManager = new TwitterManager();

export async function GET() {
  try {
    // Get an array of recent tweets from your map
    const status = await twitterManager.getStatus();
    const tweets = Array.from(twitterManager['recentTweets'].values()) || [];
    
    return NextResponse.json(tweets);
  } catch (error: any) {
    console.error('Error fetching tweets:', error);
    return NextResponse.json(
      { 
        error: true,
        message: error.message || 'Failed to fetch tweets',
        code: error.code || 500
      },
      { status: error.statusCode || 500 }
    );
  }
}