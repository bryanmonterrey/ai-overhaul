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
            'WIF': 'EKLq75w7HHq8pSqGrHRNn6ow5QkxdQPWHNrg4RfnN7Nf',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

    async def _call_agent_kit(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make call to agent-kit API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.agent_kit_url,
                    json={
                        'action': action,
                        'params': params
                    }
                ) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        raise ValueError(f"Agent-kit error: {error_data.get('error', 'Unknown error')}")
                    return await response.json()
        except Exception as e:
            logging.error(f"Agent-kit API call error: {str(e)}")
            raise
        
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute swap through agent-kit"""
        try:
            # First validate the trade
            validation = await self._call_agent_kit('validateTransaction', params)
            if not validation.get('isValid'):
                raise ValueError(f"Trade validation failed: {validation.get('reason')}")

            # Execute the trade
            result = await self._call_agent_kit('trade', params)
            
            return {
                'success': True,
                'signature': result.get('signature'),
                'params': params,
                'result': result,
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