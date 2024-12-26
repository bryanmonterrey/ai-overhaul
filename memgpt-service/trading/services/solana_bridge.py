# memgpt-service/trading/services/solana_bridge.py
from typing import Dict, Any, Optional
import aiohttp
import json
from functools import lru_cache
import os

class SolanaBridge:
    """Bridge service to communicate with Solana Agent Kit frontend"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.api_url = self.config.get("solana_api_url", 
            os.getenv("SOLANA_API_URL", "http://localhost:3000/api/solana"))
        
    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token data through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/token-data",
                json={
                    "token_address": token_address,
                }
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to get token data: {await response.text()}")
                return await response.json()
                
    async def fetch_pyth_price(self, token_address: str) -> Dict[str, Any]:
        """Get Pyth price through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/pyth-price",
                json={
                    "token_address": token_address,
                }
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to fetch Pyth price: {await response.text()}")
                return await response.json()

    async def execute_trade(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute trade through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/trade",
                json=params
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to execute trade: {await response.text()}")
                return await response.json()

    @lru_cache(maxsize=100)
    def get_cached_token_data(self, token_address: str) -> Dict[str, Any]:
        """Cached version of token data (useful for frequently accessed tokens)"""
        return self.get_token_data(token_address)