import { Connection, PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { Redis } from '@upstash/redis';
import { getRedisClient } from '../redis/client';

interface TokenSearchResult {
  items: any[];
  limit: number;
  page: number;
  total: number;
}

interface TokenBalanceResult {
  balance: number;
  tokenInfo?: {
    address: string;
    supply: number;
    decimals: number;
    symbol?: string;
    name?: string;
  };
}

export class TokenChecker {
  private connection: Connection;
  private tokenAddress: string;
  private redis?: Redis;
  private readonly CACHE_TTL = 300;
  private readonly HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  private readonly HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
  private readonly REQUIRED_USD_VALUE = 20;
  private static instance: TokenChecker;
  private checkInProgress: Map<string, Promise<any>> = new Map();
  private lastCheckTime: Map<string, number> = new Map();
  private readonly MIN_CHECK_INTERVAL = 5000; // 5 seconds

  public constructor() {
    if (!process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY is not set in environment variables');
    }
    
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    this.tokenAddress = '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump';
    
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = getRedisClient();
    }
  }

  public static getInstance(): TokenChecker {
    if (!TokenChecker.instance) {
      TokenChecker.instance = new TokenChecker();
    }
    return TokenChecker.instance;
  }

  private async getFromCache(key: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error('Cache error:', error);
      return null;
    }
  }

  private async setCache(key: string, value: string, ttl: number = this.CACHE_TTL): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, { ex: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  private shouldThrottle(walletAddress: string): boolean {
    const lastCheck = this.lastCheckTime.get(walletAddress) || 0;
    const now = Date.now();
    return (now - lastCheck) < this.MIN_CHECK_INTERVAL;
  }

  async getTokenBalance(walletAddress: string): Promise<number> {
    const cacheKey = `token_balance:${walletAddress}`;
    const cachedBalance = await this.getFromCache(cacheKey);
    if (cachedBalance !== null) {
      return parseFloat(cachedBalance);
    }

    try {
      const response = await fetch(this.HELIUS_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-checker',
          method: 'searchAssets',
          params: {
            ownerAddress: walletAddress,
            grouping: ["collection", this.tokenAddress],
            page: 1,
            limit: 10
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const { result } = await response.json();
      if (!result || !Array.isArray(result.items)) {
        throw new Error('Invalid response format from Helius API');
      }

      const balance = result.items.length;
      await this.setCache(cacheKey, balance.toString());
      return balance;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  async getTokenPrice(): Promise<number> {
    const cacheKey = 'token_price';
    const cachedPrice = await this.getFromCache(cacheKey);
    if (cachedPrice !== null) {
      return parseFloat(cachedPrice);
    }

    try {
      const response = await fetch(`https://api.jup.ag/price/v2?ids=${this.tokenAddress}`);
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.data || !data.data[this.tokenAddress]) {
        throw new Error('Invalid price data from Jupiter');
      }

      const price = parseFloat(data.data[this.tokenAddress].price);
      await this.setCache(cacheKey, price.toString());
      return price;
    } catch (error) {
      console.error('Error fetching price from Jupiter:', error);
      return 0;
    }
  }

  async checkEligibility(walletAddress: string): Promise<{
    isEligible: boolean;
    balance: number;
    price: number;
    value: number;
  }> {
    if (this.shouldThrottle(walletAddress)) {
      const lastResult = this.checkInProgress.get(walletAddress);
      if (lastResult) return lastResult;
    }

    this.lastCheckTime.set(walletAddress, Date.now());

    if (this.checkInProgress.has(walletAddress)) {
      return this.checkInProgress.get(walletAddress)!;
    }

    const cacheKey = `eligibility:${walletAddress}`;
    const cachedEligibility = await this.getFromCache(cacheKey);
    
    if (cachedEligibility !== null) {
      return JSON.parse(cachedEligibility);
    }

    const checkPromise = (async () => {
      try {
        const [balance, price] = await Promise.all([
          this.getTokenBalance(walletAddress),
          this.getTokenPrice()
        ]);

        const numericBalance = new Decimal(balance);
        const numericPrice = new Decimal(price);
        const value = numericBalance.times(numericPrice);
        
        const isEligible = value.greaterThanOrEqualTo(this.REQUIRED_USD_VALUE);

        const result = {
          isEligible,
          balance: numericBalance.toNumber(),
          price: numericPrice.toNumber(),
          value: value.toNumber()
        };

        await this.setCache(cacheKey, JSON.stringify(result), 300);
        return result;
      } catch (error) {
        console.error('Error checking eligibility:', error);
        await this.setCache(cacheKey, JSON.stringify({
          isEligible: false,
          balance: 0,
          price: 0,
          value: 0,
          error: true
        }), 30);
        throw error;
      } finally {
        this.checkInProgress.delete(walletAddress);
      }
    })();

    this.checkInProgress.set(walletAddress, checkPromise);
    return checkPromise;
  }
}

export const tokenChecker = TokenChecker.getInstance();