// app/trading/services/execution.ts
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { JupiterProvider, TOKEN_LIST_URL } from '@jup-ag/core';
import { getBundleInstructions } from '@jito-foundation/mev-bot';

interface TradeParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippage: number;
  useMev: boolean;
  priorityFee?: number;
}

class TradeExecutionService {
  private connection: Connection;
  private jupiter: JupiterProvider;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.jupiter = new JupiterProvider({
      connection: this.connection,
      cluster: 'mainnet-beta',
      tokenListUrl: TOKEN_LIST_URL,
    });
  }

  async executeTradeWithMEV(params: TradeParams) {
    try {
      // Get Jupiter quote
      const quote = await this.jupiter.computeBestRoute({
        inputMint: new PublicKey(params.inputMint),
        outputMint: new PublicKey(params.outputMint),
        amount: params.amount,
        slippageBps: params.slippage * 100,
        forceFetch: true,
      });

      if (!quote) {
        throw new Error('No route found');
      }

      // Get transaction instructions from Jupiter
      const { transactions } = await quote.execute();

      // If MEV protection is enabled
      if (params.useMev) {
        // Get Jito bundle instructions
        const bundleInstructions = await getBundleInstructions({
          connection: this.connection,
          instructions: transactions.map(tx => tx.instructions).flat(),
          priorityFee: params.priorityFee || 0.0025, // Default to 0.0025 SOL if not specified
        });

        // Add Jito instructions to transaction
        transactions.forEach(tx => {
          tx.instructions.push(...bundleInstructions);
        });
      }

      // Execute transaction(s)
      const signatures = await Promise.all(
        transactions.map(tx => this.connection.sendTransaction(tx))
      );

      return {
        success: true,
        signatures,
        route: quote.routePlan,
      };

    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  async getRouteQuote(params: TradeParams) {
    try {
      const quote = await this.jupiter.computeBestRoute({
        inputMint: new PublicKey(params.inputMint),
        outputMint: new PublicKey(params.outputMint),
        amount: params.amount,
        slippageBps: params.slippage * 100,
      });

      return {
        price: quote.outAmount / quote.inAmount,
        priceImpact: quote.priceImpactPct,
        route: quote.routePlan,
        minOutputAmount: quote.outAmountWithSlippage,
      };

    } catch (error) {
      console.error('Quote error:', error);
      throw error;
    }
  }

  async getMarketData(tokenMint: string) {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();
      return data.pairs[0]; // Get the most liquid pair

    } catch (error) {
      console.error('Market data error:', error);
      throw error;
    }
  }
}

export const tradeExecution = new TradeExecutionService();