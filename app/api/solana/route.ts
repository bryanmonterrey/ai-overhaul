// app/api/solana/route.ts
import { NextResponse } from 'next/server';
import { SolanaAgentKit } from 'solana-agent-kit';

const solanaAgent = new SolanaAgentKit(
  "", // Will be set per user
  process.env.SOLANA_RPC_URL,
  process.env.OPENAI_API_KEY
);

export async function POST(request: Request) {
  try {
    const { action, params, walletKey } = await request.json();
    
    // Set wallet for this request
    solanaAgent.wallet = walletKey;

    switch(action) {
      case 'trade':
        const result = await solanaAgent.trade(
          params.outputMint,
          params.inputAmount,
          params.inputMint,
          params.slippage
        );
        return NextResponse.json({ success: true, data: result });
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}