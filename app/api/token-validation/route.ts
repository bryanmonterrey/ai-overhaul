import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TokenChecker } from '@/app/lib/blockchain/token-checker';

export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();
    
    // Validate wallet address format
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length !== 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenChecker = new TokenChecker();
    
    // Get balance with timeout
    const balance = await Promise.race([
      tokenChecker.getTokenBalance(walletAddress),
      new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Balance check timeout')), 10000)
      )
    ]);

    const price = await tokenChecker.getTokenPrice();
    if (price === 0) {
      console.warn('Token price returned as 0, might indicate an issue with price feed');
    }

    const value = balance * price;

    // Update the token_holders table
    const { error: upsertError } = await supabase
      .from('token_holders')
      .upsert({
        user_id: session.user.id,
        wallet_address: walletAddress,
        token_balance: balance,
        dollar_value: value,
        last_checked_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Error updating token_holders:', upsertError);
      // Continue execution but log the error
    }

    const isEligible = await tokenChecker.checkEligibility(walletAddress);

    return NextResponse.json({
      success: true,
      isEligible,
      balance,
      value,
      price // Include price in response for debugging
    });
  } catch (error: any) {
    console.error('Error in token validation:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message // Include error message for debugging
      },
      { status: 500 }
    );
  }
}