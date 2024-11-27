// app/api/token-validation/route.ts
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

    // Initialize Supabase client and get session
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenChecker = new TokenChecker();
    
    try {
      // Get balance and price concurrently
      const [balance, price] = await Promise.all([
        Promise.race([
          tokenChecker.getTokenBalance(walletAddress),
          new Promise<number>((_, reject) => 
            setTimeout(() => reject(new Error('Balance check timeout')), 10000)
          )
        ]),
        tokenChecker.getTokenPrice()
      ]);

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
      }

      const isEligible = await tokenChecker.checkEligibility(walletAddress);

      return NextResponse.json({
        success: true,
        isEligible,
        balance,
        value,
        price
      });
    } catch (error: any) {
      if (error.message === 'Balance check timeout') {
        return NextResponse.json(
          { error: 'Balance check timed out' },
          { status: 408 }
        );
      }
      throw error; // Re-throw other errors to be caught by outer try-catch
    }
  } catch (error: any) {
    console.error('Error in token validation:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}