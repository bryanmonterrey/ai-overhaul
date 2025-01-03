// app/trading/services/holderTradingService.ts
import { createClient } from '@supabase/supabase-js';
import { solanaService } from '../../lib/solana';
import { PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

interface WSMessage {
  type: string;
  clientId?: string;
  data?: any;
  userAddress?: string;  // Added for holder identification
}

class HolderTradingService {
  private supabase;
  private baseUrl = '/api/trading/holders/chat';  // Changed endpoint
  private ws: WebSocket | null = null;
  private clientId: string = '';
  private isConnected: boolean = false;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private tradeStatusCallbacks: Map<string, Set<(status: any) => void>> = new Map();  // Modified to track by user
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 2000;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  private initializeWebSocket(userAddress: string) {
    if (!this.ws && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      const wsBase = process.env.NODE_ENV === 'production' 
        ? 'wss://ai-overhaul.onrender.com'
        : 'ws://localhost:3001';
      
      const wsUrl = `${wsBase}/ws/trading/holders?clientId=${this.clientId}&userAddress=${userAddress}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected successfully for holder:', userAddress);
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };
        
        this.ws.onclose = (event) => {
          this.isConnected = false;
          console.log(`WebSocket closed for holder ${userAddress} with code: ${event.code}`);
          this.attemptReconnect(userAddress);
        };
        
        this.ws.onerror = (error) => {
          console.warn('WebSocket connection error for holder:', userAddress, error);
        };
        
        this.setupMessageHandlers(userAddress);
      } catch (error) {
        console.error('Failed to initialize WebSocket for holder:', userAddress, error);
        this.attemptReconnect(userAddress);
      }
    }
  }

  private attemptReconnect(userAddress: string) {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = this.RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect for holder ${userAddress} in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.initializeWebSocket(userAddress), delay);
    } else {
      console.error('Max reconnection attempts reached for holder:', userAddress);
    }
  }

  // WebSocket subscription for real-time updates
  subscribeToUpdates(userAddress: string, callback: (update: any) => void) {
    const channel = this.supabase.channel(`holder_trading_${userAddress}`)
      .on('broadcast', { event: 'trading_update' }, ({ payload }) => {
        // Only process updates for this specific holder
        if (payload.userAddress === userAddress) {
          callback(payload);
        }
      })
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      }
    };
  }

  // Trading Controls - Holders only need status checks, not start/stop
  async getHolderTradingStatus(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/status`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Address': userAddress
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get trading status');
    }

    return response.json();
  }

  // Manual Trade Execution for Holders
  async executeHolderTrade(trade: {
    token: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
    userAddress: string;
    wallet?: {
      publicKey: PublicKey;
      signTransaction: WalletContextState['signTransaction'];
      signAllTransactions: WalletContextState['signAllTransactions'];
      timestamp: number;
    };
  }) {
    try {
      // Verify wallet matches userAddress
      if (trade.wallet?.publicKey.toString() !== trade.userAddress) {
        throw new Error('Wallet address does not match holder address');
      }

      // Get market data
      const [priceData, tokenData] = await Promise.all([
        solanaService.pythFetchPrice(trade.token),
        solanaService.getTokenData(trade.token)
      ]);

      // Execute trade through holder-specific endpoint
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Address': trade.userAddress
        },
        body: JSON.stringify({
          ...trade,
          priceData,
          tokenData,
          asset: trade.token,
          amount: trade.amount,
          side: trade.side,
          wallet: trade.wallet
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute trade');
      }

      const result = await response.json();

      // Create trade status promise with timeout
      const tradeStatusPromise = new Promise((resolve, reject) => {
        const subscription = this.subscribeToTradeStatus(trade.userAddress, (status) => {
          if (status.trade_id === result.trade_id) {
            if (status.status === 'confirmed') {
              subscription.unsubscribe();
              resolve(status);
            } else if (status.status === 'error') {
              subscription.unsubscribe();
              reject(new Error(status.error));
            }
          }
        });

        // Add timeout
        setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error('Trade confirmation timeout'));
        }, 30000); // 30 seconds timeout
      });

      // Wait for trade confirmation
      await tradeStatusPromise;

      // Broadcast update to holder's channel
      this.supabase.channel(`holder_trading_${trade.userAddress}`)
        .send({
          type: 'broadcast',
          event: 'trading_update',
          payload: {
            type: 'trade_execution',
            userAddress: trade.userAddress,
            ...trade,
            result
          }
        });

      return result;
    } catch (error) {
      console.error('Holder trade execution error:', error);
      throw error;
    }
  }

  subscribeToTradeStatus(userAddress: string, callback: (status: any) => void) {
    // Initialize callbacks set for this user if it doesn't exist
    if (!this.tradeStatusCallbacks.has(userAddress)) {
      this.tradeStatusCallbacks.set(userAddress, new Set());
    }
    
    const userCallbacks = this.tradeStatusCallbacks.get(userAddress)!;
    userCallbacks.add(callback);

    // Initialize WebSocket if not already done
    if (!this.ws) {
      // Generate client ID with user address
      this.clientId = `${userAddress}-${crypto.randomUUID()}`;

      // Get WebSocket URL based on environment
      const isProduction = process.env.NODE_ENV === 'production';
      const wsBase = isProduction 
        ? 'wss://ai-overhaul.onrender.com'
        : 'ws://localhost:3001';
      
      const wsUrl = `${wsBase}/ws/trading/holders?clientId=${this.clientId}&userAddress=${userAddress}`;
      
      console.log('Connecting to WebSocket for holder:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      // Set up message handlers
      this.setupMessageHandlers(userAddress);

      this.ws.onopen = () => {
        console.log('WebSocket connected for holder:', userAddress);
        // Add a small delay before sending subscription message
        setTimeout(() => {
          this.sendMessage({
            type: 'subscribe',
            clientId: this.clientId,
            userAddress,
            data: {
              channel: 'trade_status',
              userAddress
            }
          });
        }, 100); // 100ms delay to ensure the server is ready
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          // Verify message is for correct holder
          if (message.userAddress && message.userAddress !== userAddress) {
            return;
          }
          
          // Handle initial connection message
          if (message.type === 'connected') {
            console.log('Connection confirmed for holder:', message.clientId);
            this.clientId = message.clientId || this.clientId;
          }
          // Handle trade status updates
          else if (message.type === 'trade_status') {
            const userCallbacks = this.tradeStatusCallbacks.get(userAddress);
            if (userCallbacks) {
              userCallbacks.forEach(cb => {
                try {
                  cb(message.data);
                } catch (callbackError) {
                  console.error('Error in trade status callback for holder:', userAddress, callbackError);
                }
              });
            }
          }
          // Handle other message types
          else {
            const handlers = this.messageHandlers.get(message.type);
            if (handlers) {
              handlers.forEach(handler => {
                try {
                  handler(message.data);
                } catch (error) {
                  console.error(`Error in ${message.type} handler for holder:`, userAddress, error);
                }
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message for holder:', userAddress, error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error for holder:', userAddress, error);
        this.handleConnectionError(userAddress);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed for holder:', userAddress, event.code, event.reason);
        if (event.code !== 1000) {
          this.handleConnectionError(userAddress);
        }
      };
    }

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        const userCallbacks = this.tradeStatusCallbacks.get(userAddress);
        if (userCallbacks) {
          userCallbacks.delete(callback);
          if (userCallbacks.size === 0) {
            this.tradeStatusCallbacks.delete(userAddress);
            
            // Send unsubscribe message before closing
            this.sendMessage({
              type: 'unsubscribe',
              clientId: this.clientId,
              userAddress,
              data: {
                channel: 'trade_status',
                userAddress
              }
            });

            if (this.ws) {
              this.ws.close(1000, `Holder ${userAddress} unsubscribed`);
              this.ws = null;
            }
          }
        }
      }
    };
  }

  private setupMessageHandlers(userAddress: string) {
    // Add default message handlers
    this.messageHandlers.set('error', [(data) => {
      console.error('WebSocket server error for holder:', userAddress, data);
    }]);

    this.messageHandlers.set('heartbeat', [(data) => {
      this.sendMessage({
        type: 'pong',
        clientId: this.clientId,
        userAddress
      });
    }]);

    // Add holder-specific handlers
    this.messageHandlers.set('holder_update', [(data) => {
      console.log('Received holder update:', userAddress, data);
      // Handle any holder-specific updates here
    }]);
  }

  private sendMessage(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready for holder:', message.userAddress, 'message not sent:', message);
    }
  }

  private handleConnectionError(userAddress: string) {
    // Implement exponential backoff with user context
    const backoff = (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 30000);
    let retries = 0;

    const tryReconnect = () => {
      if (this.tradeStatusCallbacks.has(userAddress) && retries < 5) {
        setTimeout(() => {
          console.log(`Attempting to reconnect for holder ${userAddress} (attempt ${retries + 1})...`);
          this.reconnectWebSocket(userAddress);
          retries++;
        }, backoff(retries));
      }
    };

    tryReconnect();
  }
  
  private reconnectWebSocket(userAddress: string) {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
    
    const userCallbacks = this.tradeStatusCallbacks.get(userAddress);
    if (userCallbacks && userCallbacks.size > 0) {
      // Get first callback to reestablish connection
      const firstCallback = Array.from(userCallbacks)[0];
      this.subscribeToTradeStatus(userAddress, firstCallback);
    }
  }

  // Holder Portfolio Management
  async getHolderPortfolio(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/portfolio/${userAddress}`);

    if (!response.ok) {
      throw new Error('Failed to fetch holder portfolio');
    }

    return response.json();
  }

  async getHolderPositionSizeRecommendation(userAddress: string, token: string) {
    const response = await fetch(`${this.baseUrl}/position-size/${token}`, {
      headers: {
        'X-User-Address': userAddress
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get position size recommendation');
    }

    return response.json();
  }

  // Performance Analytics for Holders
  async getHolderPerformanceMetrics(userAddress: string, timeframe: string = '24h') {
    const response = await fetch(`${this.baseUrl}/metrics/${userAddress}?timeframe=${timeframe}`);

    if (!response.ok) {
      throw new Error('Failed to fetch holder performance metrics');
    }

    return response.json();
  }

  // Get Trading Limits and Restrictions
  async getHolderTradingLimits(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/limits/${userAddress}`);

    if (!response.ok) {
      throw new Error('Failed to fetch trading limits');
    }

    return response.json();
  }

  // Get Available Trading Pairs for Holder
  async getHolderAvailablePairs(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/available-pairs/${userAddress}`);

    if (!response.ok) {
      throw new Error('Failed to fetch available trading pairs');
    }

    return response.json();
  }

  // Verify Holder Eligibility
  async verifyHolderEligibility(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/verify-eligibility/${userAddress}`);

    if (!response.ok) {
      throw new Error('Failed to verify holder eligibility');
    }

    return response.json();
  }

  // Get Holder Trading History
  async getHolderTradingHistory(userAddress: string, limit: number = 10) {
    const response = await fetch(`${this.baseUrl}/history/${userAddress}?limit=${limit}`);

    if (!response.ok) {
      throw new Error('Failed to fetch trading history');
    }

    return response.json();
  }

  async getTokenBalance(userAddress: string) {
    const response = await fetch(`${this.baseUrl}/balance/${userAddress}`);
  
    if (!response.ok) {
      throw new Error('Failed to fetch token balance');
    }
  
    return response.json();
  }
  
  // Toggle Trading
  async toggleTrading(userAddress: string, enabled: boolean) {
    const response = await fetch(`${this.baseUrl}/toggle-trading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Address': userAddress
      },
      body: JSON.stringify({
        enabled,
        userAddress
      })
    });
  
    if (!response.ok) {
      throw new Error('Failed to toggle trading status');
    }
  
    return response.json();
  }

  // Clear Holder Session
  async clearHolderSession(userAddress: string) {
    const userCallbacks = this.tradeStatusCallbacks.get(userAddress);
    if (userCallbacks) {
      userCallbacks.clear();
      this.tradeStatusCallbacks.delete(userAddress);
    }

    if (this.ws) {
      this.ws.close(1000, `Holder ${userAddress} session cleared`);
      this.ws = null;
    }
  }
}

// Export singleton instance
export const holderTradingService = new HolderTradingService();