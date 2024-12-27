// app/lib/blockchain/token-checker.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Redis } from '@upstash/redis';
import { getRedisClient } from '../redis/client';

export class TokenChecker {
  private connection: Connection;
  private tokenAddress: string;
  private redis?: Redis;
  private readonly CACHE_TTL = 300;
  private readonly PRICE_RETRY_ATTEMPTS = 3;
  private readonly BIRDEYE_API_URL = 'https://public-api.birdeye.so/public/price';
  private readonly JUPITER_API_URL = 'https://price.jup.ag/v4/price';
  private readonly DEX_POOL_ADDRESS = 'BiLKBPSrJxsoRQxcnxoX3KArGpFBPEKjJgGeoKpyhkgp';
  private readonly REQUIRED_USD_VALUE = 20;

  constructor() {
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    this.tokenAddress = '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump';
    
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = getRedisClient();
    }
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

  async getTokenBalance(walletAddress: string): Promise<number> {
    const cacheKey = `token_balance:${walletAddress}`;
    const cachedBalance = await this.getFromCache(cacheKey);
    if (cachedBalance !== null) {
      return parseFloat(cachedBalance);
    }

    try {
      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(this.tokenAddress);
      
      // Use getAssociatedTokenAddress directly
      const tokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet
      );

      try {
        const balance = await this.connection.getTokenAccountBalance(tokenAccount);
        const balanceAmount = balance.value.uiAmount || 0;
        
        await this.setCache(cacheKey, balanceAmount.toString());
        return balanceAmount;
      } catch (error: any) {
        if (error.message.includes('Account does not exist')) {
          await this.setCache(cacheKey, '0');
          return 0;
        }
        throw error;
      }
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

    // Your default price
    const price = 1;
    await this.setCache(cacheKey, price.toString());
    return price;
  }

  async checkPriceImpact(balance: number): Promise<boolean> {
    const cacheKey = `price_impact:${balance}`;
    const cachedImpact = await this.getFromCache(cacheKey);
    if (cachedImpact !== null) {
      return cachedImpact === 'true';
    }

    try {
      const poolInfo = await this.connection.getAccountInfo(
        new PublicKey(this.DEX_POOL_ADDRESS)
      );

      if (!poolInfo) {
        await this.setCache(cacheKey, 'false');
        return false;
      }

      const poolSize = poolInfo.lamports / 1e9;
      const impact = (balance / poolSize) * 100;
      const result = impact > 1;
      
      await this.setCache(cacheKey, result.toString());
      return result;
    } catch (error) {
      console.error('Error checking price impact:', error);
      return false;
    }
  }

  async checkEligibility(walletAddress: string): Promise<{
    isEligible: boolean;
    balance: number;
    price: number;
    value: number;
  }> {
    const cacheKey = `eligibility:${walletAddress}`;
    const cachedEligibility = await this.getFromCache(cacheKey);
    
    if (cachedEligibility !== null) {
      return JSON.parse(cachedEligibility);
    }

    try {
      const [balance, price] = await Promise.all([
        this.getTokenBalance(walletAddress),
        this.getTokenPrice()
      ]);

      const value = balance * price;
      const isEligible = value >= this.REQUIRED_USD_VALUE;

      const result = {
        isEligible,
        balance,
        price,
        value
      };

      // Cache the eligibility result for a shorter time
      await this.setCache(cacheKey, JSON.stringify(result), 60); // Cache for 1 minute
      
      return result;
    } catch (error) {
      console.error('Error checking eligibility:', error);
      throw error;
    }
  }
}