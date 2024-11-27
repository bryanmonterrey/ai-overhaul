// src/app/core/personality/MemorySystem.ts

import {
    Memory,
    MemoryType,
    EmotionalState,
    Platform,
    MemoryPattern,
    Context
  } from '@/app/core/personality/types';
  
  interface ExtendedMemoryPattern extends MemoryPattern {
    frequency: number;
    lastOccurrence: Date;
    associatedEmotions: EmotionalState[];
    platforms: Platform[];
    pattern: string;
    type: MemoryType;
    importance: number;
    triggers: string[];
    associations: string[];
  }
  
  export class MemorySystem {
    private shortTermMemories: Memory[] = [];
    private longTermMemories: Memory[] = [];
    private patterns: ExtendedMemoryPattern[] = [];
    private readonly STM_LIMIT = 100; // Short-term memory limit
    private readonly LTM_LIMIT = 1000; // Long-term memory limit
  
    constructor() {
      setInterval(() => this.consolidateMemories(), 1000 * 60 * 60); // Run every hour
    }
  
    public addMemory(
      content: string,
      type: MemoryType,
      emotionalContext?: EmotionalState,
      platform?: Platform
    ): Memory {
      const memory: Memory = {
        id: crypto.randomUUID(),
        content,
        type,
        timestamp: new Date(),
        emotionalContext: emotionalContext || EmotionalState.Neutral,
        platform,
        importance: this.calculateImportance(content),
        associations: this.generateAssociations(content)
      };
  
      this.shortTermMemories.push(memory);
      return memory;
    }
  
    private generateAssociations(content: string): string[] {
      return content.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)  // Only keep words longer than 3 chars
        .map(word => word.replace(/[^a-z]/g, '')); // Remove non-letter characters
    }
  
    private calculateImportance(content: string): number {
      let importance = 0.5; // Base importance
  
      // Adjust based on content length and complexity
      importance += Math.min(0.3, content.length / 1000);
      importance += (content.match(/[.!?]/g) || []).length * 0.05;
  
      // Normalize to 0-1 range
      return Math.min(1, Math.max(0, importance));
    }
  
    private consolidateMemories(): void {
      const now = new Date();
      const oneHour = 60 * 60 * 1000;
  
      // Move important memories to long-term storage
      const memoriesForLTM = this.shortTermMemories
        .filter(memory => {
          const age = now.getTime() - memory.timestamp.getTime();
          return age > oneHour && memory.importance > 0.7;
        });
  
      this.longTermMemories.push(...memoriesForLTM);
      this.shortTermMemories = this.shortTermMemories
        .filter(memory => !memoriesForLTM.includes(memory));
  
      // Trim long-term memories if needed
      if (this.longTermMemories.length > this.LTM_LIMIT) {
        this.longTermMemories.sort((a, b) => b.importance - a.importance);
        this.longTermMemories = this.longTermMemories.slice(0, this.LTM_LIMIT);
      }
    }
  
    private updatePatterns(content: string): void {
      const words = content.toLowerCase().split(/\s+/);
      const wordFreq = new Map<string, number>();

      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });

      for (const [word, freq] of Array.from(wordFreq.entries())) {
        if (freq >= 3 && !this.patterns.some(p => p.pattern === word)) {
          this.patterns.push({
            pattern: word,
            frequency: freq,
            lastOccurrence: new Date(),
            associatedEmotions: [],
            platforms: [],
            type: 'experience',
            importance: 0.5,
            triggers: [word],
            associations: [word]
          });
        }
      }
    }
  
    // Public query methods
    public query(
      type?: MemoryType,
      emotionalContext?: EmotionalState,
      platform?: Platform,
      limit: number = 10
    ): Memory[] {
      const allMemories = [...this.shortTermMemories, ...this.longTermMemories];
      
      return allMemories
        .filter(memory => {
          if (type && memory.type !== type) return false;
          if (emotionalContext && memory.emotionalContext !== emotionalContext) return false;
          if (platform && memory.platform !== platform) return false;
          return true;
        })
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);
    }
  
    public getPatterns(): MemoryPattern[] {
      return [...this.patterns]
        .sort((a, b) => b.frequency - a.frequency);
    }
  
    public getAssociatedMemories(content: string, limit: number = 5): Memory[] {
      const words = content.toLowerCase().split(' ');
      const allMemories = [...this.shortTermMemories, ...this.longTermMemories];
      
      return allMemories
        .map(memory => ({
          memory,
          relevance: words.filter(word => 
            memory.content.toLowerCase().includes(word)
          ).length
        }))
        .filter(({ relevance }) => relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .map(({ memory }) => memory)
        .slice(0, limit);
    }
  
    public clearOldMemories(): void {
      const retentionPeriod = 30; // days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);
      
      this.shortTermMemories = this.shortTermMemories.filter(memory => 
        memory.timestamp > cutoffDate || memory.importance > 0.8
      );
      this.longTermMemories = this.longTermMemories.filter(memory => 
        memory.timestamp > cutoffDate || memory.importance > 0.8
      );
    }
  }