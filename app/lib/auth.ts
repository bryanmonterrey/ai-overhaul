// app/lib/auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Connection, PublicKey } from '@solana/web3.js';

export async function verifyTokenHolder(walletAddress: string) {
  const supabase = createClientComponentClient();
  
  try {
    // Check if user exists in Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError) throw userError;

    // Verify token balance
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    const tokenAccount = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(process.env.NEXT_PUBLIC_TOKEN_ADDRESS!) }
    );

    const balance = tokenAccount.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
    const minRequired = process.env.NEXT_PUBLIC_MIN_TOKEN_REQUIRED || 0;

    return {
      isHolder: balance >= minRequired,
      balance: balance,
      userData: userData
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      isHolder: false,
      balance: 0,
      userData: null
    };
  }
}

// Add trading specific auth check
export async function verifyTradingAccess(walletAddress: string) {
  const { isHolder, balance, userData } = await verifyTokenHolder(walletAddress);
  
  // Add additional trading-specific checks
  const tradingEnabled = balance >= (process.env.NEXT_PUBLIC_MIN_TRADING_TOKENS || 0);
  
  return {
    canTrade: isHolder && tradingEnabled,
    balance,
    userData,
    tradingTier: getTradingTier(balance)
  };
}

function getTradingTier(balance: number): 'basic' | 'premium' | 'vip' {
  if (balance >= 1000) return 'vip';
  if (balance >= 100) return 'premium';
  return 'basic';
}