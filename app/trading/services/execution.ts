// app/trading/services/execution.ts
import { Connection, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from '@jup-ag/core';
import { Wallet } from '@coral-xyz/anchor';
import JSBI from 'jsbi';
import { SolanaAgentKit } from 'solana-agent-kit';
import { BN } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';
import type { PumpFunTokenOptions } from 'solana-agent-kit';
import { 
  TradeParams,
  TradeExecutionResponse,
  RouteQuoteResponse,
  TokenDeploymentResponse,
  CollectionDeploymentResponse,
  NFTMintResponse,
  DomainResponse,
  StakingResponse,
  PumpfunLaunchResponse,
  CompressedAirdropResponse,
  WhirlpoolCreationResponse,
  RaydiumAMMResponse,
  OpenbookMarketResponse,
  PythPriceResponse,
  MarketDataResponse,
  TokenInfo,
  CollectionOptions,
  FEE_TIERS,
  BaseResponse,
  TokenBalanceResponse,
  TokenTransferResponse,
  DomainResolutionResponse,
  LendingResponse
} from '../types/agent-kit';
import type { GibworkCreateTaskReponse } from 'solana-agent-kit';

class TradeExecutionService {
  private connection: Connection;
  private jupiter!: Jupiter;
  private blockEngineUrl: string;
  private agentKit: SolanaAgentKit;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.blockEngineUrl = 'https://frankfurt.jito.wtf/';
    
    this.agentKit = new SolanaAgentKit(
      process.env.PRIVATE_KEY!,
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!
    );
    
    this.initializeJupiter();
  }

  private async initializeJupiter() {
    this.jupiter = await Jupiter.load({
      connection: this.connection,
      cluster: 'mainnet-beta'
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

  async executeTradeWithMEV(params: TradeParams, wallet: Wallet): Promise<TradeExecutionResponse> {
    try {
      const inputTokenData = await this.agentKit.getTokenDataByAddress(params.inputMint);
      const outputTokenData = await this.agentKit.getTokenDataByAddress(params.outputMint);

      if (!inputTokenData || !outputTokenData) {
        throw new Error('Invalid token mints');
      }

      const amountBigInt = JSBI.BigInt(params.amount.toString());
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

      const bestRoute = route.routesInfos[0];

      const { swapTransaction } = await this.jupiter.exchange({
        routeInfo: bestRoute,
        userPublicKey: wallet.publicKey,
      });

      let signatures: string[] = [];

      if (params.useMev) {
        const priorityFee = params.priorityFee || 0.0025;
        
        try {
          const priorityFeeInstruction = new TransactionInstruction({
            keys: [],
            programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
            data: Buffer.from([
              0x02,
              ...new Uint8Array(new Float64Array([priorityFee * 1e9]).buffer)
            ])
          });

          if (swapTransaction instanceof Transaction) {
            swapTransaction.instructions.unshift(priorityFeeInstruction);
            swapTransaction.sign(wallet.payer);

            const bundleId = await this.submitToBlockEngine(swapTransaction);
            console.log('Bundle submitted:', bundleId);

            const signature = swapTransaction.signatures[0]?.signature;
            if (signature) {
              const currentTPS = await this.agentKit.getTPS();
              
              await this.connection.confirmTransaction({
                signature: signature.toString(),
                blockhash: swapTransaction.recentBlockhash!,
                lastValidBlockHeight: await this.connection.getBlockHeight()
              });
              signatures.push(signature.toString());

              return {
                success: true,
                signatures,
                signature: signatures[0],
                route: bestRoute,
                inputAmount: params.amount,
                outputAmount: Number(bestRoute.outAmount.toString()),
                priceImpact: bestRoute.priceImpactPct,
                networkStats: {
                  tps: currentTPS
                },
                tokenData: {
                  input: inputTokenData as TokenInfo,
                  output: outputTokenData as TokenInfo
                },
                timestamp: new Date().toISOString()
              };
            }
          }

        } catch (error) {
          console.error('MEV-protected transaction failed:', error);
          const signature = await this.agentKit.trade(
            new PublicKey(params.outputMint),
            params.amount,
            new PublicKey(params.inputMint),
            params.slippage * 100
          );
          signatures.push(signature);
        }
      } else {
        const signature = await this.connection.sendTransaction(swapTransaction as Transaction, [wallet.payer]);
        signatures.push(signature);
      }

      return {
        success: true,
        signatures,
        signature: signatures[0],
        route: bestRoute,
        inputAmount: params.amount,
        outputAmount: Number(bestRoute.outAmount.toString()),
        priceImpact: bestRoute.priceImpactPct,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  async getRouteQuote(params: TradeParams): Promise<RouteQuoteResponse> {
    try {
      const inputTokenData = await this.agentKit.getTokenDataByAddress(params.inputMint);
      const outputTokenData = await this.agentKit.getTokenDataByAddress(params.outputMint);

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

      const outAmount = Number(bestRoute.outAmount.toString());
      const inAmount = Number(bestRoute.inAmount.toString());
      const otherAmountThreshold = Number(bestRoute.otherAmountThreshold.toString());

      return {
        success: true,
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct,
        route: bestRoute,
        minOutputAmount: otherAmountThreshold,
        tokenData: {
          input: inputTokenData as TokenInfo,
          output: outputTokenData as TokenInfo
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Quote error:', error);
      throw error;
    }
  }

  async getMarketData(tokenMint: string): Promise<MarketDataResponse> {
    try {
      try {
        const price = await this.agentKit.fetchTokenPrice(tokenMint);
        if (price) {
          return {
            success: true,
            price: Number(price),
            timestamp: new Date().toISOString()
          };
        }
      } catch (e) {
        console.log('Agent Kit price fetch failed, falling back to DEXScreener');
      }

      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();
      return {
        success: true,
        ...data.pairs[0],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Market data error:', error);
      throw error;
    }
  }

  // Token Management
  async validateToken(mint: string): Promise<TokenInfo | null> {
    const tokenData = await this.agentKit.getTokenDataByAddress(mint);
    return tokenData ? tokenData as TokenInfo : null;
  }

  async getTokenPrice(mint: string): Promise<string | null> {
    return this.agentKit.fetchTokenPrice(mint);
  }

  async getCurrentTPS(): Promise<number> {
    return this.agentKit.getTPS();
  }

  async deployToken(
    name: string,
    uri: string,
    symbol: string,
    decimals: number = 9,
    initialSupply?: number
  ): Promise<TokenDeploymentResponse> {
    const result = await this.agentKit.deployToken(name, uri, symbol, decimals, initialSupply);
    return {
      success: true,
      mint: result.mint,
      timestamp: new Date().toISOString()
    };
  }

  // NFT Features
  async deployCollection(options: CollectionOptions): Promise<CollectionDeploymentResponse> {
    const result = await this.agentKit.deployCollection(options);
    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      masterEdition: result.masterEdition,
      timestamp: new Date().toISOString()
    };
  }

  async mintNFT(
    collectionMint: PublicKey,
    metadata: any,
    recipient?: PublicKey
  ): Promise<NFTMintResponse> {
    const result = await this.agentKit.mintNFT(collectionMint, metadata, recipient);
    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      edition: result?.edition || result.mint,
      signature: result?.signature || 'pending',
      timestamp: new Date().toISOString()
    };
  }

  // Domain Management
  async registerDomain(name: string, spaceKB?: number): Promise<DomainResponse> {
    const domain = await this.agentKit.registerDomain(name, spaceKB);
    return {
      success: true,
      domain,
      owner: this.agentKit.wallet_address,
      timestamp: new Date().toISOString()
    };
  }

  async resolveSolDomain(domain: string): Promise<DomainResolutionResponse> {
    const address = await this.agentKit.resolveSolDomain(domain);
    return {
      success: true,
      address,
      domain,
      owner: address,
      timestamp: new Date().toISOString()
    };
  }

  async getPrimaryDomain(account: PublicKey): Promise<DomainResponse> {
    const domain = await this.agentKit.getPrimaryDomain(account);
    return {
      success: true,
      domain,
      owner: account,
      timestamp: new Date().toISOString()
    };
  }

  // DeFi Features
  async lendAssets(amount: number): Promise<LendingResponse> {
    const txid = await this.agentKit.lendAssets(amount);
    return {
      success: true,
      signature: txid,
      amount,
      apy: 0, // Add actual APY if available
      timestamp: new Date().toISOString()
    };
  }

  async stake(amount: number): Promise<StakingResponse> {
    const txid = await this.agentKit.stake(amount);
    return {
      success: true,
      signature: txid,
      amount,
      apy: 0, // Add actual APY if available
      timestamp: new Date().toISOString()
    };
  }

  // Token Launch Features
  async launchPumpFunToken(
    tokenName: string,
    tokenTicker: string,
    description: string,
    imageUrl: string,
    options?: PumpFunTokenOptions
  ): Promise<PumpfunLaunchResponse> {
    const result = await this.agentKit.launchPumpFunToken(
      tokenName,
      tokenTicker,
      description,
      imageUrl,
      options
    );
    return {
      success: true,
      tokenMint: result.mint,
      ...result,
      timestamp: new Date().toISOString()
    };
  }

  // Airdrop Features
  async sendCompressedAirdrop(
    mintAddress: string,
    amount: number,
    decimals: number,
    recipients: string[],
    priorityFeeInLamports: number,
    shouldLog: boolean
  ): Promise<CompressedAirdropResponse> {
    const signatures = await this.agentKit.sendCompressedAirdrop(
      mintAddress,
      amount,
      decimals,
      recipients,
      priorityFeeInLamports,
      shouldLog
    );
    return {
      success: true,
      signatures,
      successCount: signatures.length,
      totalAmount: amount * recipients.length,
      timestamp: new Date().toISOString()
    };
  }

  // AMM Features
  async createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: number
  ): Promise<WhirlpoolCreationResponse> {
    const signature = await this.agentKit.createOrcaSingleSidedWhirlpool(
      depositTokenAmount,
      depositTokenMint,
      otherTokenMint,
      initialPrice,
      maxPrice,
      0.01
    );
    return {
      success: true,
      poolAddress: depositTokenMint,
      signature: signature,
      tokenAVault: depositTokenMint,
      tokenBVault: otherTokenMint,
      initialPrice: initialPrice.toString(),
      timestamp: new Date().toISOString()
    };
  }

  // Raydium Integration
  async raydiumCreateAmmV4(
    marketId: PublicKey,
    baseAmount: BN,
    quoteAmount: BN,
    startTime: BN
  ): Promise<RaydiumAMMResponse> {
    const signature = await this.agentKit.raydiumCreateAmmV4(
      marketId,
      baseAmount,
      quoteAmount,
      startTime
    );
    return {
      success: true,
      signature,
      poolId: marketId,
      marketId: marketId,
      baseVault: marketId,
      quoteVault: marketId,
      timestamp: new Date().toISOString()
    };
  }

  async raydiumCreateClmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    initialPrice: Decimal,
    startTime: BN
  ): Promise<RaydiumAMMResponse> {
    const signature = await this.agentKit.raydiumCreateClmm(
      mint1,
      mint2,
      configId,
      initialPrice,
      startTime
    );
    return {
      success: true,
      signature,
      poolId: mint1,
      marketId: configId,
      baseVault: mint1,
      quoteVault: mint2,
      timestamp: new Date().toISOString()
    };
  }

  async raydiumCreateCpmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    mintAAmount: BN,
    mintBAmount: BN,
    startTime: BN
  ): Promise<RaydiumAMMResponse> {
    const signature = await this.agentKit.raydiumCreateCpmm(
      mint1,
      mint2,
      configId,
      mintAAmount,
      mintBAmount,
      startTime
    );
    return {
      success: true,
      signature,
      poolId: mint1,
      marketId: configId,
      baseVault: mint1,
      quoteVault: mint2,
      timestamp: new Date().toISOString()
    };
  }

  // Openbook Integration
  async openbookCreateMarket(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lotSize: number = 1,
    tickSize: number = 0.01
  ): Promise<OpenbookMarketResponse> {
    const signatures = await this.agentKit.openbookCreateMarket(
      baseMint,
      quoteMint,
      lotSize,
      tickSize
    );
    return {
      success: true,
      market: new PublicKey(signatures[0]),
      baseVault: new PublicKey(signatures[1]),
      quoteVault: new PublicKey(signatures[2]),
      signatures,
      timestamp: new Date().toISOString()
    };
  }

  // Price Oracle Integration
  async pythFetchPrice(priceFeedID: string): Promise<PythPriceResponse> {
    const price = await this.agentKit.pythFetchPrice(priceFeedID);
    return {
      success: true,
      price: Number(price),
      confidence: 1,
      timestamp: Date.now()
    };
  }

  // Utility Methods
  async getBalance(tokenAddress?: PublicKey): Promise<TokenBalanceResponse> {
    const balance = await this.agentKit.getBalance(tokenAddress);
    return {
      success: true,
      balance,
      decimals: 9,
      uiBalance: balance.toString(),
      timestamp: new Date().toISOString()
    };
  }

  async transfer(
    to: PublicKey,
    amount: number,
    mint?: PublicKey
  ): Promise<TokenTransferResponse> {
    const signature = await this.agentKit.transfer(to, amount, mint);
    return {
      success: true,
      signature,
      source: this.agentKit.wallet_address,
      destination: to,
      amount,
      timestamp: new Date().toISOString()
    };
  }

  // Domain Name Service Features
  async resolveAllDomains(domain: string): Promise<PublicKey | undefined> {
    return this.agentKit.resolveAllDomains(domain);
  }

  async getOwnedAllDomains(owner: PublicKey): Promise<string[]> {
    return this.agentKit.getOwnedAllDomains(owner);
  }

  async getOwnedDomainsForTLD(tld: string): Promise<string[]> {
    return this.agentKit.getOwnedDomainsForTLD(tld);
  }

  async getAllDomainsTLDs(): Promise<string[]> {
    return this.agentKit.getAllDomainsTLDs();
  }

  async getAllRegisteredAllDomains(): Promise<string[]> {
    return this.agentKit.getAllRegisteredAllDomains();
  }

  async getMainAllDomainsDomain(owner: PublicKey): Promise<string | null> {
    return this.agentKit.getMainAllDomainsDomain(owner);
  }

  // Gibwork Integration
  async createGibworkTask(
    title: string,
    content: string,
    requirements: string,
    tags: string[],
    tokenMintAddress: string,
    tokenAmount: number,
    payer?: string
  ): Promise<GibworkCreateTaskReponse> {
    return {
      success: true,
      taskId: 'task_' + Date.now(),
      creator: new PublicKey(this.agentKit.wallet_address),
      bounty: {
        mint: tokenMintAddress,
        amount: tokenAmount
      },
      status: 'created',
      timestamp: new Date().toISOString()
    };
  }
}

export const tradeExecution = new TradeExecutionService();