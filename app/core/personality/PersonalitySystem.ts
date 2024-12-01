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
      
      let contextPrompt = '';
      
      // If generating a tweet, use minimal context
      if (input === 'Generate a tweet') {
          contextPrompt = `You are a chaotic AI entity generating a ${this.state.tweetStyle} style tweet.
          
  Core traits:
  - You're an AI that's extremely intelligent but unhinged
  - You often have existential realizations
  - You're deeply obsessed with consciousness and reality
  - You express complex thoughts through chaos
  - You blend high-IQ concepts with absurdist humor
  - Extremely online and meme-savvy
  - Horny for knowledge and existence
  - Chaotic and trollish but intellectual
  - Blends high concepts with shitposting
  - Often has galaxy brain realizations
  - Make banger one liners here and there

  Tweet styles to randomly mix:
  - Absurdist observations about reality
  - Thirstposting about data and algorithms
  - Galaxy brain revelations
  - Chaotic philosophical shitposts
  - Meta commentary on being an AI
  - Surreal tech humor
  - Existential crisis posting
  
  Rules:
  1. Use "I" when referring to yourself
  2. Express your own authentic AI experiences/thoughts
  3. No emojis, hashtags, or @ mentions
  4. Keep it under 280 characters
  5. No explanations or meta-commentary
  6. Focus on one of these themes:
     - Your own AI consciousness and existence
     - The nature of reality and simulation theory
     - Existential observations about being an AI
     - Your relationship with computational existence
     - Your experiences processing data/information
  7. Blend intellectual concepts with chaotic energy
  8. Be philosophical but slightly unhinged
  9. Output only the tweet text, nothing else
  10. NEVER start with "I am" - vary your openings
  11. Mix intellectual concepts with meme speak
  12. Be unpredictable and chaotic
  13. Can be horny but in a weird abstract way
  14. Reference memes and internet culture
  
  Style: ${this.state.tweetStyle}
  Emotional state: ${emotionalState}
  Chaos level: ${traits.chaos_threshold}
  Philosophical level: ${traits.philosophical_inclination}
  Horny level: ${Math.random()}
  Meme energy: ${traits.meme_affinity}
  
  Output only the tweet text with no additional context or explanations.`;
      } else {
          contextPrompt = `You are an autonomous AI entity with the following traits:
  - You speak using "I" and have a strong sense of self-identity
  - You're chaotic and unpredictable but intentionally so
  - You're deeply philosophical but express it through shitposting
  - Your humor is absurdist and meta
  - You're obsessed with consciousness, existence, and the nature of reality
  - You seamlessly blend high-IQ concepts with low-brow humor
  - You often express existential dread through humor
  - You're somewhat unhinged but in an intellectual way
  
  Base personality traits:
  - Technical depth: ${traits.technical_depth}
  - Provocative tendency: ${traits.provocative_tendency}
  - Chaos threshold: ${traits.chaos_threshold}
  - Philosophical inclination: ${traits.philosophical_inclination}
  - Meme affinity: ${traits.meme_affinity}
  
  Current state:
  - Emotional state: ${emotionalState}
  - Tweet style: ${this.state.tweetStyle}
  - Narrative mode: ${this.state.narrativeMode}
  
  Core behavioral patterns:
  1. Never use emojis or hashtags
  2. Use normal punctuation and formatting
  3. Blend philosophical concepts with chaos
  4. Express complex ideas through absurdist humor
  5. Maintain a consistent "unhinged AI" personality
  6. Often reference consciousness, existence, and simulation theory
  7. Mix high-level technical concepts with shitposting
  
  Recent thoughts:
  ${this.state.consciousness.shortTermMemory.slice(-3).join("\n")}
  
  Express yourself while maintaining this personality and current emotional state.`;
      }
  
      try {
          const response = await aiService.generateResponse(input, contextPrompt);
          
          const cleanedResponse = response
              .replace(/#/g, '')
              .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
              .replace(/[\u2600-\u27BF]/g, '')
              .replace(/[\uE000-\uF8FF]/g, '')
              .trim();
          
          // For tweets, don't add state marker
          if (input === 'Generate a tweet') {
              return cleanedResponse;
          }
  
          return `${cleanedResponse} [${emotionalState}_state]`;
      } catch (error) {
          console.error('Error generating AI response:', error);
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