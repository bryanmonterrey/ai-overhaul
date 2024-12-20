import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import type { Database } from '../../../types/supabase';
import type { EngagementTargetRow } from '../../../types/supabase';

export async function GET() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const { data: targets, error } = await supabase
                .from('engagement_targets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Database error:', error);
                throw new Error('Failed to fetch targets');
            }

            return NextResponse.json(targets);
        } catch (error: any) {
            console.error('Server error:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    });
}

export async function POST(req: Request) {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const body = await req.json();

            // Validate required fields
            if (!body.username || !body.twitter_id) {
                return NextResponse.json(
                    { error: 'Missing required fields' },
                    { status: 400 }
                );
            }

            const target = {
                username: body.username,
                topics: body.topics || [],
                twitter_id: body.twitter_id,
                reply_probability: body.replyProbability || 0.5,
                relationship_level: 'new' as const,
                preferred_style: body.preferredStyle || 'default',
                last_interaction: null
            };

            const { data, error } = await supabase
                .from('engagement_targets')
                .insert([target])
                .select()
                .single();

            if (error) {
                console.error('Database error:', error);
                throw new Error('Failed to create target');
            }

            return NextResponse.json({
                success: true,
                data
            });
        } catch (error: any) {
            console.error('Server error:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    });
}