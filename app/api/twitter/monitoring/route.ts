// app/api/twitter/monitoring/route.ts
import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { TwitterApiClient } from '@/app/lib/twitter-client';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { createClient } from '@supabase/supabase-js';
import { TwitterTrainingService } from '@/app/lib/services/twitter-training';

const client = new TwitterApiClient({
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
});

const personalityConfig = {
    baseTemperature: 0.7,
    creativityBias: 0.5,
    emotionalVolatility: 0.3,
    memoryRetention: 0.8,
    responsePatterns: {
        neutral: [],
        excited: [],
        contemplative: [],
        chaotic: [],
        creative: [],
        analytical: []
    },
    platform: 'twitter'
};

const personalitySystem = new PersonalitySystem(personalityConfig);
const twitterManager = new TwitterManager(
    client,
    personalitySystem,
    createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    new TwitterTrainingService()
);

export async function POST(request: Request) {
    try {
        await twitterManager.startMonitoring();
        return NextResponse.json({ success: true, message: 'Monitoring started' });
    } catch (error) {
        console.error('Failed to start monitoring:', error);
        return NextResponse.json({ error: true, message: 'Failed to start monitoring' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const status = await twitterManager.getMonitoringStatus();
        return NextResponse.json(status);
    } catch (error) {
        console.error('Failed to get monitoring status:', error);
        return NextResponse.json({ error: true, message: 'Failed to get monitoring status' }, { status: 500 });
    }
}