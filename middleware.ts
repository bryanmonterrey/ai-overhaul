import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/supabase/functions/supabase.types';
import { TokenChecker } from './app/lib/blockchain/token-checker';

export async function middleware(req: NextRequest) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const res = NextResponse.next();
  const cookieStore = req.cookies;
  const supabase = createMiddlewareClient<Database>({ 
    req, 
    res 
  });

  // Add CORS headers to all responses
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Specific check for trading chat endpoint
  if (pathname === '/api/trading/admin/chat') {
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          } 
        }
      );
    }
    // If session exists, verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { 
          status: 403, 
          headers: { 
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          } 
        }
      );
    }
    return res;
  }

  // Allow access to login pages
  if (pathname === '/admin/login' || pathname === '/login' || pathname === '/insufficient-tokens') {
    return res;
  }

  // Protected admin routes
  if (pathname.startsWith('/admin') || 
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/twitter') || 
    pathname.startsWith('/telegram') ||
    pathname.startsWith('/trading/admin')) {  
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
    pathname.startsWith('/conversations') ||
    pathname.startsWith('/trading/holders')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
      // Get admin settings
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('*');

      const tokenGateEnabled = settings?.find(s => s.key === 'token_gate_enabled')?.value;
      const requiredTokenValue = Number(settings?.find(s => s.key === 'required_token_value')?.value || 0);
      
      console.log('Token gate settings:', {
        tokenGateEnabled,
        requiredTokenValue
      });
      
      if (tokenGateEnabled) {
        // Get user's wallet address with fallback checks
        let walletAddress: string | null = null;

// Check 1: Get from users table
const { data: userData } = await supabase
  .from('users')
  .select('wallet_address')
  .eq('id', session.user.id)
  .maybeSingle();

console.log('User data from db:', { userData });

if (userData?.wallet_address) {
  walletAddress = userData.wallet_address;
} else {
  console.log('No wallet address in DB, checking metadata');
  // Check 2: Try user_metadata
  const metadataWalletAddress = session.user.user_metadata?.wallet_address;
  
  if (metadataWalletAddress) {
    // Update the users table with the wallet address
    await supabase
      .from('users')
      .update({ wallet_address: metadataWalletAddress })
      .eq('id', session.user.id);
    
    walletAddress = metadataWalletAddress;
    console.log('Found wallet in metadata:', metadataWalletAddress);
  }
}

// If we still don't have a wallet address after all checks
if (!walletAddress) {
  console.log('No wallet address found anywhere');
  return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
}

        // Check actual token holdings
        const tokenChecker = new TokenChecker();
        const { isEligible, value, balance } = await tokenChecker.checkEligibility(walletAddress);

        console.log('Token check results:', {
          walletAddress,
          value,
          balance,
          isEligible,
          requiredValue: requiredTokenValue
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
          return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
        }

        console.log('User eligible, allowing access');
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
    '/api/ai/:path*',
    '/api/agent-kit/:path*',
    '/api/trading/admin/chat',
    '/twitter/:path*',
    '/telegram/:path*',
    '/trading/admin/:path*',
    '/trading/holders/:path*',
    '/api/trading/admin/:path*',
    '/api/trading/holders/:path*',
    '/api/memory/:path*'
  ],
  runtime: 'nodejs',
  unstable_allowDynamic: [
    '**/node_modules/@solana/web3.js/**',
    '**/node_modules/rpc-websockets/**',
    '**/node_modules/buffer/**',
  ]
};