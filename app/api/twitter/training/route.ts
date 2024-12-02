import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';

export async function POST(request: Request) {
    try {
        const { content, source, themes } = await request.json();
        
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

        const { data, error } = await supabase
            .from('tweet_training_data')
            .insert([{
                content,
                source,
                themes: themes || [],
                engagement_score: 0
            }])
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Training data error:', error);
        return NextResponse.json(
            { error: 'Error saving training data' }, 
            { status: 500 }
        );
    }
}

// CSV upload endpoint
export async function PUT(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            throw new Error('No file uploaded');
        }

        const csvText = await file.text();
        const rows = csvText.split('\n').map(row => {
            // Handle possible quoted CSV values
            const matches = row.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
            if (!matches) return [];
            return matches.map(val => 
                val.replace(/^,?"?|"?$/g, '') // Remove commas and quotes
                   .replace(/""/g, '"')  // Replace double quotes with single quotes
                   .trim()
            );
        });
        
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

        // Skip header row and process data
        const tweets = rows.slice(1).map(row => ({
            content: row[0],
            source: row[1] || 'csv_import',
            themes: row[2] ? row[2].split(';').map(t => t.trim()) : [],
            engagement_score: 0
        })).filter(t => t.content); // Filter out empty rows

        const { data, error } = await supabase
            .from('tweet_training_data')
            .insert(tweets)
            .select();

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            inserted: data?.length 
        });
    } catch (error) {
        console.error('CSV upload error:', error);
        return NextResponse.json(
            { error: 'Error processing CSV' }, 
            { status: 500 }
        );
    }
}

// Get training data
export async function GET() {
    try {
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

        const { data, error } = await supabase
            .from('tweet_training_data')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching training data:', error);
        return NextResponse.json(
            { error: 'Error fetching training data' }, 
            { status: 500 }
        );
    }
}