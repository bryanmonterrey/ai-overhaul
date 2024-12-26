// app/lib/solana.ts
import { SolanaAgentKit } from 'solana-agent-kit';
import { Connection, PublicKey, TokenAccountsFilter, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface TradeParams {
  targetMint: PublicKey;
  amount: number;
  inputMint: PublicKey;
  slippage: number;
}

interface TokenAccount {
  mint: string;
  amount: number;
  decimals: number;
}

export class SolanaService {
  private connection: Connection;
  private agent: SolanaAgentKit;
  private walletConnected: boolean = false;

  constructor() {
    try {
      this.connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')
      );
      this.agent = new SolanaAgentKit(
        "", 
        this.connection.rpcEndpoint,
        ""
      );
    } catch (error) {
      console.error('Failed to initialize SolanaService:', error);
      throw new Error('Failed to initialize Solana connection');
    }
  }

  updateWalletConnection(publicKey: PublicKey) {
    try {
      // Update agent with connected wallet
      this.agent = new SolanaAgentKit(
        publicKey.toString(),
        this.connection.rpcEndpoint,
        ""
      );
      this.walletConnected = true;
    } catch (error) {
      console.error('Failed to update wallet connection:', error);
      this.walletConnected = false;
      throw new Error('Failed to connect wallet');
    }
  }

  async getPortfolio(walletAddress: PublicKey): Promise<TokenAccount[]> {
    try {
      const filter: TokenAccountsFilter = {
        programId: TOKEN_PROGRAM_ID
      };
   
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletAddress,
        filter
      );

      return tokenAccounts.value.map(account => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals
      }));
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
      throw new Error('Failed to fetch portfolio');
    }
  }

  private checkWalletConnection() {
    if (!this.walletConnected) {
      throw new Error('Wallet not connected');
    }
  }

  async trade(params: TradeParams) {
    try {
      this.checkWalletConnection();
      
      // Validate parameters
      if (!params.targetMint || !params.amount || !params.inputMint) {
        throw new Error('Invalid trade parameters');
      }

      return await this.agent.trade(
        params.targetMint,
        params.amount,
        params.inputMint,
        params.slippage || 100 // Default 1% slippage
      );
    } catch (error) {
      console.error('Trade execution failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Trade execution failed'
      );
    }
  }

  async pythFetchPrice(priceId: string) {
    try {
      this.checkWalletConnection();
      if (!priceId) {
        throw new Error('Price ID is required');
      }
      return await this.agent.pythFetchPrice(priceId);
    } catch (error) {
      console.error('Failed to fetch Pyth price:', error);
      throw new Error('Failed to fetch price data');
    }
  }

  async getTokenData(tokenAddress: string) {
    try {
      this.checkWalletConnection();
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }
      return await this.agent.getTokenDataByAddress(tokenAddress);
    } catch (error) {
      console.error('Failed to fetch token data:', error);
      throw new Error('Failed to fetch token data');
    }
  }

  // Additional utility methods
  isConnected(): boolean {
    return this.walletConnected;
  }

  async getConnection(): Promise<Connection> {
    try {
      const version = await this.connection.getVersion();
      return this.connection;
    } catch (error) {
      console.error('Connection error:', error);
      throw new Error('Failed to verify Solana connection');
    }
  }

  disconnectWallet() {
    this.walletConnected = false;
    this.agent = new SolanaAgentKit(
      "", 
      this.connection.rpcEndpoint,
      ""
    );
  }
}

export const solanaService = new SolanaService();