import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/lib/twitter';

const twitterManager = new TwitterManager();

export async function GET() {
  try {
    const environmentalFactors = await twitterManager.getEnvironmentalFactors();
    const status = await twitterManager.getStatus();
    
    return NextResponse.json({
      environmentalFactors,
      accountStats: status.account,
      activity: status.activity,
      limits: status.limits
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { 
        error: true,
        message: error.message || 'Failed to fetch analytics',
        code: error.code || 500
      },
      { status: error.statusCode || 500 }
    );
  }
}