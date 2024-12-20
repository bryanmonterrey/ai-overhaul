import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseClient } from '../supabase/server';

export function withAuth(handler: (supabase: any, session: any) => Promise<NextResponse>) {
  return async function(req: NextRequest): Promise<NextResponse> {
    try {
      const supabase = getSupabaseClient();

      // Get session
      const { data: { session }, error } = await supabase.auth.getSession();

      // Check if in development mode
      if (process.env.NODE_ENV === 'development') {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', 'dev-user')
          .single();

        const mockSession = {
          user: {
            id: 'dev-user',
            role: roleData?.role || 'admin',
          },
        };
        return handler(supabase, mockSession);
      }

      if (error || !session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (!roleData || roleData.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return handler(supabase, session);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication error', details: error.message }, 
        { status: 500 }
      );
    }
  };
}