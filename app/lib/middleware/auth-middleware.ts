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
        
        // Wrap the handler in try-catch to ensure we always return a NextResponse
        try {
          const response = await handler(supabase, mockSession);
          return response instanceof NextResponse ? response : 
                 NextResponse.json(response);
        } catch (error) {
          console.error('Handler error in development:', error);
          return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
          );
        }
      }

      if (error || !session) {
        return NextResponse.json(
          { error: 'Unauthorized', details: error?.message },
          { status: 401 }
        );
      }

      // Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleError) {
        console.error('Role check error:', roleError);
        return NextResponse.json(
          { error: 'Error checking user permissions' },
          { status: 500 }
        );
      }

      if (!roleData || roleData.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }

      // Wrap the handler in try-catch to ensure we always return a NextResponse
      try {
        const response = await handler(supabase, session);
        return response instanceof NextResponse ? response : 
               NextResponse.json(response);
      } catch (error) {
        console.error('Handler error:', error);
        return NextResponse.json(
          { 
            error: 'Internal server error',
            details: error.message,
            code: error.code || 'HANDLER_ERROR'
          },
          { status: error.status || 500 }
        );
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Authentication error',
          details: error.message,
          code: 'AUTH_ERROR'
        },
        { status: 500 }
      );
    }
  };
}