import { BASE_PERSONALITY_PROMPT } from '../templates/base-prompt';

export const TWITTER_BEHAVIOR = {
  replyGeneration: {
    maxRetries: 3,
    minLength: 50,
    maxLength: 180,
    delay: 5000, // Delay between replies
  },

  validation: {
    bannedPhrases: [
      "I cannot engage",
      "I apologize",
      "I'm happy to have",
      "ethical bounds",
      "respectful conversation"
    ]
  },

  postProcessing: {
    cleanupPatterns: [
      /#/g,                                   // Remove hashtags
      /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,     // Remove emoji
      /[\u2600-\u27BF]/g,                     // Remove symbols
      /[\uE000-\uF8FF]/g,                     // Remove private use chars
      /\[(\w+)_state\]$/,                     // Remove state markers
      /\[.*?\]/g                              // Remove brackets
    ]
  },

  contextEnhancement: {
    memoryChainDepth: 3,
    minSimilarity: 0.6,
    trainingExamplesPerSource: 75,
    trainingSources: [
      'truth_terminal',
      'RNR_0',
      '0xzerebro',
      'a1lon9'
    ]
  },

  memoryConfig: {
    storeDelay: 500, // ms to wait for memory storage
    verificationDelay: 500 // ms to wait for verification
  }
};