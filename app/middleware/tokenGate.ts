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

    // Check if token gating is enabled - handle jsonb value
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'token_gate_enabled')
      .single();

    if (!settings?.value?.enabled) {
      return { isValid: true, redirect: '' };
    }

    const walletAddress = session.user.user_metadata.wallet_address;
    const checker = TokenChecker.getInstance();
    const { isEligible, balance, value } = await checker.checkEligibility(walletAddress);

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
      return { isValid: false, redirect: '/insufficient-tokens' };
    }

    return { isValid: true, redirect: '' };

  } catch (error) {
    console.error('Token check error:', error);
    return { isValid: false, redirect: '/login' };
  }
}

export async function middleware(req: NextRequest) {
  try {
    if (isPublicPath(req.nextUrl.pathname)) {
      return NextResponse.next();
    }

    if (!isProtectedPath(req.nextUrl.pathname)) {
      return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Session error or no session:', sessionError);
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { isValid, redirect } = await checkTokenGating(supabase, session, req);
    
    if (!isValid) {
      return NextResponse.redirect(new URL(redirect, req.url));
    }

    return res;

  } catch (error) {
    console.error('Middleware error:', error);
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