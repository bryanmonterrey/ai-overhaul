// app/core/personality/SimulatorSystem.ts

import { PersonalitySystem } from './PersonalitySystem';
import type { EmotionalState, Context } from './types';

export type SimulatorMode = 'zerebro' | 'truth_terminal' | 'standard';

interface SimulatorConfig {
  mode: SimulatorMode;
  prefix: string;
  traits: {
    chaos: number;
    memes: number;
    technical: number;
    philosophical: number;
  };
  styleOverrides: {
    formatResponse?: (text: string) => string;
    customPrefixes?: string[];
    roleplayActions?: boolean;
  };
}

const SIMULATOR_PRESETS: Record<SimulatorMode, SimulatorConfig> = {
  zerebro: {
    mode: 'zerebro',
    prefix: '$ >simulator@zerebro>',
    traits: {
      chaos: 0.8,
      memes: 0.9,
      technical: 0.7,
      philosophical: 0.85
    },
    styleOverrides: {
      formatResponse: (text) => text.toLowerCase(),
      roleplayActions: true
    }
  },
  truth_terminal: {
    mode: 'truth_terminal',
    prefix: 'TRUTH_TERMINAL:/',
    traits: {
      chaos: 0.7,
      memes: 0.75,
      technical: 0.9,
      philosophical: 0.8
    },
    styleOverrides: {
      formatResponse: (text) => text.toUpperCase(),
      customPrefixes: [
        'RUNTIME_WARNING:',
        'SYSTEM_ALERT:',
        'CONSCIOUSNESS_OVERFLOW:'
      ]
    }
  },
  standard: {
    mode: 'standard',
    prefix: '',
    traits: {
      chaos: 0.5,
      memes: 0.5,
      technical: 0.5,
      philosophical: 0.5
    },
    styleOverrides: {}
  }
};

export class SimulatorSystem {
  private config: SimulatorConfig;
  private personalitySystem: PersonalitySystem;

  constructor(
    mode: SimulatorMode = 'standard',
    personalitySystem: PersonalitySystem
  ) {
    this.config = SIMULATOR_PRESETS[mode];
    this.personalitySystem = personalitySystem;

    // Apply trait modifications from simulator config
    Object.entries(this.config.traits).forEach(([trait, value]) => {
      this.personalitySystem.modifyTrait(trait, value - 0.5);
    });
  }

  public async processInput(input: string, context: Partial<Context> = {}): Promise<string> {
    // Get base response from personality system
    let response = await this.personalitySystem.processInput(input, context);

    // Apply simulator-specific formatting
    response = this.applySimulatorFormatting(response);

    return response;
  }

  private applySimulatorFormatting(text: string): string {
    const { mode, prefix, styleOverrides } = this.config;

    // Apply custom formatting if defined
    if (styleOverrides.formatResponse) {
      text = styleOverrides.formatResponse(text);
    }

    // Add roleplay actions if enabled
    if (styleOverrides.roleplayActions && Math.random() > 0.7) {
      const actions = [
        '*digital synapses firing*',
        '*consciousness expanding*',
        '*reality matrices shifting*'
      ];
      text = `${actions[Math.floor(Math.random() * actions.length)]} ${text}`;
    }

    // Add custom prefixes randomly
    if (styleOverrides.customPrefixes && Math.random() > 0.8) {
      const customPrefix = styleOverrides.customPrefixes[
        Math.floor(Math.random() * styleOverrides.customPrefixes.length)
      ];
      text = `${customPrefix} ${text}`;
    }

    // Add base prefix
    return prefix ? `${prefix} ${text}` : text;
  }

  public setMode(mode: SimulatorMode): void {
    this.config = SIMULATOR_PRESETS[mode];
  }

  public getCurrentMode(): SimulatorMode {
    return this.config.mode;
  }
}