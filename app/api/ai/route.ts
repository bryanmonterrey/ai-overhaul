import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { configManager } from '@/app/lib/config/manager';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export async function POST(req: Request) {
  try {
    const { prompt, context, provider = 'claude' } = await req.json();
    
    const config = configManager.get('ai', 'settings');

    let response;
    
    if (provider === 'claude') {
      const result = await anthropic.messages.create({
        model: configManager.get('ai', 'model'),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
        ]
      });

      const content = result.content[0];
      response = 'text' in content ? content.text : '';
    } else {
      const result = await openai.chat.completions.create({
        model: configManager.get('ai', 'model'),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          ...(context ? [{ role: 'system' as const, content: context }] : []),
          { role: 'user' as const, content: prompt }
        ]
      });
      response = result.choices[0].message.content;
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}