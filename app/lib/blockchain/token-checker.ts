// app/lib/blockchain/token-checker.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export class TokenChecker {
  private connection: Connection;
  private tokenAddress: string;
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
  }

  async getTokenBalance(walletAddress: string): Promise<number> {
    try {
      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(this.tokenAddress);
      
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);

      try {
        const balance = await this.connection.getTokenAccountBalance(tokenAccount);
        return balance.value.uiAmount || 0;
      } catch (error: any) {
        if (error.message.includes('Account does not exist')) {
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
    // Return a default price instead of fetching
    return 1; // Or any default value you want to use
}

  async checkPriceImpact(balance: number): Promise<boolean> {
    try {
      const poolInfo = await this.connection.getAccountInfo(
        new PublicKey(this.DEX_POOL_ADDRESS)
      );

      if (!poolInfo) {
        return false;
      }

      // Calculate price impact using pool data
      const poolSize = poolInfo.lamports / 1e9;  // Convert lamports to SOL
      const impact = (balance / poolSize) * 100;

      return impact > 1; // 1% impact threshold
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
    try {
      const [balance, price] = await Promise.all([
        this.getTokenBalance(walletAddress),
        this.getTokenPrice()
      ]);

      const value = balance * price;
      const isEligible = value >= this.REQUIRED_USD_VALUE;

      return {
        isEligible,
        balance,
        price,
        value
      };
    } catch (error) {
      console.error('Error checking eligibility:', error);
      throw error;
    }
  }
}