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

export class SolanaService {
  private connection: Connection;
  private agent: SolanaAgentKit;

  constructor() {
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')
    );
    this.agent = new SolanaAgentKit(
      "", 
      this.connection.rpcEndpoint,
      ""
    );
  }

  updateWalletConnection(publicKey: PublicKey) {
    // Update agent with connected wallet
    this.agent = new SolanaAgentKit(
      publicKey.toString(),
      this.connection.rpcEndpoint,
      ""
    );
  }

  async getPortfolio(walletAddress: PublicKey) {
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
  }

  async trade(params: TradeParams) {
    return await this.agent.trade(
      params.targetMint,
      params.amount,
      params.inputMint,
      params.slippage
    );
  }

  async pythFetchPrice(priceId: string) {
    return this.agent.pythFetchPrice(priceId);
  }

  async getTokenData(tokenAddress: string) {
    return this.agent.getTokenDataByAddress(tokenAddress);
  }
}

export const solanaService = new SolanaService();