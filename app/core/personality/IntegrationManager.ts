// src/app/core/personality/IntegrationManager.ts

import { PersonalitySystem } from './PersonalitySystem';
import { EmotionalSystem } from './EmotionalSystem';
import { MemorySystem } from './MemorySystem';
import {
  PersonalityState,
  EmotionalResponse,
  Platform,
  Context,
  EmotionalState
} from './types';
import { LLMManager } from '../llm/model_manager';
import type { EnvironmentalFactors, MemoryType } from '../types/index';
import type { PersonalityState as CorePersonalityState } from '../types/index';
import { Memory, MemoryQueryResult, Message } from '@/app/types/memory';
import { MemGPTClient } from '@/app/lib/memory/memgpt-client';

interface SystemState {
  personalityState: PersonalityState;
  emotionalResponse: EmotionalResponse;
  platform: Platform;
}

interface Interaction {
  id: string;
  content: string;
  platform: Platform;
  timestamp: Date;
  participant: string;
  emotionalResponse: EmotionalResponse;
  importance: number;
}

export class IntegrationManager {
  private personalitySystem: PersonalitySystem;
  private emotionalSystem: EmotionalSystem;
  private memorySystem: MemorySystem;
  private llmManager: LLMManager;
  private currentState: SystemState;

  constructor(
    personalitySystem: PersonalitySystem,
    emotionalSystem: EmotionalSystem,
    memorySystem: MemorySystem,
    llmManager: LLMManager
  ) {
    this.personalitySystem = personalitySystem;
    this.emotionalSystem = emotionalSystem;
    this.memorySystem = memorySystem;
    this.llmManager = llmManager;
    this.currentState = {
      personalityState: this.personalitySystem.getCurrentState(),
      emotionalResponse: this.emotionalSystem.getCurrentResponse() || {
        state: EmotionalState.Neutral,
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      },
      platform: 'chat'
    };
  }

  async processInput(
    input: string,
    platform: Platform = 'chat'
  ): Promise<{
    response: string;
    state: PersonalityState;
    emotion: EmotionalResponse;
    aiResponse: {
      content: string;
      model: string;
      provider: string;
    };
  }> {
    // Process emotional response
    const emotionalResponse = this.emotionalSystem.processStimulus(input);

    const memoryContext = await this.retrieveAndSummarizeMemories(input);

    // Update context with environmental factors
    const updatedContext: Context = {
      platform,
      recentInteractions: this.getRecentInteractions(),
      environmentalFactors: {
        timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
        platformActivity: 0.5,
        socialContext: [],
        platform
      },
      activeNarratives: [],
      memoryContext
    };

    // Add memory of input
    this.memorySystem.addMemory(
      input,
      'interaction',
      emotionalResponse.state || EmotionalState.Neutral,
      platform
    );

    // Generate response through personality system
    const personalityResponse = await this.personalitySystem.processInput(input, updatedContext);

    // Convert PersonalityState to core type for LLMManager
    const currentState = this.personalitySystem.getCurrentState();
    const llmPersonalityState: CorePersonalityState = {
      ...currentState,
      currentContext: {
        ...currentState.currentContext,
        recentInteractions: currentState.currentContext.recentInteractions.map(interaction => 
          typeof interaction === 'string' ? {
            id: crypto.randomUUID(),
            content: interaction,
            platform: 'chat',
            timestamp: new Date(),
            participant: 'user',
            emotionalResponse: {
              state: EmotionalState.Neutral,
              intensity: 0.5,
              trigger: '',
              duration: 0,
              associatedMemories: []
            },
            importance: 0.5
          } : interaction
        )
      },
      tweetStyle: currentState.tweetStyle as CorePersonalityState['tweetStyle'],
      narrativeMode: currentState.narrativeMode as CorePersonalityState['narrativeMode'],
      consciousness: {
        ...currentState.consciousness,
        longTermMemory: currentState.consciousness.longTermMemory.map(memory => 
          typeof memory === 'string' ? {
            id: crypto.randomUUID(),
            content: memory,
            timestamp: new Date(),
            type: 'thought' as MemoryType,
            emotionalContext: EmotionalState.Neutral,
            importance: 0.5,
            associations: [],
            platform: 'internal' as Platform
          } : memory
        )
      },
      memories: currentState.memories.map(memory => ({
        ...memory,
        type: memory.type as MemoryType,
        platform: memory.platform as Platform
      }))
    };

    // Get AI response without type assertion
    const aiResponse = await this.llmManager.generateResponse(
      personalityResponse,
      llmPersonalityState,
      updatedContext.environmentalFactors
    );

    // Add memory of response
    this.memorySystem.addMemory(
      aiResponse,
      'interaction',
      emotionalResponse.state || EmotionalState.Neutral,
      platform
    );

    return {
      response: aiResponse,
      state: this.personalitySystem.getCurrentState(),
      emotion: emotionalResponse,
      aiResponse: {
        content: aiResponse,
        model: this.llmManager.getCurrentModel(),
        provider: this.llmManager.getCurrentProvider()
      }
    };
  }

  private getRecentInteractions(): string[] {
    const recentMemories = this.memorySystem.query(
      'interaction',
      undefined,
      undefined,
      5
    );

    return recentMemories.map(memory => memory.content);
  }

  private getPatterns(): string[] {
    const patterns = this.memorySystem.getPatterns();
    return patterns
      .map(pattern => pattern.associations.join(' '))
      .slice(0, 3);
  }

  public getCurrentState(): PersonalityState {
    return this.personalitySystem.getCurrentState();
  }

  public getEmotionalTrend(): EmotionalResponse[] {
    const response = this.emotionalSystem.getCurrentResponse();
    return response ? [response] : [];
  }

  public getRelevantMemories(content: string): Memory[] {
    return this.memorySystem.getAssociatedMemories(content);
  }

  async updateState(updates: Partial<SystemState>) {
    this.currentState = {
      ...this.currentState,
      ...updates
    };
  }

  async reset(): Promise<void> {
    this.currentState = {
      personalityState: this.personalitySystem.getCurrentState(),
      emotionalResponse: this.emotionalSystem.getCurrentResponse() || {
        state: EmotionalState.Neutral,
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      },
      platform: 'chat'
    };
    await this.personalitySystem.reset();
    this.emotionalSystem.reset();
  }

  private async retrieveAndSummarizeMemories(input: string): Promise<string> {
    const memClient = new MemGPTClient();
    
    // Enhanced memory retrieval using multiple strategies
    const [recentMemories, semanticMemories] = await Promise.all([
      // Get recent memories
      memClient.queryMemories('chat_history', { limit: 5 }) as Promise<MemoryQueryResult>,
      
      // Get semantically relevant memories
      memClient.queryMemories('chat_history', {
        semantic_query: input,
        threshold: 0.7,
        limit: 3
      }) as Promise<MemoryQueryResult>
    ]);

    // Combine and deduplicate memories
    const allMemories = new Map<string, Memory>();
    
    recentMemories?.data?.memories?.forEach(memory => {
      const key = memory.data.messages.map(m => m.content).join('');
      allMemories.set(key, memory);
    });

    semanticMemories?.data?.memories?.forEach(memory => {
      const key = memory.data.messages.map(m => m.content).join('');
      allMemories.set(key, memory);
    });

    // Convert memories to a format suitable for your memory system
    Array.from(allMemories.values()).forEach(memory => {
      memory.data.messages.forEach((msg: Message) => {
        this.memorySystem.addMemory(
          msg.content,
          'interaction',
          memory.metadata.emotionalState || EmotionalState.Neutral,
          memory.metadata.platform || 'chat',
          {
            timestamp: new Date(msg.timestamp),
            importance: this.calculateImportance(msg, input),
            context: memory.metadata
          }
        );
      });
    });

    // Summarize memories for context
    return this.summarizeMemories(Array.from(allMemories.values()));
  }

  public async summarizeMemories(memories: Memory[]): Promise<string> {
    // Group memories by conversation
    const conversations = memories.reduce((acc, memory) => {
      const key = memory.data.messages[0].timestamp.split('T')[0];
      acc[key] = acc[key] || [];
      acc[key].push(memory);
      return acc;
    }, {} as Record<string, Memory[]>);

    // Summarize each conversation
    const summaries = await Promise.all(
      Object.entries(conversations).map(async ([date, convoMemories]) => {
        const conversation = convoMemories
          .flatMap(m => m.data.messages)
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');

        // Use your LLM manager to generate a summary
        const summary = await this.llmManager.generateResponse(
          `Summarize this conversation:\n${conversation}`,
          this.personalitySystem.getCurrentState(),
          { timeOfDay: 'any', platformActivity: 0, socialContext: [], platform: 'internal' }
        );

        return `[${date}] ${summary}`;
      })
    );

    return summaries.join('\n\n');
  }
}