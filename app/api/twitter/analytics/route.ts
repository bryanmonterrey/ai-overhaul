import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';
import { getTwitterClient } from '@/app/lib/twitter-client';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { checkTwitterRateLimit } from '@/app/lib/middleware/twitter-rate-limiter';

interface TwitterStatus {
  account?: {
    total_likes?: number;
    total_retweets?: number;
    total_replies?: number;
    engagement_rate?: number;
  };
  activity?: {
    optimal_style?: string;
    peak_hours?: string[];
    top_themes?: string[];
  };
}

interface EnvironmentalFactors {
  platformActivity: number;
  socialContext: string[];
  marketConditions?: {
    sentiment: number;
    volatility: number;
    momentum: number;
    trends?: string[];
  };
}

export async function GET() {
  return withAuth(async (supabase: any, session: any) => {
    try {
      await checkTwitterRateLimit();
      
      const twitterClient = getTwitterClient();
      const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
      const twitterManager = new TwitterManager(twitterClient, personalitySystem);
      
      const status: TwitterStatus = await twitterManager.getStatus();
      const environmentalFactors: EnvironmentalFactors = await twitterManager.getEnvironmentalFactors();

      // Format the analytics data
      const analyticsData = {
        engagement: {
          total_likes: status.account?.total_likes ?? 0,
          total_retweets: status.account?.total_retweets ?? 0,
          total_replies: status.account?.total_replies ?? 0,
          average_engagement_rate: status.account?.engagement_rate ?? 0,
        },
        performance: {
          best_style: status.activity?.optimal_style ?? 'N/A',
          peak_hours: status.activity?.peak_hours ?? [],
          top_themes: status.activity?.top_themes ?? [],
        },
        trends: {
          sentiment: environmentalFactors.marketConditions?.sentiment ?? 0,
          volatility: environmentalFactors.marketConditions?.volatility ?? 0,
          momentum: environmentalFactors.marketConditions?.momentum ?? 0,
        }
      };
      
      return NextResponse.json(analyticsData);
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
  });
}