// app/types/supabase.ts

import type { Database as BaseDatabase } from '@/types/supabase.types';
import { supabase } from '@/types/supabase';

export interface EngagementTargetRow {
  id: string;
  username: string;
  twitter_id: string;
  topics: string[];
  reply_probability: number;
  last_interaction: string | null;
  relationship_level: 'new' | 'familiar' | 'close';
  preferred_style: string;
  created_at: string;
  total_interactions: number;
}

export interface EngagementHistoryRow {
  id: string;
  target_id: string;
  tweet_id: string;
  reply_id: string;
  engagement_type: string;
  timestamp: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagement_rate: number;
  } | null;
  created_at: string;
}

export interface EngagementRules {
    maxRepliesPerDay: number;
    cooldownPeriod: number;  // minutes
    topicRelevanceThreshold: number;
    replyTypes: ('agree' | 'disagree' | 'question' | 'build')[];
}

// Fixed Database interface
export type Database = BaseDatabase & {
  public: {
    Tables: {
      engagement_targets: {
        Row: EngagementTargetRow
        Insert: Omit<EngagementTargetRow, 'id' | 'created_at'>
        Update: Partial<Omit<EngagementTargetRow, 'id' | 'created_at'>>
      }
      engagement_history: {
        Row: EngagementHistoryRow
        Insert: Omit<EngagementHistoryRow, 'id' | 'created_at'>
        Update: Partial<Omit<EngagementHistoryRow, 'id' | 'created_at'>>
      }
    } & BaseDatabase['public']['Tables']
    Views: BaseDatabase['public']['Views']
    Functions: BaseDatabase['public']['Functions']
    Enums: BaseDatabase['public']['Enums']
    CompositeTypes: BaseDatabase['public']['CompositeTypes']
  }
}

// Helper functions for engagement targets
export async function getEngagementTargets() {
  const { data, error } = await supabase
    .from('engagement_targets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addEngagementTarget(target: Omit<EngagementTargetRow, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('engagement_targets')
    .insert([target])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEngagementTarget(id: string, updates: Partial<EngagementTargetRow>) {
  const { data, error } = await supabase
    .from('engagement_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEngagementTarget(id: string) {
  const { error } = await supabase
    .from('engagement_targets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

