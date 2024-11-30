// app/core/twitter/twitter-engagement.ts

import { PersonalitySystem } from '../personality/PersonalitySystem';
import { EmotionalSystem } from '../personality/EmotionalSystem';
import { MemorySystem } from '../personality/MemorySystem';
import { NarrativeSystem } from '../personality/NarrativeSystem';
import { TwitterManager } from './twitter-manager';

interface TargetUser {
  id: string;
  username: string;
  topics: string[];
  lastInteraction?: Date;
  interactionCount: number;
  relationship: 'neutral' | 'friendly' | 'close';
}

export class TwitterEngagementSystem {
  private targetUsers: Map<string, TargetUser> = new Map();
  private memoryContext: Map<string, string[]> = new Map(); // userid -> past interactions
  
  constructor(
    private personality: PersonalitySystem,
    private emotional: EmotionalSystem,
    private memory: MemorySystem,
    private narrative: NarrativeSystem,
    private twitter: TwitterManager
  ) {}

  public addTarget(target: Omit<TargetUser, 'interactionCount' | 'relationship'>) {
    this.targetUsers.set(target.id, {
      ...target,
      interactionCount: 0,
      relationship: 'neutral'
    });
  }

  public async monitorTargets() {
    for (const target of this.targetUsers.values()) {
      try {
        // Get target's recent tweets using your existing TwitterManager
        const tweets = await this.twitter.getUserTweets(target.id);

        for (const tweet of tweets) {
          if (await this.shouldEngage(tweet, target)) {
            await this.generateResponse(tweet, target);
          }
        }
      } catch (error) {
        console.error(`Error monitoring ${target.username}:`, error);
      }
    }
  }

  private async shouldEngage(tweet: any, target: TargetUser): Promise<boolean> {
    // Don't reply to everything - use your personality system to decide
    const mood = await this.emotional.getCurrentMood();
    const memory = await this.memory.getRecentInteractions(target.id);
    
    // Basic rate limiting
    if (target.lastInteraction) {
      const hoursSinceLastInteraction = 
        (Date.now() - target.lastInteraction.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastInteraction < 1) return false;
    }

    // Topic relevance check
    const isRelevantTopic = target.topics.some(topic => 
      tweet.text.toLowerCase().includes(topic.toLowerCase())
    );

    // Personality-driven engagement chance
    const baseChance = 0.4; // 40% base chance
    const moodMultiplier = mood === 'excited' ? 1.2 : 
                          mood === 'thoughtful' ? 0.8 : 1;
    
    const relationshipMultiplier = target.relationship === 'close' ? 1.3 :
                                  target.relationship === 'friendly' ? 1.1 : 1;

    return isRelevantTopic && 
           (Math.random() < baseChance * moodMultiplier * relationshipMultiplier);
  }

  private async generateResponse(tweet: any, target: TargetUser) {
    try {
      // Build context from your existing systems
      const mood = await this.emotional.getCurrentMood();
      const memories = await this.memory.getRecentInteractions(target.id);
      const currentNarrative = await this.narrative.getCurrentContext();

      // Use your personality system to generate response
      const response = await this.personality.generateResponse({
        type: 'twitter_reply',
        context: tweet.text,
        mood,
        memories,
        narrative: currentNarrative,
        targetUser: target.username
      });

      // Use your existing tweet length management logic
      const truncatedResponse = this.truncateResponse(response);

      // Post the reply
      await this.twitter.postReply(tweet.id, truncatedResponse);

      // Update target user data
      this.updateTargetRelationship(target);

      // Store interaction in memory
      await this.memory.storeInteraction({
        type: 'twitter_reply',
        targetUser: target.username,
        content: truncatedResponse,
        originalContent: tweet.text,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`Error generating response for ${target.username}:`, error);
    }
  }

  private truncateResponse(response: string): string {
    const MAX_LENGTH = 280;
    if (response.length <= MAX_LENGTH) return response;

    // Find a good breaking point
    const breakPoints = [
      ...response.slice(0, MAX_LENGTH - 20).matchAll(/[.!?]\s/g)
    ].map(m => m.index);

    if (breakPoints.length > 0) {
      return response.slice(0, breakPoints[breakPoints.length - 1] + 1).trim();
    }

    // If no good break point, try breaking at last space
    const lastSpace = response.slice(0, MAX_LENGTH - 3).lastIndexOf(' ');
    return response.slice(0, lastSpace) + '...';
  }

  private updateTargetRelationship(target: TargetUser) {
    target.interactionCount++;
    target.lastInteraction = new Date();

    // Update relationship based on interaction count
    if (target.interactionCount > 20) {
      target.relationship = 'close';
    } else if (target.interactionCount > 10) {
      target.relationship = 'friendly';
    }

    this.targetUsers.set(target.id, target);
  }
}