import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TokenChecker } from '@/app/lib/blockchain/token-checker';

export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get the authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenChecker = new TokenChecker();
    const balance = await tokenChecker.getTokenBalance(walletAddress);
    const price = await tokenChecker.getTokenPrice();
    const value = balance * price;

    // Update the token_holders table
    await supabase
      .from('token_holders')
      .upsert({
        user_id: session.user.id,
        wallet_address: walletAddress,
        token_balance: balance,
        dollar_value: value,
        last_checked_at: new Date().toISOString()
      });

    const isEligible = await tokenChecker.checkEligibility(walletAddress);

    return NextResponse.json({
      success: true,
      isEligible,
      balance,
      value
    });
  } catch (error) {
    console.error('Error in token validation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}