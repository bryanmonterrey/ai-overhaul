import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/lib/twitter';

const twitterManager = new TwitterManager();

export async function GET() {
  try {
    const status = await twitterManager.getStatus();
    const recentTweets = status.activity?.recentTweets || [];
    
    return NextResponse.json(recentTweets);
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