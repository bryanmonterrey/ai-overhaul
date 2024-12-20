import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/middleware/auth-middleware';
import type { Database } from '../../../../types/supabase';

export async function PATCH(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const { id } = context.params;
            const updates = await req.json();

            const { data, error } = await supabase
                .from('engagement_targets')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Database error:', error);
                throw new Error('Failed to update target');
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

export async function DELETE(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const { id } = context.params;

            const { error } = await supabase
                .from('engagement_targets')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Database error:', error);
                throw new Error('Failed to delete target');
            }

            return NextResponse.json({
                success: true
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