import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getAdminSettings } from '@/supabase/schema/auth-settings';

export class TokenChecker {
  private connection: Connection;
  private tokenAddress: string;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.tokenAddress = '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump';
  }

  async getTokenBalance(walletAddress: string): Promise<number> {
    try {
      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(this.tokenAddress);
      
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      
      return balance.value.uiAmount || 0;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  async getTokenPrice(): Promise<number> {
    // Implement price fetching from your preferred price feed
    // This is just a placeholder
    try {
      const response = await fetch('YOUR_PRICE_API_ENDPOINT');
      const data = await response.json();
      return data.price;
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

  async checkEligibility(walletAddress: string): Promise<boolean> {
    const settings = await getAdminSettings();
    const requiredValue = settings?.required_token_value || 0;
    
    const balance = await this.getTokenBalance(walletAddress);
    const price = await this.getTokenPrice();
    const value = balance * price;
    
    return value >= requiredValue;
  }
}