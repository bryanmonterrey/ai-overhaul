# memgpt-service/trading/solana_service.py
from typing import Dict, Any, Optional
import logging
from decimal import Decimal
from datetime import datetime
import aiohttp
import os

class SolanaService:
    """Solana utilities that coordinate with frontend agent-kit"""
    def __init__(self):
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
            # Get SignatureProof from frontend's signed message
            signature = wallet_info.get('credentials', {}).get('sessionProof')
            if not signature:
                # Generate session message and ask frontend to sign
                return {
                    'success': False,
                    'error': 'session_signature_required',
                    'session_message': f"Trading session initialization for {wallet_info['publicKey']}"
                }
                
            init_params = {
                'wallet': {
                    'publicKey': wallet_info['publicKey'],
                    'signature': signature
                }
            }
            
            result = await self._call_agent_kit('initSession', init_params)
            if result.get('success'):
                logging.info("Session initialization successful")
            else:
                logging.error(f"Session initialization failed: {result.get('error')}")
                
            return result
            
        except Exception as e:
            logging.error(f"Session initialization error: {str(e)}")
            raise

    async def _call_agent_kit(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            logging.info(f"Making request to {self.agent_kit_url}")
            logging.info(f"Request payload: action={action}, params={params}")
            
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Extract session signature from all possible locations
            wallet_info = params.get('wallet', {})
            if isinstance(wallet_info, dict):
                # Try the new location first
                session_sig = wallet_info.get('signature')
                if not session_sig:
                    # Try the legacy locations
                    session_sig = (
                        wallet_info.get('credentials', {}).get('signature') or
                        wallet_info.get('credentials', {}).get('sessionProof')
                    )
                
                if session_sig:
                    headers['X-Trading-Session'] = session_sig
                    logging.info("Added session signature to headers")
            
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
                    logging.info(f"Response headers: {dict(response.headers)}")
                    
                    content_type = response.headers.get('Content-Type', '')
                    if response.status != 200 or 'application/json' not in content_type.lower():
                        error_text = await response.text()
                        logging.error(f"Error response: {error_text}")
                        raise ValueError(f"API error: status={response.status}, content-type={content_type}, body={error_text}")
                    
                    data = await response.json()
                    logging.info(f"Response data: {data}")
                    return data
                        
        except Exception as e:
            logging.error(f"Agent-kit API call error: {str(e)}")
            raise


    async def get_token_info(self, symbol_or_address: str) -> Dict[str, Any]:
        """Dynamically get token info from Jupiter API or on-chain"""
        try:
            # Check if it's a known token first
            if symbol := symbol_or_address.upper():
                if address := self.token_addresses.get(symbol):
                    return {
                        'symbol': symbol,
                        'address': address,
                        'verified': True
                    }

            # Try Jupiter token list
            jupiter_url = "https://token.jup.ag/all"
            async with aiohttp.ClientSession() as session:
                async with session.get(jupiter_url) as response:
                    if response.ok:
                        token_list = await response.json()
                        # Look for exact matches first
                        token = next((t for t in token_list 
                            if t['symbol'].upper() == symbol_or_address.upper() or 
                            t['address'] == symbol_or_address), None)
                        
                        if token:
                            return {
                                'symbol': token['symbol'],
                                'address': token['address'],
                                'verified': True,
                                'decimals': token.get('decimals', 9)
                            }

            # If it looks like an address, treat as unverified token
            if len(symbol_or_address) == 44:
                return {
                    'symbol': symbol_or_address[:8],  # Short version of address
                    'address': symbol_or_address,
                    'verified': False,
                    'decimals': 9
                }

            raise ValueError(f"Could not find token info for: {symbol_or_address}")

        except Exception as e:
            logging.error(f"Error getting token info: {str(e)}")
            raise
        
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Check for session signature first
            if wallet_info := params.get('wallet'):
                # First try the new location
                session_proof = wallet_info.get('signature')
                if not session_proof:
                    # Try the legacy location
                    session_proof = wallet_info.get('credentials', {}).get('sessionProof')
                    
                if not session_proof:
                    # Initialize new session
                    try:
                        session_result = await self.init_trading_session(wallet_info)
                        if not session_result.get('success'):
                            if session_result.get('error') == 'session_signature_required':
                                return {
                                    'success': False,
                                    'error': 'session_required',
                                    'session_message': session_result.get('session_message'),
                                    'user_message': 'Please sign the message to start your trading session'
                                }
                            raise ValueError(f"Failed to initialize session: {session_result.get('error')}")
                            
                        # Update wallet credentials with session info    
                        if session_token := session_result.get('sessionId'):
                            wallet_info['signature'] = session_token  # Store directly in wallet_info
                            if isinstance(wallet_info.get('credentials'), dict):
                                wallet_info['credentials']['signature'] = session_token  # Also store in credentials for backwards compatibility
                            logging.info("Added session token to wallet info")
                    except Exception as e:
                        logging.error(f"Failed to initialize session: {str(e)}")
                        raise ValueError(f"Session initialization failed: {str(e)}")

            # Get token data from params or lookup
            symbol = params['asset'].upper()
            token_address = self.token_addresses.get(symbol)
                
            if not token_address:
                if len(params['asset']) == 44:
                    token_address = params['asset']
                else:
                    raise ValueError(f"Unknown token: {params['asset']}")

            # Format parameters for agent-kit trade
            swap_params = {
                'outputMint': token_address,
                'inputAmount': float(params['amount']),
                'inputMint': self.token_addresses['SOL'],
                'tokenIn': self.token_addresses['SOL'],
                'tokenOut': token_address,
                'slippageBps': params.get('slippage', 100)
            }
            
            # Pass through wallet info without modification
            if wallet_info := params.get('wallet'):
                swap_params['wallet'] = wallet_info

            logging.info(f"Executing trade with params: {swap_params}")
            result = await self._call_agent_kit('trade', swap_params)
            
            return {
                'success': True,
                'signature': result.get('signature'),
                'params': params,
                'result': result,
                'token_address': token_address,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logging.error(f"Swap execution error: {str(e)}")
            raise

    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token data through agent-kit"""
        return await self._call_agent_kit('getTokenData', {'mint': token_address})

    async def get_token_price(self, token: str) -> Decimal:
        """Get token price through agent-kit"""
        result = await self._call_agent_kit('getPrice', {
            'mint': self.token_addresses.get(token.upper(), token)
        })
        return Decimal(str(result.get('price', 0)))

    async def get_token_info(self, symbol_or_address: str) -> Dict[str, Any]:
        """Dynamically get token info from Jupiter API or on-chain"""
        try:
            # Use the correct parameter name for getTokenData
            params = {
                'symbol': symbol_or_address.upper() if len(symbol_or_address) < 44 else None,
                'mint': symbol_or_address if len(symbol_or_address) == 44 else None,
                'discover': True
            }

            result = await self._call_agent_kit('getTokenData', params)
            if result.get('success'):
                return result.get('data')

            raise ValueError(f"Could not find token info for: {symbol_or_address}")

        except Exception as e:
            logging.error(f"Error getting token info: {str(e)}")
            raise

    async def get_routes(self, input_mint: str, output_mint: str, amount: float) -> Dict[str, Any]:
        """Get routes through agent-kit"""
        return await self._call_agent_kit('getRoutes', {
            'inputMint': input_mint,
            'outputMint': output_mint,
            'amount': amount
        })