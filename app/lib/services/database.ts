// app/lib/services/database.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
  private supabase = createClientComponentClient();

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async startSession(platform: 'chat' | 'twitter' | 'telegram' = 'chat'): Promise<string> {
    try {
      // Get current user session
      const { data: { session } } = await this.supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      const { data, error } = await this.supabase
        .from('chat_sessions')
        .insert({ 
          platform,
          user_id: session.user.id,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      this.currentSession = data.id;
      console.log('Chat session started:', data.id);
      return data.id;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  async endSession(sessionId: string) {
    try {
      const { error } = await this.supabase
        .from('chat_sessions')
        .update({ 
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
      if (sessionId === this.currentSession) {
        this.currentSession = null;
      }
      console.log('Chat session ended:', sessionId);
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  async logMessage(message: Message, sessionId: string, metrics: {
    responseTime?: number;
    qualityScore?: number;
    tokenCount?: number;
  }) {
    try {
      const { error: messageError } = await this.supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          content: message.content,
          role: message.sender,
          emotional_state: message.emotionalState || 'neutral',
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
      console.log('Message logged for session:', sessionId);
    } catch (error) {
      console.error('Failed to log message:', error);
      throw error;
    }
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get session messages:', error);
      throw error;
    }
  }

  async getHighQualityMessages(
    minQualityScore: number = 0.8,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .gte('quality_score', minQualityScore)
        .order('quality_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get high quality messages:', error);
      throw error;
    }
  }

  // In DatabaseService class, add this method:
async storeMemory(memory: {
  content: string;
  type: string;
  emotional_context: string;
  importance: number;
  associations: string[];
  platform?: string;
}) {
  try {
    // Get current user session
    const { data: { session } } = await this.supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session found');
    }

    const { error } = await this.supabase
      .from('memories')
      .insert({
        ...memory,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        archive_status: 'active'
      });

    if (error) {
      console.error('Error storing memory in DB:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to store memory:', error);
    throw error;
  }
}

  async getSessionStats(sessionId: string) {
    try {
      const { data, error } = await this.supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get session stats:', error);
      throw error;
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSession;
  }
}

export const dbService = DatabaseService.getInstance();