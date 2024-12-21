# memgpt-service/memory/trading_memory.py
from typing import Dict, Any, List
from datetime import datetime, timedelta

class TradingMemory:
    def __init__(self, memory_processor):
        self.memory = memory_processor
        
    async def store_interaction(
        self,
        content: str,
        response: Dict[str, Any],
        metadata: Dict[str, Any]
    ):
        """Store trading interaction in memory"""
        await self.memory.process_new_memory(
            content=content,
            metadata={
                **metadata,
                "type": "trading_interaction",
                "response": response
            }
        )
        
    async def get_relevant_context(
        self,
        message: str,
        user_type: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get relevant context for current interaction"""
        return await self.memory.query_memories(
            type="trading_interaction",
            query={
                "content": message,
                "user_type": user_type,
                "limit": limit
            }
        )
        
    async def analyze_trading_pattern(
        self,
        user_address: Optional[str] = None,
        timeframe: str = "24h"
    ) -> Dict[str, Any]:
        """Analyze trading patterns from memory"""
        query = {
            "type": "trading_interaction",
            "timeframe": timeframe
        }
        
        if user_address:
            query["user_address"] = user_address
            
        memories = await self.memory.query_memories(**query)
        
        return await self.memory.analyze_content({
            "memories": memories,
            "analysis_type": "trading_pattern"
        })