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
import { getTwitterManager } from '@/app/lib/twitter-manager-instance';

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
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            // Get basic stats first
            const baseStats = {
                engagement: {
                    total_likes: 0,
                    total_retweets: 0,
                    total_replies: 0,
                    average_engagement_rate: 0,
                },
                performance: {
                    best_style: 'N/A',
                    peak_hours: [],
                    top_themes: [],
                },
                trends: {
                    sentiment: 0,
                    volatility: 0,
                    momentum: 0,
                }
            };

            try {
                const status = await twitterManager.getStatus();
                const environmentalFactors = await twitterManager.getEnvironmentalFactors();

                // Safely merge the data
                if (status?.account) {
                    baseStats.engagement = {
                        total_likes: status.account.total_likes ?? 0,
                        total_retweets: status.account.total_retweets ?? 0,
                        total_replies: status.account.total_replies ?? 0,
                        average_engagement_rate: status.account.engagement_rate ?? 0,
                    };
                }

                if (status?.activity) {
                    baseStats.performance = {
                        best_style: status.activity.optimal_style ?? 'N/A',
                        peak_hours: status.activity.peak_hours ?? [],
                        top_themes: status.activity.top_themes ?? [],
                    };
                }

                if (environmentalFactors?.marketConditions) {
                    baseStats.trends = {
                        sentiment: environmentalFactors.marketConditions.sentiment ?? 0,
                        volatility: environmentalFactors.marketConditions.volatility ?? 0,
                        momentum: environmentalFactors.marketConditions.momentum ?? 0,
                    };
                }
            } catch (innerError) {
                console.error('Error fetching detailed analytics:', innerError);
                // Continue with base stats if detailed fetch fails
            }

            return NextResponse.json(baseStats);
            
        } catch (error: any) {
            console.error('Error in analytics route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to fetch analytics',
                    code: error.code || 'ANALYTICS_ERROR'
                },
                { status: error.statusCode || 500 }
            );
        }
    });
}