// src/app/lib/services/ai.ts

import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { configManager } from '../config/manager';
import { 
    AIConfig, 
    AIResponse, 
    ProviderType 
} from '@/app/core/types/ai';
import { TokenCounter, RateLimiter, CacheManager } from '@/app/lib/utils/ai';

export class AIService {
  private static instance: AIService;
  private anthropic: Anthropic;
  private openai: OpenAI;
  private provider: 'claude' | 'openai';

  private constructor() {
    // Initialize AI clients
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not defined');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.provider = configManager.get('ai', 'provider') as 'claude' | 'openai';
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateResponse(prompt: string, context?: string) {
    const config = configManager.get('ai', 'settings');
    
    try {
      if (this.provider === 'claude') {
        const response = await this.anthropic.messages.create({
          model: configManager.get('ai', 'model'),
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
          ]
        });

        // Handle different content block types
        const content = response.content[0];
        if ('text' in content) {
          return content.text;
        } else if ('type' in content) {
          return 'text' in content ? content.text : '';
        }
        throw new Error('Unexpected response format from Claude');

      } else {
        const response = await this.openai.chat.completions.create({
          model: configManager.get('ai', 'model'),
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          messages: [
            ...(context ? [{ role: 'system' as const, content: context }] : []),
            { role: 'user' as const, content: prompt }
          ]
        });
        return response.choices[0].message.content;
      }
    } catch (error) {
      // If primary provider fails and fallback is enabled
      if (configManager.get('ai', 'fallback').enabled) {
        console.warn(`Primary AI provider failed, using fallback`);
        return this.generateWithFallback(prompt, context);
      }
      throw error;
    }
  }

  private async generateWithFallback(prompt: string, context?: string) {
    const fallbackConfig = configManager.get('ai', 'fallback');
    const config = configManager.get('ai', 'settings');

    if (fallbackConfig.provider === 'openai') {
      const response = await this.openai.chat.completions.create({
        model: fallbackConfig.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          ...(context ? [{ role: 'system' as const, content: context }] : []),
          { role: 'user' as const, content: prompt }
        ]
      });
      return response.choices[0].message.content;
    } else {
      const response = await this.anthropic.messages.create({
        model: fallbackConfig.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
        ]
      });

      // Handle different content block types
      const content = response.content[0];
      if ('text' in content) {
        return content.text;
      } else if ('type' in content) {
        return 'text' in content ? content.text : '';
      }
      throw new Error('Unexpected response format from Claude');
    }
  }

  // Add method to switch providers
  public setProvider(provider: 'claude' | 'openai') {
    this.provider = provider;
  }
}

export const aiService = AIService.getInstance();