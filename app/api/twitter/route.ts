import { NextResponse } from 'next/server';
import { TwitterManager } from '@/app/lib/twitter';
import { IntegrationManager } from '@/app/core/personality/IntegrationManager';
import { configManager } from '@/app/lib/config/manager';
import { EnvironmentalFactors, Platform } from '@/app/core/types';
import { validateAIInput, withRetry } from '@/app/lib/utils/ai-error-utils';
import { AIError, handleAIError } from '@/app/core/errors/AIError';
import { z } from 'zod';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { EmotionalSystem } from '@/app/core/personality/EmotionalSystem';
import { MemorySystem } from '@/app/core/personality/MemorySystem';
import { LLMManager } from '@/app/core/llm/model_manager';
import { TwitterApiClient } from '@/app/lib/twitter-client';

const twitterInputSchema = z.object({
  type: z.string(),
  content: z.string().min(1).max(280),
  context: z.object({
    environmentalFactors: z.object({
      timeOfDay: z.string().optional(),
      platformActivity: z.number().optional(),
      socialContext: z.array(z.string()).optional(),
      platform: z.string().optional(),
      marketConditions: z.object({
        sentiment: z.number(),
        volatility: z.number(),
        momentum: z.number(),
        trends: z.array(z.string())
      }).optional()
    }).optional()
  }).optional()
});

// Initialize Twitter manager with credentials
const twitterClient = new TwitterApiClient({
  apiKey: process.env.TWITTER_API_KEY!,
  apiSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!
});

const twitterManager = new TwitterManager(twitterClient); 

const config = configManager.getAll();
const personalitySystem = new PersonalitySystem({
  baseTemperature: config.personality.baseTemperature,
  creativityBias: config.personality.creativityBias,
  emotionalVolatility: config.personality.emotionalVolatility,
  memoryRetention: config.personality.memoryRetention,
  responsePatterns: {
    neutral: config.personality.responsePatterns?.neutral ?? [],
    excited: config.personality.responsePatterns?.excited ?? [],
    contemplative: config.personality.responsePatterns?.contemplative ?? [],
    chaotic: config.personality.responsePatterns?.chaotic ?? [],
    creative: config.personality.responsePatterns?.creative ?? [],
    analytical: config.personality.responsePatterns?.analytical ?? []
  }
});

const emotionalSystem = new EmotionalSystem();
const memorySystem = new MemorySystem();
const llmManager = new LLMManager();

const integrationManager = new IntegrationManager(
  personalitySystem,
  emotionalSystem,
  memorySystem,
  llmManager
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedInput = validateAIInput(twitterInputSchema, body);

    // Get Twitter environment data with retry
    const twitterEnvironment = await withRetry(async () => {
      return await twitterManager.getEnvironmentalFactors();
    });

    const environmentalFactors: EnvironmentalFactors = {
      platform: 'twitter',
      timeOfDay: new Date().getHours() >= 17 ? 'evening' : 
                 new Date().getHours() >= 12 ? 'afternoon' : 
                 new Date().getHours() >= 5 ? 'morning' : 'night',
      platformActivity: twitterEnvironment.platformActivity || 0,
      socialContext: twitterEnvironment.socialContext || [],
      marketConditions: {
        sentiment: 0.5,
        volatility: 0.5,
        momentum: 0.5,
        trends: []
      }
    };

    // Process through integration manager with retry
    const result = await withRetry(async () => {
      return await integrationManager.processInput(
        validatedInput.content,
        'twitter' as Platform
      );
    });

    // Post to Twitter with retry
    const tweet = await withRetry(async () => {
      return await twitterManager.postTweet(result.response);
    });

    return NextResponse.json({ 
      success: true, 
      tweet,
      state: result.state,
      emotion: result.emotion
    });
  } catch (error: any) {
    console.error('Twitter API Error:', error);
    return NextResponse.json(
      { 
        error: true,
        message: error.message || 'Twitter API Error',
        code: error.code || 500,
        retryable: error.retryable || false
      },
      { status: error.statusCode || 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await withRetry(async () => {
      const environmentalFactors = await twitterManager.getEnvironmentalFactors();
      return {
        status: 'ok',
        environmentalFactors
      };
    });
    
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Twitter Status Error:', error);
    return NextResponse.json(
      { 
        error: true,
        message: error.message || 'Failed to get Twitter status',
        code: error.code || 500,
        retryable: error.retryable || false
      },
      { status: error.statusCode || 500 }
    );
  }
}