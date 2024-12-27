// app/trading/services/execution.ts
import { Connection, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from '@jup-ag/core';
import { Wallet } from '@coral-xyz/anchor';
import JSBI from 'jsbi';
import { SolanaAgentKit } from 'solana-agent-kit';
import { BN } from '@coral-xyz/anchor';

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
  private jupiter!: Jupiter;
  private blockEngineUrl: string;
  private agentKit: SolanaAgentKit;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.blockEngineUrl = 'https://frankfurt.jito.wtf/';
    
    // Initialize SolanaAgentKit
    this.agentKit = new SolanaAgentKit(
      process.env.PRIVATE_KEY!,
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!  // Optional
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

  async executeTradeWithMEV(params: TradeParams, wallet: Wallet) {
    try {
      // Get token data through Agent Kit
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
              // Get TPS through Agent Kit
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
                route: bestRoute,
                networkStats: {
                  tps: currentTPS
                },
                tokenData: {
                  input: inputTokenData,
                  output: outputTokenData
                }
              };
            }
          }

        } catch (error) {
          console.error('MEV-protected transaction failed:', error);
          // Fallback to Agent Kit trade
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
        route: bestRoute
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
    tokenData?: any;
  }> {
    try {
      // Get token data through Agent Kit
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
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct,
        route: bestRoute,
        minOutputAmount: otherAmountThreshold,
        tokenData: {
          input: inputTokenData,
          output: outputTokenData
        }
      };

    } catch (error) {
      console.error('Quote error:', error);
      throw error;
    }
  }

  async getMarketData(tokenMint: string) {
    try {
      // Try Agent Kit price fetch first
      try {
        const price = await this.agentKit.fetchTokenPrice(tokenMint);
        if (price) {
          return { price };
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
      return data.pairs[0];

    } catch (error) {
      console.error('Market data error:', error);
      throw error;
    }
  }

  // Agent Kit specific methods
  async validateToken(mint: string) {
    return this.agentKit.getTokenDataByAddress(mint);
  }

  async getTokenPrice(mint: string) {
    return this.agentKit.fetchTokenPrice(mint);
  }

  async getCurrentTPS() {
    return this.agentKit.getTPS();
  }

  async deployToken(
    name: string,
    uri: string,
    symbol: string,
    decimals: number = 9,
    initialSupply?: number
  ) {
    return this.agentKit.deployToken(name, uri, symbol, decimals, initialSupply);
  }

  // NFT Features
  async deployCollection(options: CollectionOptions) {
    return this.agentKit.deployCollection(options);
  }

  async mintNFT(
    collectionMint: PublicKey,
    metadata: any,
    recipient?: PublicKey
  ) {
    return this.agentKit.mintNFT(collectionMint, metadata, recipient);
  }

  // Domain Management
  async registerDomain(name: string, spaceKB?: number) {
    return this.agentKit.registerDomain(name, spaceKB);
  }

  async resolveSolDomain(domain: string) {
    return this.agentKit.resolveSolDomain(domain);
  }

  async getPrimaryDomain(account: PublicKey) {
    return this.agentKit.getPrimaryDomain(account);
  }

  // DeFi Features
  async lendAssets(amount: number) {
    return this.agentKit.lendAssets(amount);
  }

  async stake(amount: number) {
    return this.agentKit.stake(amount);
  }

  // Token Launch Features
  async launchPumpFunToken(
    tokenName: string,
    tokenTicker: string,
    description: string,
    imageUrl: string,
    options?: PumpFunTokenOptions
  ) {
    return this.agentKit.launchPumpFunToken(
      tokenName,
      tokenTicker,
      description,
      imageUrl,
      options
    );
  }

  // Airdrop Features
  async sendCompressedAirdrop(
    mintAddress: string,
    amount: number,
    decimals: number,
    recipients: string[],
    priorityFeeInLamports: number,
    shouldLog: boolean
  ) {
    return this.agentKit.sendCompressedAirdrop(
      mintAddress,
      amount,
      decimals,
      recipients,
      priorityFeeInLamports,
      shouldLog
    );
  }

  // AMM Features
  async createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: keyof typeof FEE_TIERS
  ) {
    return this.agentKit.createOrcaSingleSidedWhirlpool(
      depositTokenAmount,
      depositTokenMint,
      otherTokenMint,
      initialPrice,
      maxPrice,
      feeTier
    );
  }

  // Raydium Integration
  async raydiumCreateAmmV4(
    marketId: PublicKey,
    baseAmount: BN,
    quoteAmount: BN,
    startTime: BN
  ) {
    return this.agentKit.raydiumCreateAmmV4(
      marketId,
      baseAmount,
      quoteAmount,
      startTime
    );
  }

  async raydiumCreateClmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    initialPrice: Decimal,
    startTime: BN
  ) {
    return this.agentKit.raydiumCreateClmm(
      mint1,
      mint2,
      configId,
      initialPrice,
      startTime
    );
  }

  async raydiumCreateCpmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    mintAAmount: BN,
    mintBAmount: BN,
    startTime: BN
  ) {
    return this.agentKit.raydiumCreateCpmm(
      mint1,
      mint2,
      configId,
      mintAAmount,
      mintBAmount,
      startTime
    );
  }

  // Openbook Integration
  async openbookCreateMarket(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lotSize: number = 1,
    tickSize: number = 0.01
  ) {
    return this.agentKit.openbookCreateMarket(
      baseMint,
      quoteMint,
      lotSize,
      tickSize
    );
  }

  // Price Oracle Integration
  async pythFetchPrice(priceFeedID: string) {
    return this.agentKit.pythFetchPrice(priceFeedID);
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
  ) {
    return this.agentKit.createGibworkTask(
      title,
      content,
      requirements,
      tags,
      tokenMintAddress,
      tokenAmount,
      payer
    );
  }

  // Utility Methods
  async getBalance(tokenAddress?: PublicKey) {
    return this.agentKit.getBalance(tokenAddress);
  }

  async transfer(
    to: PublicKey,
    amount: number,
    mint?: PublicKey
  ) {
    return this.agentKit.transfer(to, amount, mint);
  }

  // Domain Name Service Features
  async resolveAllDomains(domain: string) {
    return this.agentKit.resolveAllDomains(domain);
  }

  async getOwnedAllDomains(owner: PublicKey) {
    return this.agentKit.getOwnedAllDomains(owner);
  }

  async getOwnedDomainsForTLD(tld: string) {
    return this.agentKit.getOwnedDomainsForTLD(tld);
  }

  async getAllDomainsTLDs() {
    return this.agentKit.getAllDomainsTLDs();
  }

  async getAllRegisteredAllDomains() {
    return this.agentKit.getAllRegisteredAllDomains();
  }

  async getMainAllDomainsDomain(owner: PublicKey) {
    return this.agentKit.getMainAllDomainsDomain(owner);
  }
}

export const tradeExecution = new TradeExecutionService();