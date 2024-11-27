// app/api/token-validation/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TokenChecker } from '@/app/lib/blockchain/token-checker';
import { Database } from '@/supabase/functions/supabase.types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();
    
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length !== 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => Promise.resolve(cookieStore)
    });

    // Session check is now handled by middleware
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenChecker = new TokenChecker();
    
    try {
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
        console.warn('Token price returned as 0');
      }

      const value = balance * price;

      // Update token holdings
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

      // Get admin settings for eligibility check
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('*');

      const requiredValue = settings?.find(s => s.key === 'required_token_value')?.value || 0;
      const isEligible = value >= requiredValue;

      return NextResponse.json({
        success: true,
        isEligible,
        balance,
        value,
        price,
        requiredValue
      });
    } catch (error: any) {
      if (error.message === 'Balance check timeout') {
        return NextResponse.json(
          { error: 'Balance check timed out' },
          { status: 408 }
        );
      }
      throw error;
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