import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

export class TwitterTrainingService {
    private supabase;

    constructor() {
        const cookieStore = cookies();
        this.supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    }

    async saveTweet(content: string, source: string, themes?: string[]) {
        const { data, error } = await this.supabase
            .from('tweet_training_data')
            .insert([{
                content,
                source,
                themes: themes || [],
                engagement_score: 0
            }])
            .select();

        if (error) {
            console.error('Error saving tweet:', error);
            throw error;
        }
        
        return data;
    }

    async getTrainingExamples(count: number = 3, source?: string) {
        let query = this.supabase
            .from('tweet_training_data')
            .select('*');
        
        if (source) {
            query = query.eq('source', source);
        }
        
        const { data, error } = await query
            .order('random()')
            .limit(count);

        if (error) {
            console.error('Error fetching training examples:', error);
            throw error;
        }
        
        return data;
    }

    async bulkImportTweets(tweets: string[], source: string = 'truth_terminal') {
        const tweetsToInsert = tweets.map(content => ({
            content,
            source,
            themes: [],
            engagement_score: 0
        }));

        const { data, error } = await this.supabase
            .from('tweet_training_data')
            .insert(tweetsToInsert)
            .select();

        if (error) {
            console.error('Error bulk importing tweets:', error);
            throw error;
        }

        return data;
    }
}