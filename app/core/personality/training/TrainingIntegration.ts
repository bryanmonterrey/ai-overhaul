// app/core/personality/training/TrainingIntegration.ts

export class TrainingIntegration {
    constructor(
      private personalitySystem: PersonalitySystem,
      private tweetGenerator: PersonalityDrivenTweetGenerator
    ) {}
  
    async getTrainedPrompt(context: Context): Promise<string> {
      // Get relevant approved conversations
      const { data: conversations } = await supabase
        .from('training_conversations')
        .select('*')
        .eq('is_approved', true)
        .order('votes', { ascending: false })
        .limit(5);
  
      // Get matching prompt templates
      const { data: templates } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_active', true);
  
      // Combine TrollTweets patterns
      const trollPatterns = Object.values(TROLL_PATTERNS)
        .filter(p => p.style === context.style)
        .map(p => ({
          patterns: p.patterns,
          themes: p.themes
        }));
  
      // Generate prompt using all sources
      return this.generateEnhancedPrompt(
        conversations,
        templates,
        trollPatterns,
        context
      );
    }
  }