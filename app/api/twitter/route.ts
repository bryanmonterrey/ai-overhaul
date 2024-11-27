// src/app/interfaces/twitter/api/route.ts

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

const twitterInputSchema = z.object({
  type: z.string(),
  content: z.string().min(1).max(280), // Twitter's character limit
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
const twitterManager = new TwitterManager();

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
      marketConditions: twitterEnvironment.marketConditions || {
        sentiment: 0.5,
        volatility: 0.5,
        momentum: 0.5,
        trends: []
      }
    };

    // Process through integration manager with retry
    const result = await withRetry(async () => {
      return integrationManager.processInput(
        validatedInput.content,
        'twitter' as Platform
      );
    });

    // Post to Twitter with retry
    const tweet = await withRetry(async () => {
      return twitterManager.postTweet(result.response);
    });

    return NextResponse.json({ 
      success: true, 
      tweet,
      state: result.state,
      emotion: result.emotion
    });
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Twitter processing error:', handledError);
    
    return NextResponse.json(
      { 
        error: handledError.message,
        code: handledError.code,
        retryable: handledError.retryable
      },
      { status: handledError.statusCode || 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await withRetry(async () => {
      return await twitterManager.getStatus();
    });
    
    return NextResponse.json(status);
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Error getting Twitter status:', handledError);
    
    return NextResponse.json(
      { 
        error: handledError.message,
        code: handledError.code,
        retryable: handledError.retryable
      },
      { status: handledError.statusCode || 500 }
    );
  }
}