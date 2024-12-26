# memgpt-service/trading/services/solana_bridge.py
from typing import Dict, Any, Optional
import aiohttp
import json

class SolanaBridge:
    """Bridge service to communicate with Solana Agent Kit frontend"""
    
    def __init__(self, config: Dict[str, Any]):
        self.api_url = config.get("solana_api_url", "http://localhost:3000/api/solana")
        
    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token data through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/token-data",
                json={"token_address": token_address}
            ) as response:
                return await response.json()
                
    async def fetch_pyth_price(self, token_address: str) -> Dict[str, Any]:
        """Get Pyth price through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/pyth-price",
                json={"token_address": token_address}
            ) as response:
                return await response.json()