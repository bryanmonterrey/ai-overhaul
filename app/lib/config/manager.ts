// src/app/lib/config/manager.ts

import { defaultConfig } from './default';
import { configSchema, ValidConfig } from './schemas';
import { developmentConfig, productionConfig, testConfig } from './environments';
import deepMerge from 'deepmerge';
import { aiConfigSchema } from './ai-schemas';
import { AIConfig } from '@/app/core/types/ai';

class ConfigManager {
  private static instance: ConfigManager;
  private config: ValidConfig;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): ValidConfig {
    let envConfig: Partial<ValidConfig>;
    switch (this.environment) {
      case 'production':
        envConfig = productionConfig;
        break;
      case 'test':
        envConfig = testConfig;
        break;
      default:
        envConfig = developmentConfig;
    }

    // Merge configurations
    const mergedConfig = deepMerge(defaultConfig, envConfig);

    // Validate configuration
    try {
      return configSchema.parse(mergedConfig);
    } catch (error) {
      console.error('Configuration validation failed:', error);
      throw new Error('Invalid configuration');
    }
  }

  public get<
    K extends keyof ValidConfig,
    SK extends keyof ValidConfig[K]
  >(category: K, key: SK): ValidConfig[K][SK] {
    return this.config[category][key];
  }

  public getAll(): ValidConfig {
    return this.config;
  }

  public override(overrides: Partial<ValidConfig>): void {
    if (this.environment === 'production') {
      throw new Error('Configuration cannot be overridden in production');
    }

    const newConfig = deepMerge(this.config, overrides);
    try {
      this.config = configSchema.parse(newConfig);
    } catch (error) {
      console.error('Configuration override validation failed:', error);
      throw new Error('Invalid configuration override');
    }
  }

  public validateConfig(): boolean {
    try {
      configSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }

  public getEnvironment(): string {
    return this.environment;
  }
}

export const configManager = ConfigManager.getInstance();

// Helper function for type-safe config access
export function getConfig<
  K extends keyof ValidConfig,
  SK extends keyof ValidConfig[K]
>(category: K, key: SK): ValidConfig[K][SK] {
  return configManager.get(category, key);
}

// Export for use in tests or development
export const __configManager = ConfigManager;