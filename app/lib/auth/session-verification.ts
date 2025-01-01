// app/lib/auth/session-verification.ts
import { TradingSessionManager } from '../session-manager';

export async function verifySession(
  publicKey: string,
  sessionSignature: string
): Promise<boolean> {
  try {
    const session = TradingSessionManager.getSession();
    
    if (!session) {
      return false;
    }

    // Verify the session belongs to this public key
    if (session.publicKey !== publicKey) {
      return false;
    }

    // Verify signature matches
    if (session.signature !== sessionSignature) {
      return false;
    }

    // Check if session is expired (24 hours)
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
      TradingSessionManager.clearSession();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}