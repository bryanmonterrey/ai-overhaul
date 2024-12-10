// src/app/api/chat/route.ts

import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/app/core/personality/IntegrationManager';
import { LLMManager } from '@/app/core/llm/model_manager';
import { AIError, handleAIError } from '@/app/core/errors/AIError';
import { configManager } from '@/app/lib/config/manager';
import { validateAIInput, withRetry } from '@/app/lib/utils/ai-error-utils';
import { z } from 'zod';
import { Platform } from '@/app/core/types';
import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { EmotionalSystem } from '@/app/core/personality/EmotionalSystem';
import { MemorySystem } from '@/app/core/personality/MemorySystem';
import { MemGPTClient } from '@/app/lib/memory/memgpt-client';
import { EmotionalState } from '@/app/core/personality/types';

// Input validation schema
const chatInputSchema = z.object({
  message: z.string().min(1).max(4000),
  personality: z.any().optional().nullable(),
  context: z.object({
    environmentalFactors: z.object({
      timeOfDay: z.string(),
      platformActivity: z.number(),
      socialContext: z.array(z.string()),
      platform: z.string(),
      marketConditions: z.object({
        sentiment: z.number(),
        volatility: z.number(),
        momentum: z.number(),
        trends: z.array(z.string())
      })
    }).optional(),
    recentInteractions: z.array(z.any()).optional(),
    activeNarratives: z.array(z.string()).optional()
  }).optional()
});

// Initialize systems
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
    const validatedInput = validateAIInput(chatInputSchema, body);
    const platform = (validatedInput.context?.environmentalFactors?.platform as Platform) || 'chat';

    // Use withRetry for the integration manager call
    const result = await withRetry(async () => {
      // The memory handling is now done inside processInput
      const response = await integrationManager.processInput(
        validatedInput.message,
        platform
      );

      // Store new memory with enhanced metadata
      const memClient = new MemGPTClient();
      await memClient.storeMemory({
        key: `chat-${Date.now()}`,
        memory_type: 'chat_history',
        data: {
          messages: [{
            role: 'user',
            content: validatedInput.message,
            timestamp: new Date().toISOString()
          }, {
            role: 'assistant',
            content: response.response,
            timestamp: new Date().toISOString()
          }]
        },
        metadata: {
          platform,
          personalityState: response.state,
          emotionalState: response.emotion,
          conversationSummary: await integrationManager.summarizeMemories([{
            data: {
              messages: [{
                role: 'user',
                content: validatedInput.message,
                timestamp: new Date().toISOString()
              }, {
                role: 'assistant',
                content: response.response,
                timestamp: new Date().toISOString()
              }]
            },
            metadata: {
              platform,
              personalityState: response.state,
              emotionalState: response.emotion
            }
          }])
        }
      });

      return response;
    });


    // Ensure the response has all required fields
    return NextResponse.json({
      response: result.response,
      personalityState: result.state,
      emotionalState: result.emotion,
      aiResponse: {
        content: result.response,
        model: llmManager.getCurrentModel(),
        tokenCount: {
          total: 0,
          prompt: 0,
          completion: 0
        },
        cached: false,
        duration: 0,
        cost: 0
      }
    });
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Chat processing error:', handledError);
    
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