const { TwitterManager } = require('../core/twitter/twitter-manager');
const { PersonalitySystem } = require('../core/personality/PersonalitySystem');
const { DEFAULT_PERSONALITY } = require('../core/personality/config');
const { getTwitterClient } = require('./twitter-client');
const { getSupabaseClient } = require('./supabase/server');
const { TwitterTrainingService } = require('./services/twitter-training');

let twitterManagerInstance: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
  if (!twitterManagerInstance) {
    try {
      const twitterClient = getTwitterClient();
      if (!twitterClient) {
        throw new Error('Twitter client not initialized');
      }

      const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY);
      const supabase = getSupabaseClient();
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

export function resetTwitterManager(): void {
  twitterManagerInstance = null;
}