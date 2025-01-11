# memgpt-service/trading/solana_service.py
from typing import Dict, Any, Optional
import logging
from decimal import Decimal
from datetime import datetime, timedelta
import uuid
import aiohttp
import os
import json
from memory.utils.supabase_helpers import safe_supabase_execute, handle_supabase_response

class SolanaService:
    """Solana utilities that coordinate with frontend agent-kit"""
    def __init__(self, supabase_client=None):
        # Initialize Supabase client
        self.supabase = supabase_client
        if not self.supabase:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Missing Supabase credentials")
            self.supabase = create_client(url, key)

        # Ensure RPC URL is properly formatted
        default_rpc = 'https://api.mainnet-beta.solana.com'
        rpc_url = os.getenv('NEXT_PUBLIC_RPC_URL', default_rpc)
        if not rpc_url.startswith(('http://', 'https://')):
            rpc_url = 'https://' + rpc_url
        self.rpc_url = rpc_url

        # Rest of initialization
        is_production = os.getenv('NODE_ENV') == 'production'
        default_url = 'https://terminal.goatse.app' if is_production else 'http://localhost:3000'
        frontend_url = os.getenv('NEXT_PUBLIC_FRONTEND_URL', default_url).rstrip('/')
        if not frontend_url.startswith(('http://', 'https://')):
            frontend_url = 'https://' + frontend_url
            
        self.agent_kit_url = f"{frontend_url}/api/agent-kit"
        
        # Log which environment we're using
        logging.info(f"Initializing SolanaService with frontend URL: {self.agent_kit_url}")
        
        self.token_addresses = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

    async def init_trading_session(self, wallet_info: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize a trading session with agent-kit"""
        try:
            # Extract credentials
            public_key = (
                wallet_info.get('publicKey') or 
                wallet_info.get('credentials', {}).get('publicKey')
            )
            
            # Get original signature FIRST and keep it separate
            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )
            
            if not public_key or not original_signature:
                return {
                    'success': False,
                    'error': 'missing_credentials',
                    'code': 'MISSING_CREDENTIALS',
                    'message': 'Public key and signature are required'
                }

            # Initialize session with both signature and original signature
            session_result = await self._call_agent_kit('initSession', {
                'wallet': {
                    'publicKey': public_key,
                    'signature': original_signature,  # Use original signature
                    'credentials': {
                        'publicKey': public_key,
                        'signature': original_signature,  # Keep original signature
                        'sessionId': None  # Will be filled by agent-kit
                    }
                }
            })

            if session_result.get('success'):
                # Store session info
                await self._store_session({
                    'public_key': public_key,
                    'signature': original_signature,  # Keep original signature
                    'session_id': session_result.get('sessionId'),  # New session ID
                    'expires_at': datetime.now() + timedelta(days=1)
                })

            return session_result

        except Exception as e:
            logging.error(f"Session initialization error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'code': 'SESSION_INIT_ERROR'
            }

    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Get wallet info
            wallet_info = params.get('wallet')
            if not wallet_info:
                raise ValueError("No wallet info provided")

            # Get original signature FIRST
            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )
            
            # Store original session ID if it exists
            original_session_id = (
                wallet_info.get('sessionId') or
                wallet_info.get('credentials', {}).get('sessionId') or
                wallet_info.get('credentials', {}).get('sessionSignature')
            )

            # Initialize or verify session
            session_result = await self.init_trading_session(wallet_info)
            if not session_result.get('success'):
                return session_result

            # Use current valid session ID
            session_id = session_result.get('sessionId')
            
            # Add trading headers
            headers = {
                'Content-Type': 'application/json',
                'X-Trading-Session': session_id,
                'X-Original-Signature': original_signature
            }

            # Update wallet info in params
            trade_params = {
                **params,
                'wallet': {
                    'publicKey': wallet_info.get('publicKey'),
                    'sessionId': session_id,
                    'signature': original_signature,  # Keep original signature
                    'credentials': {
                        'publicKey': wallet_info.get('publicKey'),
                        'sessionId': session_id,
                        'signature': original_signature,  # Keep original signature
                        'sessionSignature': session_id  # Use session ID for session operations
                    }
                }
            }

            # Execute trade
            result = await self._call_agent_kit('trade', trade_params, headers)
            return result

        except Exception as e:
            logging.error(f"Swap execution error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'user_message': 'Failed to execute swap'
            }

    async def _store_session(self, session_data: Dict[str, Any]) -> None:
        """Store session information in Supabase"""
        try:
            success, result = await safe_supabase_execute(
                self.supabase.table('trading_sessions').upsert(session_data),
                error_message="Failed to store session"
            )

            if not success:
                logging.warning(f"Failed to store session: {result}")
                
        except Exception as e:
            logging.error(f"Error storing session: {str(e)}")

    async def _verify_session(self, session_id: str) -> Dict[str, Any]:
        """Verify if a session is valid"""
        try:
            success, result = await safe_supabase_execute(
                self.supabase.table('trading_sessions')
                    .select('*')
                    .eq('session_id', session_id)
                    .eq('is_active', True)
                    .gt('expires_at', datetime.now().isoformat())
                    .limit(1),
                error_message="Failed to verify session"
            )

            if not success:
                return {
                    'success': False,
                    'error': str(result)
                }

            if not result or len(result) == 0:
                return {
                    'success': False,
                    'error': 'Session not found or expired'
                }

            return {
                'success': True,
                'data': result[0]
            }

        except Exception as e:
            logging.error(f"Session verification error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    async def _call_agent_kit(self, action: str, params: Dict[str, Any], headers: Dict[str, str] = None) -> Dict[str, Any]:
        """Make a request to the agent-kit API"""
        try:
            headers = headers or {
                'Content-Type': 'application/json'
            }
            
            # Add session header if available
            if (action == 'trade' and
                'X-Trading-Session' not in headers and
                params.get('wallet', {}).get('sessionId')):
                headers['X-Trading-Session'] = params['wallet']['sessionId']

            logging.info(f"Making request to {self.agent_kit_url}")
            logging.info(f"Request parameters: {json.dumps(params, default=str)}")
            logging.info(f"Request headers: {headers}")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.agent_kit_url,
                    json={
                        'action': action,
                        'params': params
                    },
                    headers=headers
                ) as response:
                    logging.info(f"Response status: {response.status}")
                    
                    if response.status != 200:
                        error_text = await response.text()
                        logging.error(f"Error response: {error_text}")
                        raise ValueError(f"API error: {response.status} - {error_text}")
                    
                    data = await response.json()
                    logging.info(f"Response data: {json.dumps(data, default=str)}")
                    return data

        except Exception as e:
            logging.error(f"Agent-kit API call error: {str(e)}")
            raise