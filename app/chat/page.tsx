'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Chat from '@/app/components/personality/Chat';
import { Card } from '@/app/components/common/Card';
import { EmotionalStateDisplay } from '@/app/components/personality/EmotionalStateDisplay';
import { PersonalityMonitor } from '@/app/components/personality/PersonalityMonitor';
import { MemoryViewer } from '@/app/components/personality/MemoryViewer';
import { EmotionalState, NarrativeMode, TweetStyle } from '@/app/core/types';

interface PersonalityState {
  traits: {
    technical_depth: number;
    provocative_tendency: number;
    chaos_threshold: number;
    philosophical_inclination: number;
    meme_affinity: number;
  };
  tweetStyle: TweetStyle;
  currentContext: {
    activeNarratives: string[];
  };
  consciousness: {
    emotionalState: EmotionalState;
  };
  emotionalProfile: {
    volatility: number;
  };
  narrativeMode: NarrativeMode;
}

interface ChatProps {
  onStateChange: (state: Partial<PersonalityState>) => void;
  initialState: PersonalityState;
}

export default function Chat({ onStateChange, initialState }: ChatProps) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [personalityState, setPersonalityState] = useState<ImportedPersonalityState>(initialState);

  useEffect(() => {
    if (personalityState) {
      onStateChange(personalityState);
    }
  }, [personalityState, onStateChange]);

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
    setPersonalityState(prev => ({
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
        <Chat onStateChange={handleStateUpdate} initialState={personalityState} />
        </div>
      </div>
      
      <div className="space-y-4">
      <EmotionalStateDisplay
          state={personalityState.consciousness.emotionalState}
          intensity={personalityState.emotionalProfile.volatility}
          narrativeMode={personalityState.narrativeMode}
          traits={personalityState.traits}
        />
        
        <PersonalityMonitor
          traits={personalityState.traits}
          tweetStyle={personalityState.tweetStyle}
          activeThemes={personalityState.currentContext.activeNarratives}
        />
        
        <MemoryViewer
          memories={[]}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}