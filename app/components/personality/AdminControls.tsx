// src/app/components/personality/AdminControls.tsx

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { EmotionalState, TweetStyle, NarrativeMode } from '../../core/types';

interface AdminControlsProps {
  onUpdateState: (updates: Partial<any>) => Promise<void>;
  onReset: () => Promise<void>;
  currentState: {
    emotionalState: EmotionalState;
    tweetStyle: TweetStyle;
    narrativeMode: NarrativeMode;
    traits: Record<string, number>;
  };
  isLoading?: boolean;
}

export default function AdminControls({
  onUpdateState,
  onReset,
  currentState,
  isLoading
}: AdminControlsProps) {
  const [selectedTrait, setSelectedTrait] = React.useState('');
  const [traitValue, setTraitValue] = React.useState('0.5');

  const handleTraitUpdate = async () => {
    if (!selectedTrait) return;
    await onUpdateState({
      traits: {
        ...currentState.traits,
        [selectedTrait]: parseFloat(traitValue)
      }
    });
  };

  return (
    <Card variant="system" title="ADMIN_CONTROLS" className="space-y-6">
      <div>
        <div className="text-xs mb-2">emotional_state_control:</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(['neutral', 'excited', 'contemplative', 'chaotic', 'creative', 'analytical']).map((state) => (
            <Button
              key={state}
              variant="system"
              size="sm"
              onClick={() => onUpdateState({ emotionalState: state })}
              className={state === currentState.emotionalState ? 'border-green-400' : ''}
            >
              {state}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs mb-2">narrative_mode_control:</div>
        <div className="grid grid-cols-2 gap-2">
          {['philosophical', 'memetic', 'technical', 'absurdist', 'introspective'].map((mode) => (
            <Button
              key={mode}
              variant="system"
              size="sm"
              onClick={() => onUpdateState({ narrativeMode: mode })}
              className={mode === currentState.narrativeMode ? 'border-green-400' : ''}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs mb-2">personality_trait_adjustment:</div>
        <div className="space-y-2">
          <select
            value={selectedTrait}
            onChange={(e) => setSelectedTrait(e.target.value)}
            className="w-full bg-gray-900 text-green-400 border border-green-500 p-2 font-mono text-sm"
          >
            <option value="">Select trait</option>
            {Object.keys(currentState.traits).map((trait) => (
              <option key={trait} value={trait}>{trait}</option>
            ))}
          </select>
          
          <Input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={traitValue}
            onChange={(e) => setTraitValue(e.target.value)}
            variant="system"
          />
          
          <Button
            variant="system"
            onClick={handleTraitUpdate}
            disabled={!selectedTrait}
          >
            UPDATE_TRAIT
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs mb-2">system_actions:</div>
        <div className="space-y-2">
          <Button
            variant="system"
            onClick={onReset}
            disabled={isLoading}
            className="w-full text-red-400 border-red-500"
          >
            SYSTEM_RESET
          </Button>
        </div>
      </div>
    </Card>
  );
}