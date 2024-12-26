// app/lib/solana.ts
import { SolanaAgentKit } from 'solana-agent-kit';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

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

  async pythFetchPrice(priceId: string) {
    return this.agent.pythFetchPrice(priceId);
  }

  async getTokenData(tokenAddress: string) {
    return this.agent.getTokenDataByAddress(tokenAddress);
  }
}

export const solanaService = new SolanaService();