import { SolanaAgentKit } from 'solana-agent-kit';
import { ISolanaAgentKit, SessionResponse } from '../types/agent-kit';

export class ExtendedSolanaAgentKit extends SolanaAgentKit implements ISolanaAgentKit {
  async initSession(params: { wallet: { publicKey: string; sessionProof?: string; } }): Promise<SessionResponse> {
    return {
      success: true,
      sessionId: Math.random().toString(),
      timestamp: new Date().toISOString()
    };
  }

  async validateSession(sessionId: string): Promise<boolean> {
    return true;
  }
}