import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/supabase/functions/supabase.types';
import { TokenChecker } from '@/app/lib/blockchain/token-checker';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const cookieStore = req.cookies;
  const supabase = createMiddlewareClient<Database>({ 
    req, 
    res 
  });

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Allow access to login pages
  if (pathname === '/admin/login' || pathname === '/login' || pathname === '/insufficient-tokens') {
    return res;
  }

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

  // Protected chat routes
  if (pathname.startsWith('/chat') || 
      pathname.startsWith('/conversation') || 
      pathname.startsWith('/conversations')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
      // Get admin settings
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('*');

      const tokenGateEnabled = settings?.find(s => s.key === 'token_gate_enabled')?.value;
      
      if (tokenGateEnabled) {
        // Get user's wallet address
        const { data: userData } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('id', session.user.id)
          .single();

        if (!userData?.wallet_address) {
          return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
        }

        // Check actual token holdings
        const tokenChecker = new TokenChecker();
        const { isEligible, value } = await tokenChecker.checkEligibility(userData.wallet_address);

        if (!isEligible) {
          // Update token holdings in database
          await supabase
            .from('token_holders')
            .upsert({
              user_id: session.user.id,
              wallet_address: userData.wallet_address,
              dollar_value: value,
              last_checked: new Date().toISOString()
            });

          // Clear session for ineligible users
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
        }

        // Update token holdings for eligible users
        await supabase
          .from('token_holders')
          .upsert({
            user_id: session.user.id,
            wallet_address: userData.wallet_address,
            dollar_value: value,
            last_checked: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Token check error:', error);
      return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
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

export const config = {
  matcher: [
    '/admin/:path*', 
    '/api/admin/:path*', 
    '/chat/:path*',
    '/conversation/:path*',
    '/conversations/:path*',
    '/api/token-validation',
    '/api/chat/:path*',
    '/twitter/:path*',
    '/telegram/:path*',
    '/((?!insufficient-tokens|login|api/auth).*)',
    '/api/memory/:path*', // Exclude specific public routes
  ],
};