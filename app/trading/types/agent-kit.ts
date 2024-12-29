// app/trading/types/agent-kit.ts

import { PublicKey } from "@solana/web3.js";
import { RouteInfo } from "@jup-ag/core";
import { BN } from "@coral-xyz/anchor";

// Base Types
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions?: Record<string, any>;
}

// Separate base responses for different timestamp types
export interface BaseResponse {
  success: boolean;
  error?: string;
  timestamp?: string;
}

export interface BaseResponseWithUnixTime {
  success: boolean;
  error?: string;
  timestamp: number;
}

// Token Management Responses
export interface TokenDeploymentResponse extends BaseResponse {
  mint: PublicKey;
  metadata?: PublicKey;
  freezeAuthority?: PublicKey;
  mintAuthority?: PublicKey;
}

export interface TokenBalanceResponse extends BaseResponse {
  balance: number;
  decimals: number;
  uiBalance: string;
}

export interface TokenTransferResponse extends BaseResponse {
  signature: string;
  source: PublicKey;
  destination: PublicKey;
  amount: number;
}

// NFT Responses
export interface CollectionDeployment {
  collectionMint: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

export interface CollectionDeploymentResponse extends BaseResponse {
  mint: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

export interface MintCollectionNFTResponse {
  mint: PublicKey;
  metadata: PublicKey;
  signature: string;
}

export interface NFTMintResponse extends BaseResponse {
  mint: PublicKey;
  metadata: PublicKey;
  edition: PublicKey;
  signature: string;
}

// Trading Responses
export interface TradeExecutionResponse extends BaseResponse {
  signature: string;
  signatures?: string[];
  route?: RouteInfo;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  networkStats?: {
    tps: number;
  };
  tokenData?: {
    input: TokenInfo;
    output: TokenInfo;
  };
}

export interface RouteQuoteResponse extends BaseResponse {
  price: number;
  priceImpact: number;
  route: RouteInfo;
  minOutputAmount: number;
  tokenData?: {
    input: TokenInfo;
    output: TokenInfo;
  };
}

// Domain Service Responses
export interface DomainResponse extends BaseResponse {
  domain: string;
  owner: PublicKey;
  space?: number;
  expiry?: number;
}

export interface DomainResolutionResponse extends BaseResponse {
  address: PublicKey;
  domain: string;
  owner: PublicKey;
}

// DeFi Responses
export interface LendingResponse extends BaseResponse {
  signature: string;
  amount: number;
  apy: number;
  collateral?: number;
}

export interface StakingResponse extends BaseResponse {
  signature: string;
  amount: number;
  apy: number;
  validatorAddress?: PublicKey;
  epoch?: number;
}

// Token Launch Responses
export interface PumpfunLaunchResponse extends BaseResponse {
  tokenMint: PublicKey;
  signature: string;
  marketId?: string;
  initialPrice?: number;
}

// Airdrop Responses
export interface CompressedAirdropResponse extends BaseResponse {
  signatures: string[];
  successCount: number;
  failedRecipients?: string[];
  totalAmount: number;
}

// AMM Responses
export interface WhirlpoolCreationResponse extends BaseResponse {
  poolAddress: PublicKey;
  signature: string;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  initialPrice: string;
}

export interface RaydiumAMMResponse extends BaseResponse {
  signature: string;
  poolId: PublicKey;
  marketId: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
}

// DEX Responses
export interface OpenbookMarketResponse extends BaseResponse {
  market: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  signatures: string[];
}

// Price Oracle Responses - Using BaseResponseWithUnixTime
export interface PythPriceResponse extends BaseResponseWithUnixTime {
  price: number;
  confidence: number;
  previousPrice?: number;
  priceChange24h?: number;
}

// Task System Responses
export interface GibworkCreateTaskReponse extends BaseResponse {
  taskId: string;
  creator: PublicKey;
  bounty: {
    mint: string;
    amount: number;
  };
  status: 'created' | 'inProgress' | 'completed';
}

// Market Data Response
export interface MarketDataResponse extends BaseResponse {
  price?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
  pairs?: Array<{
    dexId: string;
    pairAddress: string;
    baseToken: TokenInfo;
    quoteToken: TokenInfo;
    priceUsd: number;
    volume24h: number;
  }>;
}

export interface CollectionOptions {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{
      address: string;
      percentage: number;
    }>;
    isMutable?: boolean;
  }

  export interface PumpFunTokenOptions {
    supply?: number;
    decimals?: number;
    mintCap?: number;
    vesting?: {
      amount: number;
      duration: number;
      interval: number;
    };
    liquiditySettings?: {
      percentage: number;
      lockDuration: number;
    };
    tradingSettings?: {
      maxTxAmount?: number;
      maxWalletAmount?: number;
    };
    fees?: {
      buyTax?: number;
      sellTax?: number;
      transferTax?: number;
      reflectionPercentage?: number;
    };
  }

  export const FEE_TIERS = {
    STABLE: 0.0001,  // 0.01%
    LOW: 0.0004,     // 0.04%
    MEDIUM: 0.0010,  // 0.1%
    HIGH: 0.0020,    // 0.2%
    ULTRA: 0.0040    // 0.4%
  } as const;
  
  export type FeeTier = keyof typeof FEE_TIERS;

// Trade Parameters
export interface TradeParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippage: number;
  useMev: boolean;
  priorityFee?: number;
  agentParams?: {
    routeType?: 'BEST' | 'SAFE' | 'SHORT';
    maxAccounts?: number;
    validateRoute?: boolean;
    simulateTransaction?: boolean;
  };
}

// WebSocket Event Types
export interface TradeStatusUpdate {
  type: 'trade';
  data: {
    signature: string;
    status: 'pending' | 'confirmed' | 'failed';
    confirmations?: number;
    error?: string;
  };
}



export interface NetworkStatusUpdate {
  type: 'network';
  data: {
    tps: number;
    slot: number;
    blockTime: number;
  };
}

export type WebSocketUpdate = TradeStatusUpdate | NetworkStatusUpdate;