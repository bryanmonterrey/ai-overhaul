export enum EmotionalState {
    Neutral = 'neutral',
    Excited = 'excited',
    Contemplative = 'contemplative',
    Chaotic = 'chaotic',
    Creative = 'creative',
    Analytical = 'analytical'
}
export type TweetStyle = 'shitpost' | 'academic' | 'casual' | 'formal' | 'metacommentary' | 'rant' | 'hornypost' | 'existential';
export type NarrativeMode = 'philosophical' | 'absurdist' | 'analytical' | 'technical' | 'memetic' | 'introspective';
export type MemoryType = 'experience' | 'fact' | 'interaction' | 'insight';
export type Platform = 'twitter' | 'chat' | 'telegram' | 'internal';

export interface Memory {
  id: string;
  content: string;
  type: string;
  timestamp: Date;
  emotionalContext: EmotionalState;
  platform?: string;
  importance: number;
  associations: string[];
}

export interface NarrativeContext {
  mode: NarrativeMode;
  context: Partial<PersonalityState>;
}

export interface PersonalityState {
  consciousness: {
    emotionalState: EmotionalState;
    currentThought: string;
    shortTermMemory: string[];
    longTermMemory: string[];
    attentionFocus: string[];
    activeContexts: Set<string>;
    traits?: Record<string, number>; // Add this to properly type the traits
  };
  emotionalProfile: {
    baseState: EmotionalState;
    volatility: number;
    triggers: Map<string, EmotionalState>;
    stateTransitions: Map<EmotionalState, EmotionalState[]>;
  };
  memories: Memory[];
  tweetStyle: TweetStyle;
  narrativeMode: NarrativeMode;
  currentContext: Context;
}

export interface Context {
  platform: Platform;
  recentInteractions: string[];
  environmentalFactors: {
    timeOfDay: string;
    platformActivity: number;
    socialContext: string[];
    platform: string;
  };
  activeNarratives: string[];
}

export interface EmotionalResponse {
  state: EmotionalState | null;
  intensity: number;
  trigger: string;
  duration: number;
  associatedMemories: string[];
}

export interface EmotionalProfile {
  baseState: EmotionalState;
  volatility: number;
  triggers: Map<string, EmotionalState>;
  stateTransitions: Map<EmotionalState, EmotionalState[]>;
}

export interface ConsciousnessState {
  emotionalState: EmotionalState;
  currentThought: string;
  shortTermMemory: string[];
  longTermMemory: string[];
  attentionFocus: string[];
  activeContexts: Set<string>;
}

export interface PersonalityConfig {
  baseTemperature: number;
  creativityBias: number;
  emotionalVolatility: number;
  memoryRetention: number;
  responsePatterns: Record<EmotionalState, string[]>;
}

export interface MemoryPattern {
  type: MemoryType;
  importance: number;
  triggers: string[];
  associations: string[];
} 