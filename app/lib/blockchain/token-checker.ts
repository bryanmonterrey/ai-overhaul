import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getAdminSettings } from '@/supabase/schema/auth-settings';

export class TokenChecker {
  private connection: Connection;
  private tokenAddress: string;
  private readonly PRICE_RETRY_ATTEMPTS = 3;
  private readonly BIRDEYE_API_URL = 'https://public-api.birdeye.so/public/price';
  private readonly JUPITER_API_URL = 'https://price.jup.ag/v4/price';

  constructor() {
    // Use Helius RPC URL if available, fallback to public endpoint
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    this.tokenAddress = '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump';
  }

  async getTokenBalance(walletAddress: string): Promise<number> {
    try {
      // Validate wallet address
      if (!walletAddress || typeof walletAddress !== 'string') {
        throw new Error('Invalid wallet address');
      }

      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(this.tokenAddress);
      
      // Get the associated token account
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);

      // Try to get the balance with a timeout
      const balancePromise = this.connection.getTokenAccountBalance(tokenAccount);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Balance check timeout')), 10000)
      );

      const balance = await Promise.race([balancePromise, timeoutPromise]) as any;
      
      return balance.value.uiAmount || 0;
    } catch (error: any) {
      console.error('Error getting token balance:', error.message);
      // Return 0 for specific known errors
      if (error.message.includes('Account does not exist')) {
        return 0;
      }
      throw error; // Re-throw other errors for proper handling
    }
  }

  async getTokenPrice(): Promise<number> {
    // Try Jupiter first, then Birdeye as fallback
    for (let attempt = 0; attempt < this.PRICE_RETRY_ATTEMPTS; attempt++) {
      try {
        // Try Jupiter price API first
        const jupiterResponse = await fetch(
          `${this.JUPITER_API_URL}?ids=${this.tokenAddress}`
        );
        
        if (jupiterResponse.ok) {
          const jupiterData = await jupiterResponse.json();
          const price = jupiterData.data[this.tokenAddress]?.price;
          if (price && price > 0) {
            return price;
          }
        }

        // Fallback to Birdeye if Jupiter fails or returns invalid price
        if (process.env.BIRDEYE_API_KEY) {
          const birdeyeResponse = await fetch(
            `${this.BIRDEYE_API_URL}?address=${this.tokenAddress}`,
            {
              headers: {
                'X-API-KEY': process.env.BIRDEYE_API_KEY
              }
            }
          );

          if (birdeyeResponse.ok) {
            const birdeyeData = await birdeyeResponse.json();
            const price = birdeyeData.data?.value;
            if (price && price > 0) {
              return price;
            }
          }
        }

        // If both failed, wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Price fetch attempt ${attempt + 1} failed:`, error);
        if (attempt === this.PRICE_RETRY_ATTEMPTS - 1) {
          throw error;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Failed to fetch token price after multiple attempts');
  }

  async checkEligibility(walletAddress: string): Promise<boolean> {
    try {
      const settings = await getAdminSettings();
      const requiredValue = settings?.required_token_value || 0;
      
      const [balance, price] = await Promise.all([
        this.getTokenBalance(walletAddress),
        this.getTokenPrice()
      ]);

      const value = balance * price;
      
      // Log for debugging
      console.log({
        walletAddress,
        balance,
        price,
        value,
        requiredValue,
        isEligible: value >= requiredValue
      });

      return value >= requiredValue;
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return false; // Default to not eligible on error
    }
  }

  // Helper method to validate wallet address format
  private isValidWalletAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}