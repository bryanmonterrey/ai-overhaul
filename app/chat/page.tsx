'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ChatComponent from '@/app/components/personality/Chat'; // Changed import name
import { Card } from '@/app/components/common/Card';
import { EmotionalStateDisplay } from '@/app/components/personality/EmotionalStateDisplay';
import { PersonalityMonitor } from '@/app/components/personality/PersonalityMonitor';
import { MemoryViewer } from '@/app/components/personality/MemoryViewer';
import { EmotionalState, NarrativeMode, TweetStyle, PersonalityState } from '@/app/core/types';

export default function ChatPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [systemState, setSystemState] = useState<PersonalityState>({
    traits: {
      technical_depth: 0.8,
      provocative_tendency: 0.7,
      chaos_threshold: 0.6,
      philosophical_inclination: 0.75,
      meme_affinity: 0.65
    },
    tweetStyle: 'shitpost',
    currentContext: {
      activeNarratives: ['system_initialization', 'personality_calibration'],
      platform: 'chat',
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'day',
        platformActivity: 0,
        socialContext: [],
        platform: 'chat'
      }
    },
    consciousness: {
      emotionalState: EmotionalState.Neutral,
      currentThought: '',
      shortTermMemory: [],
      longTermMemory: [],
      attentionFocus: [],
      activeContexts: new Set()
    },
    emotionalProfile: {
      baseState: EmotionalState.Neutral,
      volatility: 0.5,
      triggers: new Map(),
      stateTransitions: new Map()
    },
    narrativeMode: 'analytical',
    memories: []  // This was missing and required by the type
  });

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if token gating is enabled
        const { data: settings } = await supabase
          .from('admin_settings')
          .select('*')
          .eq('key', 'token_gate_enabled')
          .single();

        if (settings?.value) {
          // Check user's token holdings
          const { data: tokenHoldings } = await supabase
            .from('token_holders')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          const requiredValue = settings.value.required_token_value || 0;

          if (!tokenHoldings || tokenHoldings.dollar_value < requiredValue) {
            router.push('/insufficient-tokens');
            return;
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/login');
      }
    };

    checkAccess();
  }, [supabase, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleStateUpdate = (newState: Partial<PersonalityState>) => {
    setSystemState(prev => ({
      ...prev,
      ...newState
    }));
  };

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 h-[calc(100vh-30rem)]">
      <div className="flex flex-col">
        <Card variant="system" className="mb-4">
          <div className="text-xs space-y-1">
            <div>protocol: DIRECT_INTERFACE</div>
            <div>connection_status: ACTIVE</div>
            <div>system: ONLINE</div>
          </div>
        </Card>
        
        <div className="flex-1 min-h-0">
            <ChatComponent 
            personalityState={systemState}
            onPersonalityStateChange={handleStateUpdate}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <EmotionalStateDisplay
          state={systemState.consciousness.emotionalState}
          intensity={systemState.emotionalProfile.volatility}
          narrativeMode={systemState.narrativeMode}
          traits={systemState.traits}
        />
        
        <PersonalityMonitor
          traits={systemState.traits}
          tweetStyle={systemState.tweetStyle}
          activeThemes={systemState.currentContext.activeNarratives}
          className=""
        />
        
        <MemoryViewer
          memories={systemState.memories} 
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}