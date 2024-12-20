import { TwitterManager } from '.././core/twitter/twitter-manager';
import { PersonalitySystem } from '.././core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '.././core/personality/config';
import { getTwitterClient } from '.././lib/twitter-client';
import { createClient } from '@supabase/supabase-js';
import { TwitterTrainingService } from '.././lib/services/twitter-training';

let twitterManagerInstance: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
  if (!twitterManagerInstance) {
    const twitterClient = getTwitterClient();
    const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const trainingService = new TwitterTrainingService(supabase); // Provide the training service here

    twitterManagerInstance = new TwitterManager(
      twitterClient,
      personalitySystem,
      supabase,
      trainingService // Add the required training service argument
    );
  }
  return twitterManagerInstance;
}
