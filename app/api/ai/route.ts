// app/api/ai/route.ts

import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { configManager } from '@/app/lib/config/manager';
import { aiSettingsSchema } from '@/app/lib/config/ai-schemas';
import type { AISettings } from '@/app/core/types/ai';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const defaultSettings: AISettings = {
  temperature: 0.7,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  repetitionPenalty: 1,
  stopSequences: [],
  maxTokens: 1000
};

export async function POST(req: Request) {
  try {
    const { prompt, context, provider = 'claude' } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let aiSettings: AISettings;
    try {
      const configSettings = configManager.get('ai', 'settings') as AISettings;
      aiSettings = aiSettingsSchema.parse(configSettings);
    } catch (error) {
      console.warn('Failed to load AI settings, using defaults:', error);
      aiSettings = defaultSettings;
    }

    const model = provider === 'claude' ? 'claude-3.5-sonnet-20241022' : 'gpt-4-turbo-preview';
    
    let response: string;
    
    if (provider === 'claude') {
      try {
        const result = await anthropic.messages.create({
          model,
          max_tokens: aiSettings.maxTokens,
          temperature: aiSettings.temperature,
          messages: [
            { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
          ]
        });

        const content = result.content[0];
        response = 'text' in content ? content.text : '';
        
        if (!response) {
          throw new Error('Empty response from Claude');
        }
      } catch (error: any) {
        console.error('Claude API error:', error);
        throw new Error(`Claude API error: ${error.message}`);
      }
    } else {
      try {
        const result = await openai.chat.completions.create({
          model,
          temperature: aiSettings.temperature,
          max_tokens: aiSettings.maxTokens,
          messages: [
            ...(context ? [{ role: 'system' as const, content: context }] : []),
            { role: 'user' as const, content: prompt }
          ],
          presence_penalty: aiSettings.presencePenalty,
          frequency_penalty: aiSettings.frequencyPenalty
        });
        
        response = result.choices[0].message.content || '';
        
        if (!response) {
          throw new Error('Empty response from OpenAI');
        }
      } catch (error: any) {
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${error.message}`);
      }
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: error.status || 500 }
    );
  }
}