export type PersonalityTrait = {
    description: string;
    weight: number;
};

export type EmotionalState = 
    | 'chaotic'
    | 'analytical'
    | 'contemplative'
    | 'creative'
    | 'excited'
    | 'neutral';

export interface PromptContext {
    emotionalState: EmotionalState;
    traits: Record<string, number>;
    content?: string;
    platform: 'twitter' | 'chat';
    style?: string;
    memoryContext?: string;
    trainingExamples?: string[];
}

export type ValidationRule = {
    test: (text: string) => boolean;
    error: string;
};

export type InteractionType = 'mention' | 'reply' | 'quote';

export interface StyleConfiguration {
    traits: string[];
    energyLevel: number;
    chaosThreshold: number;
}

export interface PersonalityConfig {
    baseTemperature: number;
    creativityBias: number;
    emotionalVolatility: number;
    memoryRetention: number;
}