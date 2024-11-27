// src/lib/services/database.ts

import { supabase } from '../supabase';
import type { ChatSession, ChatMessage, QualityMetric, TrainingData } from '@/types/database';
import { Message } from '@/app/core/types/chat';

interface TrainingDataRecord {
  message_id: string;
  prompt: string;
  completion: string;
  quality_score: number;
  metadata: Record<string, any>;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private currentSession: string | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async startSession(platform: 'chat' | 'twitter' | 'telegram' = 'chat'): Promise<string> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ platform })
      .select()
      .single();

    if (error) throw error;
    this.currentSession = data.id;
    return data.id;
  }

  async endSession(sessionId: string) {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
    if (sessionId === this.currentSession) {
      this.currentSession = null;
    }
  }

  async logMessage(message: Message, sessionId: string, metrics: {
    responseTime?: number;
    qualityScore?: number;
    tokenCount?: number;
  }) {
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        content: message.content,
        role: message.sender,
        emotion: message.emotionalState || 'neutral',
        model_used: message.aiResponse?.model,
        token_count: metrics.tokenCount || message.aiResponse?.tokenCount.total,
        response_time: metrics.responseTime,
        quality_score: metrics.qualityScore,
        metadata: {
          error: message.error,
          retryable: message.retryable,
          aiResponse: message.aiResponse
        }
      });

    if (messageError) throw messageError;
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getHighQualityMessages(
    minQualityScore: number = 0.8,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .gte('quality_score', minQualityScore)
      .order('quality_score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getSessionStats(sessionId: string) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }

  getCurrentSessionId(): string | null {
    return this.currentSession;
  }

  async saveTrainingData(data: TrainingDataRecord): Promise<void> {
    // Implement your database save logic here
    // Example: await this.db.collection('training_data').insert(data);
  }
}

export const dbService = DatabaseService.getInstance();