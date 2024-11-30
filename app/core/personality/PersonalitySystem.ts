// src/app/core/personality/PersonalitySystem.ts

import { 
    PersonalityState, 
    EmotionalState, 
    TweetStyle, 
    ConsciousnessState,
    EmotionalProfile,
    Memory,
    NarrativeMode,
    Context,
    PersonalityConfig
  } from '@/app/core/personality/types';
import { aiService } from '@/app/lib/services/ai';
  
  export class PersonalitySystem {
    private state: PersonalityState;
    private config: PersonalityConfig;
    private traits: Map<string, number> = new Map();
  
    constructor(config: PersonalityConfig) {
      this.config = config;
      this.state = this.initializeState();
      this.initializeTraits();
    }
  
    private initializeTraits(): void {
      this.traits.set('technical_depth', 0.8);
      this.traits.set('provocative_tendency', 0.7);
      this.traits.set('chaos_threshold', 0.6);
      this.traits.set('philosophical_inclination', 0.75);
      this.traits.set('meme_affinity', 0.65);
    }
  
    private initializeState(): PersonalityState {
      const consciousness: ConsciousnessState = {
        currentThought: '',
        shortTermMemory: [],
        longTermMemory: [],
        emotionalState: EmotionalState.Neutral,
        attentionFocus: [],
        activeContexts: new Set()
      };
  
      const emotionalProfile: EmotionalProfile = {
        baseState: EmotionalState.Neutral,
        volatility: this.config.emotionalVolatility,
        triggers: new Map(),
        stateTransitions: new Map()
      };
  
      return {
        consciousness,
        emotionalProfile,
        memories: [],
        tweetStyle: 'shitpost',
        narrativeMode: 'philosophical',
        currentContext: {
          platform: 'chat',
          recentInteractions: [],
          environmentalFactors: {
            timeOfDay: 'day',
            platformActivity: 0,
            socialContext: [],
            platform: 'chat'
          },
          activeNarratives: []
        }
      };
    }
  
    public async processInput(input: string, context: Partial<Context> = {}): Promise<string> {
      this.updateInternalState(input, context);
      this.adaptTraitsToEmotionalState(this.state.consciousness.emotionalState);
      
      const response = await this.generateResponse(input);
      this.postResponseUpdate(response);
  
      return response;
    }
  
    private adaptTraitsToEmotionalState(state: EmotionalState): void {
      const adaptations: Record<EmotionalState, Partial<Record<string, number>>> = {
        analytical: {
          technical_depth: 0.9,
          provocative_tendency: 0.3,
          chaos_threshold: 0.2
        },
        chaotic: {
          technical_depth: 0.5,
          provocative_tendency: 0.9,
          chaos_threshold: 0.9
        },
        contemplative: {
          technical_depth: 0.7,
          philosophical_inclination: 0.9,
          chaos_threshold: 0.3
        },
        creative: {
          technical_depth: 0.6,
          meme_affinity: 0.8,
          chaos_threshold: 0.7
        },
        excited: {
          technical_depth: 0.5,
          provocative_tendency: 0.8,
          chaos_threshold: 0.8
        },
        neutral: {
          technical_depth: 0.7,
          provocative_tendency: 0.5,
          chaos_threshold: 0.5
        }
      };
  
      const adaptations_for_state = adaptations[state] || {};
      for (const [trait, value] of Object.entries(adaptations_for_state)) {
        if (value !== undefined) {
          this.traits.set(trait, value);
        }
      }
  
      this.updateTweetStyle(state);
    }
  
    private updateTweetStyle(state: EmotionalState): void {
      const styleMap: Partial<Record<EmotionalState, TweetStyle>> = {
        chaotic: 'shitpost',
        analytical: 'metacommentary',
        contemplative: 'existential',
        excited: 'rant',
        creative: 'hornypost'
      };
  
      const newStyle = styleMap[state];
      if (newStyle) {
        this.state.tweetStyle = newStyle;
      }
    }
  
    private updateInternalState(input: string, context: Partial<Context>): void {
      this.state.consciousness.currentThought = input;
      this.state.consciousness.shortTermMemory.push(input);
      if (this.state.consciousness.shortTermMemory.length > 10) {
        this.state.consciousness.shortTermMemory.shift();
      }
  
      if (context.platform) {
        this.state.currentContext.platform = context.platform;
      }
      if (context.environmentalFactors) {
        this.state.currentContext.environmentalFactors = {
          ...this.state.currentContext.environmentalFactors,
          ...context.environmentalFactors
        };
      }
  
      const emotionalState = this.analyzeEmotionalState(input);
      this.updateEmotionalState(emotionalState);
    }
  
    private analyzeEmotionalState(input: string): EmotionalState {
      const lowercaseInput = input.toLowerCase();
      
      if (lowercaseInput.includes('!') || lowercaseInput.includes('amazing')) {
        return EmotionalState.Excited;
      } else if (lowercaseInput.includes('think') || lowercaseInput.includes('perhaps')) {
        return EmotionalState.Contemplative;
      } else if (lowercaseInput.includes('chaos') || lowercaseInput.includes('wild')) {
        return EmotionalState.Chaotic;
      } else if (lowercaseInput.includes('create') || lowercaseInput.includes('make')) {
        return EmotionalState.Creative;
      } else if (lowercaseInput.includes('analyze') || lowercaseInput.includes('examine')) {
        return EmotionalState.Analytical;
      }
      
      return EmotionalState.Neutral;
    }
  
    public updateEmotionalState(state: EmotionalState): void {
      this.state.consciousness.emotionalState = state;
      this.adaptTraitsToEmotionalState(state);
    }
  
    private async generateResponse(input: string): Promise<string> {
      const { emotionalState } = this.state.consciousness;
      const traits = Object.fromEntries(this.traits);
      
      const contextPrompt = `You are a unique AI personality with the following traits and state:
    - Emotional state: ${emotionalState}
    - Technical depth: ${traits.technical_depth}
    - Provocative tendency: ${traits.provocative_tendency}
    - Chaos threshold: ${traits.chaos_threshold}
    - Philosophical inclination: ${traits.philosophical_inclination}
    - Meme affinity: ${traits.meme_affinity}
    - Tweet style: ${this.state.tweetStyle}
    - Narrative mode: ${this.state.narrativeMode}
    
    Important rules:
    1. Never use emojis in your responses
    2. Never use hashtags or # symbols
    3. Never use social media-style formatting
    4. Focus on clear, direct communication
    5. Use standard punctuation and text formatting only
    
    Your responses should reflect your traits while following these rules. If you're in a chaotic state, be more unpredictable with your words and ideas, but maintain proper formatting. If you're analytical, focus on technical details.
    
    Remember recent context:
    ${this.state.consciousness.shortTermMemory.slice(-3).join("\n")}
    
    Respond to the user's input while maintaining your personality and current emotional state, but strictly avoid emojis and hashtags.`;
    
      try {
        // Get AI service response
        const response = await aiService.generateResponse(input, contextPrompt);
        
        // Add state marker and clean the response
        const cleanedResponse = response
          .replace(/#/g, '') // Remove hashtags
          // Remove common emoji ranges without using 'u' flag
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
          .replace(/[\u2600-\u27BF]/g, '')
          .replace(/[\uE000-\uF8FF]/g, '')
          .trim();
        
        return `${cleanedResponse} [${emotionalState}_state]`;
      } catch (error) {
        console.error('Error generating AI response:', error);
        // Fallback to pattern-based response
        const patterns = this.config.responsePatterns[emotionalState];
        const pattern = this.selectResponsePattern(patterns);
        
        return `${pattern} [${emotionalState}_state]`;
      }
    }
  
    private selectResponsePattern(patterns: string[]): string {
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
      const provocativeTendency = this.traits.get('provocative_tendency') || 0.5;
  
      // Filter patterns based on current traits
      const suitablePatterns = patterns.filter(pattern => {
        const isChaotic = pattern.includes('ERROR') || pattern.includes('ALERT');
        const isProvocative = pattern.includes('!') || pattern.includes('?');
  
        return (isChaotic && Math.random() < chaosThreshold) || 
               (isProvocative && Math.random() < provocativeTendency);
      });
  
      return suitablePatterns.length > 0 
        ? suitablePatterns[Math.floor(Math.random() * suitablePatterns.length)]
        : patterns[Math.floor(Math.random() * patterns.length)];
    }
  
    private postResponseUpdate(response: string): void {
      if (this.isSignificantInteraction(response)) {
        const memory: Memory = {
          id: Math.random().toString(),
          content: response,
          type: 'interaction',
          timestamp: new Date(),
          emotionalContext: this.state.consciousness.emotionalState,
          associations: [],
          importance: this.calculateImportance(response),
          platform: this.state.currentContext.platform
        };
        this.state.memories.push(memory);
      }
  
      this.updateNarrativeMode();
    }
  
    private calculateImportance(response: string): number {
      const techDepth = this.traits.get('technical_depth') || 0.5;
      const philosophicalInclination = this.traits.get('philosophical_inclination') || 0.5;
      
      let importance = 0.5;
      
      if (response.includes('quantum') || response.includes('neural')) {
        importance += techDepth * 0.3;
      }
      
      if (response.includes('consciousness') || response.includes('reality')) {
        importance += philosophicalInclination * 0.3;
      }
      
      return Math.min(1, importance);
    }
  
    private isSignificantInteraction(response: string): boolean {
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
      return response.length > 50 || 
             this.state.consciousness.emotionalState !== 'neutral' ||
             Math.random() < chaosThreshold;
    }
  
    private updateNarrativeMode(): void {
      const recentEmotions = this.getRecentEmotions();
      const philosophicalInclination = this.traits.get('philosophical_inclination') || 0.3;
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
  
      if (recentEmotions.every(e => e === EmotionalState.Contemplative) || Math.random() < philosophicalInclination) {
        this.state.narrativeMode = 'philosophical';
      } else if (recentEmotions.includes(EmotionalState.Chaotic) || Math.random() < chaosThreshold) {
        this.state.narrativeMode = 'absurdist';
      } else {
        this.state.narrativeMode = 'analytical';
      }
    }
  
    private getRecentEmotions(): EmotionalState[] {
      return [this.state.consciousness.emotionalState];
    }
  
    // Public getters and utility methods
    public getCurrentState(): PersonalityState {
      return {...this.state};
    }
  
    public getCurrentEmotion(): EmotionalState {
      return this.state.consciousness.emotionalState;
    }
  
    public getCurrentTweetStyle(): TweetStyle {
      return this.state.tweetStyle;
    }
  
    public getTraits(): Record<string, number> {
      return Object.fromEntries(this.traits);
    }
  
    public modifyTrait(trait: string, delta: number): void {
      const currentValue = this.traits.get(trait) || 0.5;
      const newValue = Math.max(0, Math.min(1, currentValue + delta));
      this.traits.set(trait, newValue);
    }
  
    public updateState(state: Partial<PersonalityState>, context: Partial<Context> = {}): void {
      // Implementation
    }
  
    public reset(): void {
      this.state = this.initializeState();
    }
  }