// app/trading/services/execution.ts
import { Connection, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from '@jup-ag/core';
import { Wallet } from '@coral-xyz/anchor';
import JSBI from 'jsbi';

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
  private jupiter!: Jupiter; // Add ! to fix definite assignment
  private blockEngineUrl: string;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.blockEngineUrl = 'https://frankfurt.jito.wtf/';
    this.initializeJupiter();
  }

  private async initializeJupiter() {
    this.jupiter = await Jupiter.load({
      connection: this.connection,
      cluster: 'mainnet-beta'
      // user property is omitted completely
    });
  }

  private async submitToBlockEngine(signedTransaction: Transaction) {
    try {
      const response = await fetch(`${this.blockEngineUrl}/bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [signedTransaction.serialize()],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit to block engine');
      }

      const result = await response.json();
      return result.bundleId;
    } catch (error) {
      console.error('Block engine submission error:', error);
      throw error;
    }
  }

  async executeTradeWithMEV(params: TradeParams, wallet: Wallet) {
    try {
      // Convert amount to JSBI
      const amountBigInt = JSBI.BigInt(params.amount.toString());

      // Get Jupiter quote
      const route = await this.jupiter.computeRoutes({
        inputMint: new PublicKey(params.inputMint),
        outputMint: new PublicKey(params.outputMint),
        amount: amountBigInt,
        slippageBps: params.slippage * 100,
        forceFetch: true,
      });

      if (!route.routesInfos?.length) {
        throw new Error('No route found');
      }

      // Get best route
      const bestRoute = route.routesInfos[0];

      // Execute the trade
      const { swapTransaction } = await this.jupiter.exchange({
        routeInfo: bestRoute,
        userPublicKey: wallet.publicKey, // Pass the wallet's public key here
      });

      let signatures: string[] = [];

      // If MEV protection is enabled
      if (params.useMev) {
        const priorityFee = params.priorityFee || 0.0025;
        
        try {
          // Create priority fee instruction
          const priorityFeeInstruction = new TransactionInstruction({
            keys: [],
            programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
            data: Buffer.from([
              0x02, // Instruction index for SetComputeUnitPrice
              ...new Uint8Array(new Float64Array([priorityFee * 1e9]).buffer)
            ])
          });

          // Add priority fee instruction to transaction
          if (swapTransaction instanceof Transaction) {
            swapTransaction.instructions.unshift(priorityFeeInstruction);
            swapTransaction.sign(wallet.payer);

            // Submit to block engine
            const bundleId = await this.submitToBlockEngine(swapTransaction);
            console.log('Bundle submitted:', bundleId);

            // Wait for confirmation
            const signature = swapTransaction.signatures[0]?.signature;
            if (signature) {
              await this.connection.confirmTransaction({
                signature: signature.toString(),
                blockhash: swapTransaction.recentBlockhash!,
                lastValidBlockHeight: await this.connection.getBlockHeight()
              });
              signatures.push(signature.toString());
            }
          }

        } catch (error) {
          console.error('MEV-protected transaction failed:', error);
          // Fallback to regular transaction
          const signature = await this.connection.sendTransaction(swapTransaction as Transaction, [wallet.payer]);
          signatures.push(signature);
        }
      } else {
        // Execute regular transaction without MEV protection
        const signature = await this.connection.sendTransaction(swapTransaction as Transaction, [wallet.payer]);
        signatures.push(signature);
      }

      return {
        success: true,
        signatures,
        route: bestRoute,
      };

    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  async getRouteQuote(params: TradeParams): Promise<{
    price: number;
    priceImpact: number;
    route: RouteInfo;
    minOutputAmount: number;
  }> {
    try {
      const amountBigInt = JSBI.BigInt(params.amount.toString());

      const routes = await this.jupiter.computeRoutes({
        inputMint: new PublicKey(params.inputMint),
        outputMint: new PublicKey(params.outputMint),
        amount: amountBigInt,
        slippageBps: params.slippage * 100,
      });

      if (!routes.routesInfos?.length) {
        throw new Error('No routes found');
      }

      const bestRoute = routes.routesInfos[0];

      // Convert JSBI values to numbers for the response
      const outAmount = Number(bestRoute.outAmount.toString());
      const inAmount = Number(bestRoute.inAmount.toString());
      const otherAmountThreshold = Number(bestRoute.otherAmountThreshold.toString());

      return {
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct,
        route: bestRoute,
        minOutputAmount: otherAmountThreshold,
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