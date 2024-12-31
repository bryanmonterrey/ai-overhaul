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

interface WebSocketMessage {
  type: 'trade_status' | 'quote_update' | 'execution_update';
  data: any;
}

interface WebSocketTradeStatus {
  tradeId: string;
  status: 'initiated' | 'pending' | 'executed' | 'failed';
  signature?: string;
  error?: string;
}

interface WebSocketQuoteUpdate {
  inputMint: string;
  outputMint: string;
  price: number;
  priceImpact: number;
}

interface WebSocketExecutionUpdate {
  tradeId: string;
  signature: string;
  status: 'confirmed' | 'finalized';
  slot: number;
}

class TradeExecutionService {
  private connection: Connection;
  private jupiter!: Jupiter;
  private blockEngineUrl: string;
  private agentKit?: SolanaAgentKit;
  private wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: { [key: string]: Function[] } = {};

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.blockEngineUrl = 'https://frankfurt.jito.wtf/';
    this.initializeJupiter();
    this.connectWebSocket();
  }

  private async getOrCreateAgentKit(wallet?: Wallet): Promise<SolanaAgentKit> {
    if (!wallet) {
      if (!this.agentKit) {
        this.agentKit = new SolanaAgentKit(
          'readonly',  // private key or 'readonly'
          process.env.NEXT_PUBLIC_RPC_URL!,  // RPC URL
          process.env.OPENAI_API_KEY!  // OpenAI API key
        );
      }
      return this.agentKit;
    }

    return new SolanaAgentKit(
      wallet.publicKey.toString(),  // private key
      process.env.NEXT_PUBLIC_RPC_URL!,  // RPC URL
      process.env.OPENAI_API_KEY!  // OpenAI API key
    );
  }

  private connectWebSocket() {
    if (typeof window !== 'undefined') {
      if (this.ws?.readyState === WebSocket.OPEN) {
        return;
      }

      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('connection', { status: 'disconnected' });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectDelay *= 2;
          setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        } else {
          console.error('Max reconnection attempts reached');
          this.emit('connection', { 
            status: 'failed', 
            error: 'Max reconnection attempts reached' 
          });
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    }
  }

  private handleWebSocketMessage(data: WebSocketMessage) {
    switch (data.type) {
      case 'trade_status':
        this.handleTradeStatus(data.data as WebSocketTradeStatus);
        break;
      case 'quote_update':
        this.handleQuoteUpdate(data.data as WebSocketQuoteUpdate);
        break;
      case 'execution_update':
        this.handleExecutionUpdate(data.data as WebSocketExecutionUpdate);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private handleTradeStatus(data: WebSocketTradeStatus) {
    this.emit('tradeStatus', data);
  }

  private handleQuoteUpdate(data: WebSocketQuoteUpdate) {
    this.emit('quoteUpdate', data);
  }

  private handleExecutionUpdate(data: WebSocketExecutionUpdate) {
    this.emit('executionUpdate', data);
  }

  public on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  private async initializeJupiter() {
    this.jupiter = await Jupiter.load({
      connection: this.connection,
      cluster: 'mainnet-beta'
    });
  }

  private async submitToBlockEngine(signedTransaction: Transaction) {
    try {
        const blockEngineUrl = 'https://frankfurt.jito.wtf';  // Ensure URL has protocol
        const response = await fetch(`${blockEngineUrl}/bundle`, {
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

  async getTokenInfo(symbolOrAddress: string) {
    try {
      // Try Jupiter token list first
      const jupiterTokenList = await (await fetch(TOKEN_LIST_URL['mainnet-beta'])).json();
      
      // Look for exact matches first
      let token = jupiterTokenList.find((t: any) => 
        t.symbol.toUpperCase() === symbolOrAddress.toUpperCase() || 
        t.address === symbolOrAddress
      );

      if (token) {
        return {
          symbol: token.symbol,
          address: token.address,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI
        };
      }

      // If not found and it looks like an address, try token metadata
      if (symbolOrAddress.length === 44 || symbolOrAddress.startsWith('0x')) {
        const mint = new PublicKey(symbolOrAddress);
        return {
          symbol: symbolOrAddress.slice(0, 8),
          address: symbolOrAddress,
          name: `Token ${symbolOrAddress.slice(0, 8)}`,
          decimals: 9
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  async executeTradeWithMEV(params: TradeParams, wallet: Wallet): Promise<TradeExecutionResponse> {
    try {
      const agentKit = await this.getOrCreateAgentKit(wallet);
      
      const inputTokenData = await agentKit.getTokenDataByAddress(params.inputMint);
      const outputTokenData = await agentKit.getTokenDataByAddress(params.outputMint);

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

      this.emit('quoteUpdate', {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        price: Number(bestRoute.outAmount) / Number(bestRoute.inAmount),
        priceImpact: bestRoute.priceImpactPct
      });

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
              const currentTPS = await agentKit.getTPS();
              
              this.emit('tradeStatus', {
                tradeId: bundleId,
                status: 'pending',
                signature: signature.toString()
              });

              await this.connection.confirmTransaction({
                signature: signature.toString(),
                blockhash: swapTransaction.recentBlockhash!,
                lastValidBlockHeight: await this.connection.getBlockHeight()
              });
              signatures.push(signature.toString());

              this.emit('executionUpdate', {
                tradeId: bundleId,
                signature: signature.toString(),
                status: 'confirmed',
                slot: await this.connection.getSlot()
              });

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
          this.emit('tradeStatus', {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          const signature = await agentKit.trade(
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
      this.emit('tradeStatus', {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getRouteQuote(params: TradeParams): Promise<RouteQuoteResponse> {
    try {
      const agentKit = await this.getOrCreateAgentKit();
      
      const inputTokenData = await agentKit.getTokenDataByAddress(params.inputMint);
      const outputTokenData = await agentKit.getTokenDataByAddress(params.outputMint);

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

      this.emit('quoteUpdate', {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct
      });

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
      const agentKit = await this.getOrCreateAgentKit();
      
      try {
        const price = await agentKit.fetchTokenPrice(tokenMint);
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

  async validateToken(mint: string): Promise<TokenInfo | null> {
    const agentKit = await this.getOrCreateAgentKit();
    const tokenData = await agentKit.getTokenDataByAddress(mint);
    return tokenData ? tokenData as TokenInfo : null;
  }

  async getTokenPrice(mint: string): Promise<string | null> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.fetchTokenPrice(mint);
  }

  async getCurrentTPS(): Promise<number> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getTPS();
  }

  async deployToken(
    name: string,
    uri: string,
    symbol: string,
    decimals: number = 9,
    initialSupply?: number,
    wallet?: Wallet
  ): Promise<TokenDeploymentResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.deployToken(name, uri, symbol, decimals, initialSupply);
    return {
      success: true,
      mint: result.mint,
      timestamp: new Date().toISOString()
    };
  }

  async deployCollection(options: CollectionOptions, wallet?: Wallet): Promise<CollectionDeploymentResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.deployCollection(options);
    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      masterEdition: result.masterEditionAccount,
      timestamp: new Date().toISOString()
    };
  }

  async mintNFT(
    collectionMint: PublicKey,
    metadata: any,
    recipient?: PublicKey,
    wallet?: Wallet
  ): Promise<NFTMintResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.mintNFT(collectionMint, metadata, recipient);
    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      edition: result.mint,
      signature: 'pending',
      timestamp: new Date().toISOString()
    };
  }

  async getBalance(tokenAddress?: PublicKey, wallet?: Wallet): Promise<TokenBalanceResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const balance = await agentKit.getBalance(tokenAddress);
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
    mint?: PublicKey,
    wallet?: Wallet
  ): Promise<TokenTransferResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.transfer(to, amount, mint);
    return {
      success: true,
      signature,
      source: agentKit.wallet_address,
      destination: to,
      amount,
      timestamp: new Date().toISOString()
    };
  }

  async launchPumpFunToken(
    tokenName: string,
    tokenTicker: string,
    description: string,
    imageUrl: string,
    options?: PumpFunTokenOptions,
    wallet?: Wallet
  ): Promise<PumpfunLaunchResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.launchPumpFunToken(
      tokenName,
      tokenTicker,
      description,
      imageUrl,
      options
    );
    return {
      success: true,
      tokenMint: new PublicKey(result.mint),
      ...result,
      timestamp: new Date().toISOString()
    };
  }
  async createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: number,
    wallet?: Wallet
  ): Promise<WhirlpoolCreationResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.createOrcaSingleSidedWhirlpool(
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

  async raydiumCreateAmmV4(
    marketId: PublicKey,
    baseAmount: BN,
    quoteAmount: BN,
    startTime: BN,
    wallet?: Wallet
  ): Promise<RaydiumAMMResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateAmmV4(
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
    startTime: BN,
    wallet?: Wallet
  ): Promise<RaydiumAMMResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateClmm(
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
    startTime: BN,
    wallet?: Wallet
  ): Promise<RaydiumAMMResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateCpmm(
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

  async openbookCreateMarket(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lotSize: number = 1,
    tickSize: number = 0.01,
    wallet?: Wallet
  ): Promise<OpenbookMarketResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signatures = await agentKit.openbookCreateMarket(
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

  async pythFetchPrice(priceFeedID: string): Promise<PythPriceResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const price = await agentKit.pythFetchPrice(priceFeedID);
    return {
      success: true,
      price: Number(price),
      confidence: 1,
      timestamp: Date.now()
    };
  }

  async sendCompressedAirdrop(
    mintAddress: string,
    amount: number,
    decimals: number,
    recipients: string[],
    priorityFeeInLamports: number,
    shouldLog: boolean,
    wallet?: Wallet
  ): Promise<CompressedAirdropResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signatures = await agentKit.sendCompressedAirdrop(
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
  async registerDomain(name: string, spaceKB?: number, wallet?: Wallet): Promise<DomainResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const domain = await agentKit.registerDomain(name, spaceKB);
    return {
      success: true,
      domain,
      owner: agentKit.wallet_address,
      timestamp: new Date().toISOString()
    };
  }

  async resolveSolDomain(domain: string): Promise<DomainResolutionResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const address = await agentKit.resolveSolDomain(domain);
    return {
      success: true,
      address,
      domain,
      owner: address,
      timestamp: new Date().toISOString()
    };
  }

  async lendAssets(amount: number, wallet?: Wallet): Promise<LendingResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const txid = await agentKit.lendAssets(amount);
    return {
      success: true,
      signature: txid,
      amount,
      apy: 0,
      timestamp: new Date().toISOString()
    };
  }

  async stake(amount: number, wallet?: Wallet): Promise<StakingResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const txid = await agentKit.stake(amount);
    return {
      success: true,
      signature: txid,
      amount,
      apy: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Domain Name Service Features
  async resolveAllDomains(domain: string): Promise<PublicKey | undefined> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.resolveAllDomains(domain);
  }

  async getOwnedAllDomains(owner: PublicKey): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getOwnedAllDomains(owner);
  }

  async getOwnedDomainsForTLD(tld: string): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getOwnedDomainsForTLD(tld);
  }

  async getAllDomainsTLDs(): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getAllDomainsTLDs();
  }

  async getAllRegisteredAllDomains(): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getAllRegisteredAllDomains();
  }

  async getMainAllDomainsDomain(owner: PublicKey): Promise<string | null> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getMainAllDomainsDomain(owner);
  }

  async getPrimaryDomain(account: PublicKey): Promise<DomainResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const domain = await agentKit.getPrimaryDomain(account);
    return {
      success: true,
      domain,
      owner: account,
      timestamp: new Date().toISOString()
    };
  }

  async createGibworkTask(
    title: string,
    content: string,
    requirements: string,
    tags: string[],
    tokenMintAddress: string,
    tokenAmount: number,
    payer?: string,
    wallet?: Wallet
  ): Promise<GibworkCreateTaskReponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    return {
      success: true,
      taskId: 'task_' + Date.now(),
      creator: new PublicKey(agentKit.wallet_address),
      bounty: {
        mint: tokenMintAddress,
        amount: tokenAmount
      },
      status: 'created',
      timestamp: new Date().toISOString()
    };
  }

  // WebSocket cleanup method
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.listeners = {};
    }
  }

  // Reconnect method
  public reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.connectWebSocket();
  }

  // Method to check connection status
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const tradeExecution = new TradeExecutionService();