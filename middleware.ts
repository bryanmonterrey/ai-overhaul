import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/supabase/functions/supabase.types';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ 
    req, 
    res 
  });

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Protected admin routes
  if (pathname.startsWith('/admin') || 
      pathname.startsWith('/api/admin') ||
      pathname.startsWith('/twitter') || 
      pathname.startsWith('/telegram')) {
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Protected chat route
  if (pathname.startsWith('/chat')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Get admin settings
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*');

    const tokenGateEnabled = settings?.find(s => s.key === 'token_gate_enabled')?.value;
    
    if (tokenGateEnabled) {
      const requiredValue = settings?.find(s => s.key === 'required_token_value')?.value || 0;
      
      // Check user's token holdings
      const { data: tokenHoldings } = await supabase
        .from('token_holders')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (!tokenHoldings || tokenHoldings.dollar_value < requiredValue) {
        return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
      }
    }
  }

  // Handle token validation and API routes
  if (pathname.startsWith('/api/token-validation') || pathname.startsWith('/api/chat')) {
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  return res;
}

// Update matcher to include token validation endpoint
export const config = {
  matcher: [
    '/admin/:path*', 
    '/api/admin/:path*', 
    '/chat/:path*',
    '/api/token-validation',
    '/api/chat/:path*',
    '/twitter/:path*',
    '/telegram/:path*'
  ],
};