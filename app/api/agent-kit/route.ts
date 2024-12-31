// app/api/agent-kit/route.ts

import { NextResponse } from 'next/server';
import { tradeExecution } from '../../trading/services/execution';
import { PublicKey } from '@solana/web3.js';
import { TradingSessionManager } from '@/lib/trading/session-manager';
import { verifySession } from '@/lib/trading/session-verification';

export async function POST(req: Request) {
  console.log('Agent-kit API called with request:', {
    method: req.method,
    headers: Object.fromEntries(req.headers),
  });

  try {
    const body = await req.json();
    console.log('Request body:', body);
    
    const { action, params } = body;
    
    if (!action) {
      return NextResponse.json({ 
        error: 'Missing action parameter' 
      }, { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('Processing action:', action, 'with params:', params);

    // Verify trading session for actions that require authentication
    if (['trade', 'validateTransaction'].includes(action)) {
      const sessionSignature = req.headers.get('X-Trading-Session');
      
      if (!sessionSignature) {
        return NextResponse.json({ 
          error: 'No trading session found',
          code: 'SESSION_REQUIRED'
        }, { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      if (!params?.wallet?.publicKey) {
        return NextResponse.json({ 
          error: 'Wallet public key required',
          code: 'INVALID_WALLET'
        }, { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      const isValidSession = await verifySession(
        params.wallet.publicKey,
        sessionSignature
      );

      if (!isValidSession) {
        return NextResponse.json({ 
          error: 'Invalid or expired session',
          code: 'SESSION_EXPIRED'
        }, { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    switch(action) {
      case 'trade':
        if (!params?.wallet) {
          return NextResponse.json({ 
            error: 'Wallet required for trade' 
          }, { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const tradeResult = await tradeExecution.executeTradeWithMEV(params, params.wallet);
        return NextResponse.json(tradeResult, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
      case 'getTokenData':
        if (!params?.mint) {
          return NextResponse.json({ 
            error: 'Mint parameter is required'
          }, { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const tokenData = await tradeExecution.validateToken(params.mint);
        return NextResponse.json(tokenData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
      case 'getPrice':
        if (!params?.mint) {
          return NextResponse.json({ 
            error: 'Mint parameter is required'
          }, { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const price = await tradeExecution.getTokenPrice(params.mint);
        return NextResponse.json({ price }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

      case 'getRoutes':
        if (!params?.inputMint || !params?.outputMint || !params?.amount) {
          return NextResponse.json({ 
            error: 'inputMint, outputMint, and amount are required'
          }, { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const quote = await tradeExecution.getRouteQuote({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippage: params.slippage || 1,
          useMev: params.useMev || false
        });
        return NextResponse.json(quote, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

      case 'validateTransaction':
        // For validation, we can use getRouteQuote to validate the trade parameters
        const validation = await tradeExecution.getRouteQuote(params);
        return NextResponse.json({
          isValid: true,
          quote: validation,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

      case 'validateSession':
        // New endpoint to validate trading sessions
        if (!params?.sessionSignature || !params?.publicKey) {
          return NextResponse.json({ 
            error: 'Session signature and public key required'
          }, { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const sessionValid = await verifySession(
          params.publicKey,
          params.sessionSignature
        );
        return NextResponse.json({ 
          valid: sessionValid,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          action: action,
          supported: ['trade', 'getTokenData', 'getPrice', 'getRoutes', 'validateTransaction', 'validateSession']
        }, { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error: any) {
    console.error('Agent-kit API detailed error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return NextResponse.json({ 
      error: error.message,
      type: error.name,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        cause: error.cause
      } : undefined
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}