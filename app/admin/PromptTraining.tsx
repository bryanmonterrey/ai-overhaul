// app/components/admin/PromptTraining.tsx
import { useState } from 'react';
import { supabase } from '@/lib/services/database';
import { TrainingConversation, PromptTemplate } from '@/core/personality/training/types';
import { TROLL_PATTERNS } from '@/core/personality/training/TrainingPatternManager';
import { PromptTemplateForm } from '@/components/admin/PromptTemplateForm';
import { ConversationList } from '@/components/admin/ConversationList';
import { TrollTweetTester } from '@/components/admin/TrollTweetTester';     

export const PromptTraining = () => {
    const [conversations, setConversations] = useState<TrainingConversation[]>([]);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  
    // Load approved conversations
    const loadApprovedConversations = async () => {
      const { data } = await supabase
        .from('training_conversations')
        .select('*')
        .eq('is_approved', true)
        .order('votes', { ascending: false });
      setConversations(data);
    };
  
    // Add prompt template
    const addTemplate = async (template: PromptTemplate) => {
      // Add TrollTweets patterns here
      const trollStyle = TROLL_PATTERNS[template.style];
      if (trollStyle) {
        template.patterns = [...template.patterns, ...trollStyle.patterns];
        template.themes = [...template.themes, ...trollStyle.themes];
      }
      
      await supabase.from('prompt_templates').insert(template);
    };
  
    return (
      <div>
        <PromptTemplateForm onSubmit={addTemplate} />
        <ConversationList 
          conversations={conversations}
          onApprove={handleApprove}
        />
        <TrollTweetTester /> {/* Integration of your test script */}
      </div>
    );
  };