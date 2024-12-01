// app/lib/twitter-manager-instance.ts

import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '@/app/core/personality/config';
import { getTwitterClient } from '@/app/lib/twitter-client';
import { createClient } from '@supabase/supabase-js';

let twitterManagerInstance: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
    if (!twitterManagerInstance) {
        const twitterClient = getTwitterClient();
        const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        twitterManagerInstance = new TwitterManager(
            twitterClient, 
            personalitySystem,
            supabase
        );
    }
    return twitterManagerInstance;
}