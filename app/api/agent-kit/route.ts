// app/api/agent-kit/route.ts
import { NextResponse } from 'next/server';
import { tradeExecution } from '../../trading/services/execution';
import { PublicKey } from '@solana/web3.js';

export async function POST(req: Request) {
  try {
    const { action, params } = await req.json();

    switch(action) {
      case 'trade':
        const tradeResult = await tradeExecution.executeTradeWithMEV(params, params.wallet);
        return NextResponse.json(tradeResult);
        
      case 'getTokenData':
        const tokenData = await tradeExecution.validateToken(params.mint);
        return NextResponse.json(tokenData);
        
      case 'getPrice':
        const price = await tradeExecution.getTokenPrice(params.mint);
        return NextResponse.json({ price });

      case 'getRoutes':
        const routes = await tradeExecution.getRoutes(
          params.inputMint,
          params.outputMint,
          params.amount
        );
        return NextResponse.json(routes);

      case 'validateTransaction':
        const validationResult = await tradeExecution.validateAndSimulateTrade(params);
        return NextResponse.json(validationResult);
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          supported: ['trade', 'getTokenData', 'getPrice', 'getRoutes', 'validateTransaction']
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Agent-kit API error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}