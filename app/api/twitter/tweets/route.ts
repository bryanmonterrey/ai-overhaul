// app/api/twitter/tweets/route.ts

import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { getTwitterClient } from '@/app/lib/twitter-client';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { withAuth } from '@/app/lib/middleware/auth-middleware';
import { checkTwitterRateLimit } from '@/app/lib/middleware/twitter-rate-limiter';

export async function GET() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit();

            const twitterClient = getTwitterClient();
            if (!twitterClient) {
                throw new Error('Twitter client not initialized');
            }

            const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
            const twitterManager = new TwitterManager(twitterClient, personalitySystem, supabase);
            
            try {
                const status = await twitterManager.getStatus();
                const recentTweets = await twitterManager.getRecentTweets();

                // Safely handle different tweet formats
                const tweets = Array.isArray(recentTweets) ? recentTweets : 
                             recentTweets instanceof Map ? Array.from(recentTweets.values()) : 
                             [];
                
                return NextResponse.json({ 
                    tweets: tweets.map(tweet => ({
                        id: tweet.id,
                        content: tweet.text || tweet.content || '',
                        timestamp: tweet.created_at || new Date().toISOString(),
                        metrics: {
                            likes: tweet.public_metrics?.like_count || 0,
                            retweets: tweet.public_metrics?.retweet_count || 0,
                            replies: tweet.public_metrics?.reply_count || 0
                        },
                        style: tweet.style || 'default'
                    })),
                    status: status || {}
                });
            } catch (innerError) {
                console.error('Error processing tweets:', innerError);
                return NextResponse.json({ tweets: [], status: {} });
            }
        } catch (error: any) {
            console.error('Error in tweets route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to fetch tweets',
                    code: error.code || 'TWEET_FETCH_ERROR',
                    tweets: []
                },
                { status: error.statusCode || 500 }
            );
        }
    });
}