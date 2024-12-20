import { TwitterManager } from '../core/twitter/twitter-manager';
import { TwitterApiClient } from './twitter-client';
import { createClient } from '@supabase/supabase-js';
import { PersonalitySystem } from '../core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '../core/personality/config';
import { TwitterTrainingService } from './services/twitter-training';
import { Database } from '@/types/supabase';

let twitterManager: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
    if (!twitterManager) {
        const supabase = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const client = new TwitterApiClient({
            apiKey: process.env.TWITTER_API_KEY!,
            apiSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_SECRET!,
        });
        
        const trainingService = new TwitterTrainingService(supabase);
        const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY, trainingService);
        
        twitterManager = new TwitterManager(client, personalitySystem, supabase, trainingService);
    }
    return twitterManager;
}

export function resetTwitterManager(): void {
  twitterManager = null;
}