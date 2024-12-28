from typing import Dict, Any, Optional, List
import os
import logging
from decimal import Decimal
import aiohttp
from datetime import datetime

class SolanaService:
    def __init__(self):
        # Known token addresses
        self.token_addresses = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',  # BONK token
            'WIF': 'EKLq75w7HHq8pSqGrHRNn6ow5QkxdQPWHNrg4RfnN7Nf',   # WIF token
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',  # Added USDC
            # Add more tokens as needed
        }
        self.JUPITER_API_URL = "https://quote-api.jup.ag/v6"
        
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a token swap using Jupiter API"""
        try:
            # Extract parameters
            input_mint = params.get('tokenIn', self.token_addresses['SOL'])
            output_mint = params.get('tokenOut')
            amount = int(float(params['amount']) * 10**9)  # Convert to lamports
            slippage_bps = int(params.get('slippage', 100))  # Default 1%
            
            # Prepare quote parameters
            quote_params = {
                'inputMint': input_mint,
                'outputMint': output_mint,
                'amount': str(amount),
                'slippageBps': slippage_bps,
                'onlyDirectRoutes': False,
                'asLegacyTransaction': True  # For better compatibility
            }
            
            async with aiohttp.ClientSession() as session:
                # Get quote
                async with session.get(
                    f"{self.JUPITER_API_URL}/quote",
                    params=quote_params
                ) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        raise ValueError(f"Quote error: {error_data.get('error', 'Unknown error')}")
                    
                    quote_data = await response.json()
                    
                    return {
                        'inputMint': input_mint,
                        'outputMint': output_mint,
                        'inAmount': str(amount),
                        'outAmount': quote_data.get('outAmount'),
                        'routes': quote_data.get('routes'),
                        'otherAmountThreshold': quote_data.get('otherAmountThreshold'),
                        'swapMode': "ExactIn",
                        'slippageBps': slippage_bps,
                        'platformFee': quote_data.get('platformFee', None),
                        'priceImpactPct': quote_data.get('priceImpactPct', 0),
                        'contextSlot': quote_data.get('contextSlot'),
                        'timestamp': datetime.now().isoformat()
                    }

        except Exception as e:
            logging.error(f"Swap execution error: {str(e)}")
            raise

    async def get_token_price(self, token: str) -> Decimal:
        """Get token price from Jupiter"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'inputMint': self.token_addresses.get(token.upper(), token),
                    'outputMint': self.token_addresses['USDC'],
                    'amount': '1000000000'  # 1 token in lamports
                }
                
                async with session.get(
                    f"{self.JUPITER_API_URL}/quote",
                    params=params
                ) as response:
                    if response.status == 200:
                        quote_data = await response.json()
                        # Calculate price from quote (in USDC)
                        out_amount = Decimal(quote_data['outAmount']) / Decimal('1000000')  # USDC decimals
                        return out_amount
                    else:
                        error_data = await response.json()
                        raise ValueError(f"Jupiter price error: {error_data.get('error', 'Unknown error')}")

        except Exception as e:
            logging.error(f"Error fetching token price: {str(e)}")
            raise

    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token metadata from Jupiter"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get('https://token.jup.ag/all') as response:
                    if response.status != 200:
                        raise ValueError(f"Failed to get token list: {response.status}")
                    
                    tokens = await response.json()
                    token_info = next((t for t in tokens if t['address'] == token_address), None)
                    
                    if not token_info:
                        raise ValueError(f"No data found for token: {token_address}")
                    
                    return {
                        "address": token_address,
                        "decimals": token_info.get('decimals', 9),
                        "name": token_info.get('name'),
                        "symbol": token_info.get('symbol'),
                        "logoURI": token_info.get('logoURI'),
                        "tags": token_info.get('tags', []),
                        "verified": token_info.get('verified', False)
                    }

        except Exception as e:
            logging.error(f"Error fetching token data: {str(e)}")
            raise

    async def get_token_list(self) -> List[Dict[str, Any]]:
        """Get Jupiter's token list"""
        async with aiohttp.ClientSession() as session:
            async with session.get('https://token.jup.ag/all') as response:
                if response.status == 200:
                    return await response.json()
                raise ValueError(f"Failed to get token list: {response.status}")
            
    async def get_routes(self, input_mint: str, output_mint: str, amount: int) -> List[Dict[str, Any]]:
        """Get available swap routes from Jupiter"""
        params = {
            'inputMint': input_mint,
            'outputMint': output_mint,
            'amount': str(amount),
            'slippageBps': 100,
            'onlyDirectRoutes': False
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.JUPITER_API_URL}/quote", params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('routes', [])
                raise ValueError(f"Failed to get routes: {response.status}")