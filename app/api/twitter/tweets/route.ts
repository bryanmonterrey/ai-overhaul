import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function GET() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit();

            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }
            
            try {
                const status = await twitterManager.getStatus();
                const recentTweets = await twitterManager.getRecentTweets();

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
            } catch (innerError: any) {
                console.error('Error processing tweets:', innerError);
                return NextResponse.json({ 
                    error: true,
                    message: innerError.message,
                    code: innerError.code || 'TWEET_PROCESS_ERROR',
                    details: innerError.stack
                }, { 
                    status: innerError.statusCode || 500 
                });
            }
        } catch (error: any) {
            console.error('Error in tweets route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to fetch tweets',
                    code: error.code || 'TWEET_FETCH_ERROR',
                    details: error.stack,
                    tweets: []
                },
                { status: error.statusCode || 500 }
            );
        }
    });
}