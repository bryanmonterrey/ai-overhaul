import { TwitterManager } from '.././core/twitter/twitter-manager';
import { PersonalitySystem } from '.././core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '.././core/personality/config';
import { getTwitterClient } from '.././lib/twitter-client';
import { TwitterTrainingService } from '.././lib/services/twitter-training';
import { getSupabaseClient } from './supabase/server';

let twitterManagerInstance: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
  if (!twitterManagerInstance) {
    try {
      const twitterClient = getTwitterClient();
      const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
      
      // Use the server-side Supabase client
      const supabase = getSupabaseClient();
      
      // Pass the same Supabase client to the training service
      const trainingService = new TwitterTrainingService(supabase);

      twitterManagerInstance = new TwitterManager(
        twitterClient,
        personalitySystem,
        supabase,
        trainingService
      );
      
      console.log('Twitter manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Twitter manager:', error);
      throw error;
    }
  }
  return twitterManagerInstance;
}