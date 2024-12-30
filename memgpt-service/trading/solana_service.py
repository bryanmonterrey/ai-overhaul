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
        # Check if we're in production or development
        is_production = os.getenv('NODE_ENV') == 'production'
        default_url = 'https://terminal.goatse.app' if is_production else 'http://localhost:3000'
        
        # Get frontend URL with appropriate default
        frontend_url = os.getenv('NEXT_PUBLIC_FRONTEND_URL', default_url)
        self.agent_kit_url = f"{frontend_url}/api/agent-kit"
        
        # Log which environment we're using
        logging.info(f"Initializing SolanaService with frontend URL: {self.agent_kit_url}")
        
        self.token_addresses = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

    async def _call_agent_kit(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make call to agent-kit API"""
        try:
            # Handle token data lookup
            if action == 'getTokenData':
                # Try hardcoded tokens first
                if 'symbol' in params:
                    symbol = params['symbol'].upper()
                    if symbol in self.token_addresses:
                        return {
                            'symbol': symbol,
                            'address': self.token_addresses[symbol],
                            'verified': True
                        }
                
                # If we have a mint address, use it directly
                if 'mint' in params:
                    params = {'mint': params['mint']}
                elif 'symbol' in params:
                    # Try to find address for symbol
                    address = self.token_addresses.get(params['symbol'].upper())
                    if address:
                        params = {'mint': address}
                    else:
                        # Could add Jupiter token list lookup here
                        raise ValueError(f"Unknown token symbol: {params['symbol']}")

            logging.info(f"Making request to {self.agent_kit_url}")
            logging.info(f"Request payload: action={action}, params={params}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.agent_kit_url,
                    json={
                        'action': action,
                        'params': params
                    },
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
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
        
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
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
                'slippageBps': params.get('slippage', 100),
            }
            
            # Add wallet info if available
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

    async def get_routes(self, input_mint: str, output_mint: str, amount: float) -> Dict[str, Any]:
        """Get routes through agent-kit"""
        return await self._call_agent_kit('getRoutes', {
            'inputMint': input_mint,
            'outputMint': output_mint,
            'amount': amount
        })