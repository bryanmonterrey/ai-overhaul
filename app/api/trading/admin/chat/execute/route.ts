// app/api/admin/trading/chat/execute/route.ts
import { NextResponse } from 'next/server';
import { solanaService } from '../../../../../lib/solana';
import { PublicKey } from '@solana/web3.js';

async function calculateDynamicSlippage(tokenData: any, priceData: any): Promise<number> {
  const volatility = await solanaService.getVolatility(tokenData.address);
  const liquidity = tokenData.liquidity || 0;
  
  // Base slippage starts at 1%
  let slippage = 100;
  
  // Adjust for volatility (0-100% scale)
  if (volatility > 50) {
    slippage += volatility * 2;
  }
  
  // Adjust for liquidity (inverse relationship)
  if (liquidity < 100000) {  // Example threshold
    slippage += (100000 - liquidity) / 1000;
  }
  
  // Cap maximum slippage at 5%
  return Math.min(slippage, 500);
}

export async function POST(req: Request) {
  try {
    const { token, side, amount, price } = await req.json();
    
    const tokenData = await solanaService.getTokenData(token);
    const priceData = await solanaService.pythFetchPrice(token);
    const slippage = await calculateDynamicSlippage(tokenData, priceData);

    const sourceMint = side === 'buy' ? new PublicKey("So11111111111111111111111111111111111111112") : new PublicKey(token);
    const targetMint = side === 'buy' ? new PublicKey(token) : new PublicKey("So11111111111111111111111111111111111111112");

    const signature = await solanaService.trade({
      targetMint,
      amount: amount * Math.pow(10, tokenData.decimals),
      inputMint: sourceMint,
      slippage
    });

    return NextResponse.json({
      success: true,
      signature,
      tokenData,
      priceData,
      slippage: slippage / 100  // Convert to percentage
    });

  } catch (error) {
    console.error('Trade execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}