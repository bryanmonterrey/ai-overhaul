# letta/agent.py

from typing import Dict, Any, Optional, List
from memory_processor import MemoryProcessor

class Agent:
    def __init__(self, agent_state, user, interface):
        self.agent_state = agent_state
        self.user = user
        self.interface = interface
        self.memory = agent_state.memory  # This fixes the 'memory' attribute error
        self.memory_processor = None

    async def analyze_content(self, content: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Analyze content and return insights"""
        try:
            if not content:
                raise ValueError("Content cannot be empty")
                
            # If we have a memory processor, use it
            if self.memory_processor:
                result = await self.memory_processor.analyze_content(content)
                if result:
                    return result

            # Fallback basic analysis
            return {
                'sentiment': 0,
                'emotional_context': 'neutral',
                'key_concepts': [],
                'patterns': [],
                'importance': 0.5,
                'associations': [],
                'summary': content[:100] + '...' if len(content) > 100 else content
            }
        except Exception as e:
            print(f"Error in Agent.analyze_content: {str(e)}")
            return {
                'sentiment': 0,
                'emotional_context': 'neutral',
                'key_concepts': [],
                'patterns': [],
                'importance': 0.5,
                'associations': [],
                'summary': ''
            }

    async def search(self, query: str, limit: int = 10, filter_fn=None):
        """Search through memories"""
        try:
            if hasattr(self.memory, 'search'):
                return await self.memory.search(query, limit, filter_fn)
            return []
        except Exception as e:
            print(f"Error in Agent.search: {str(e)}")
            return []

    async def get(self, key: str):
        """Get a specific memory by key"""
        try:
            if hasattr(self.memory, 'get'):
                return await self.memory.get(key)
            return None
        except Exception as e:
            print(f"Error in Agent.get: {str(e)}")
            return None