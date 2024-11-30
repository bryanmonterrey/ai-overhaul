// app/components/admin/PromptTraining.tsx
import { useState } from 'react';
import { supabase } from '@/lib/services/database';
import { 
  TrainingConversation, 
  PromptTemplate 
} from '@/app/core/personality/training/types';
import { TROLL_PATTERNS } from '@/app/core/personality/training/constants';
import { PromptTemplateForm } from '@/app/components/admin/PromptTemplateForm';
import { ConversationList } from '@/app/components/admin/ConversationList';
import { TrollTweetTester } from '@/app/components/admin/TrollTweetTester';     

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
      setConversations(data || []);
    };
  
    // Handle approval
    const handleApprove = async (conversationId: string) => {
      await supabase
        .from('training_conversations')
        .update({ is_approved: true })
        .eq('id', conversationId);
      
      await loadApprovedConversations();
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
      const { data } = await supabase.from('prompt_templates').select('*');
      setTemplates(data || []);
    };
  
    return (
      <div>
        <PromptTemplateForm onSubmit={addTemplate} />
        <ConversationList 
          conversations={conversations}
          onApprove={handleApprove}
        />
        <TrollTweetTester />
      </div>
    );
  };