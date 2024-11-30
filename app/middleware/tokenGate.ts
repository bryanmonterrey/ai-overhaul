import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenChecker } from '../lib/blockchain/token-checker';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check if path requires token gating
  if (req.nextUrl.pathname.startsWith('/chat')) {
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'token_gate_enabled')
      .single();

    if (settings?.value) {
      const { data: userData } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', session.user.id)
        .single();

      if (!userData?.wallet_address) {
        return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
      }

      const tokenChecker = new TokenChecker();
      const { isEligible } = await tokenChecker.checkEligibility(userData.wallet_address);

      if (!isEligible) {
        return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/chat/:path*']
};