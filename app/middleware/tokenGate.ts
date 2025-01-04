import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenChecker } from '../lib/blockchain/token-checker';

const PROTECTED_PATHS = [
  '/chat',
  '/conversation',
  '/conversations',
  '/trading/holders'
];

const PUBLIC_PATHS = [
  '/login',
  '/insufficient-tokens'
];

const isProtectedPath = (pathname: string): boolean => {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
};

const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
};

async function checkTokenGating(supabase: any, session: any, req: NextRequest): Promise<{ 
  isValid: boolean; 
  redirect: string;
}> {
  try {
    if (isPublicPath(req.nextUrl.pathname)) {
      return { isValid: true, redirect: '' };
    }

    // First check token_gate_enabled
    const { data: enabledSettings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'token_gate_enabled')
      .single();

    console.log('Token gate enabled check:', {
      settings: enabledSettings,
      value: enabledSettings?.value
    });

    // If token gating is disabled, allow access
    if (!enabledSettings?.value) {
      return { isValid: true, redirect: '' };
    }

    const walletAddress = session.user.user_metadata.wallet_address;
    const checker = TokenChecker.getInstance();
    const { isEligible, balance, value } = await checker.checkEligibility(walletAddress);

    console.log('Token check results:', {
      walletAddress,
      balance,
      value,
      isEligible
    });

    // Update token holdings
    await supabase
      .from('token_holders')
      .upsert({
        user_id: session.user.id,
        wallet_address: walletAddress,
        token_balance: balance,
        dollar_value: value,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (!isEligible) {
      console.log('User not eligible, redirecting to insufficient tokens');
      return { isValid: false, redirect: '/insufficient-tokens' };
    }

    console.log('User eligible, allowing access');
    return { isValid: true, redirect: '' };

  } catch (error) {
    console.error('Token check error:', error);
    return { isValid: false, redirect: '/login' };
  }
}

export async function middleware(req: NextRequest) {
  try {
    // First check if current path is login
    if (req.nextUrl.pathname === '/login') {
      return NextResponse.next();
    }

    // Then check if path needs protection
    if (!isProtectedPath(req.nextUrl.pathname)) {
      return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check token gating
    const { isValid, redirect } = await checkTokenGating(supabase, session, req);
    if (!isValid) {
      return NextResponse.redirect(new URL(redirect, req.url));
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/conversation/:path*',
    '/conversations/:path*',
    '/trading/holders/:path*'
  ]
};