# memgpt-service/letta_service.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any, List
from letta.config import LLMConfig  # Keep these original imports
from letta.interface import CLIInterface
from letta.agent import Agent  # Fix this import
from memory_processor import MemoryProcessor  # Keep your original memory processor
import uvicorn
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncio
from letta.memory import Memory


load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

DEFAULT_PERSONA = {
    "text": """You are a highly capable AI memory system focused on organizing and processing memories.
    You excel at pattern recognition, emotional analysis, and contextual understanding.
    Your goal is to help maintain and enhance the personality system's memory capabilities."""
}

DEFAULT_HUMAN = {
    "text": """A user interacting with the memory and personality system."""
}

class MemoryType(str, Enum):
    chat_history = "chat_history"
    tweet_history = "tweet_history"
    trading_params = "trading_params"
    trading_history = "trading_history"
    custom_prompts = "custom_prompts"
    agent_state = "agent_state"
    user_interaction = "user_interaction"
    memory_chain = "memory_chain"
    memory_cluster = "memory_cluster"

class ContentRequest(BaseModel):
    content: str

class QueryRequest(BaseModel):
    type: str = Field(..., description="Type of query (e.g. 'analysis')")
    query: str = Field(..., description="Query content")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional context")

class BaseMemory(BaseModel):
    key: str
    memory_type: MemoryType
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class MemoryResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ChainConfig(BaseModel):
    depth: int = 2
    min_similarity: float = 0.5

class ClusterConfig(BaseModel):
    time_period: str = 'week'
    min_cluster_size: int = 3
    similarity_threshold: float = 0.7

class ContextConfig(BaseModel):
    max_tokens: int = 4000
    priority_keywords: List[str] = []

class AgentState:
    def __init__(self, persona, human, messages, memory):
        self.persona = persona
        self.human = human
        self.messages = messages
        self.message_ids = []
        self.memory = memory
        self.tools = []
        self.tool_rules = []
        self.llm_config = None

class MemGPTService:
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Missing Supabase credentials in environment variables")
        if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
            raise ValueError("Either OPENAI_API_KEY or ANTHROPIC_API_KEY must be provided")

        try:
            # Initialize Supabase
            self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            
            # Create LLM config with all necessary settings
            llm_config = LLMConfig(
                model="anthropic/claude-2" if ANTHROPIC_API_KEY else "gpt-4",
                model_endpoint_type="anthropic" if ANTHROPIC_API_KEY else "openai",
                context_window=100000 if ANTHROPIC_API_KEY else 8192,
                model_endpoint=f"https://api.{'anthropic' if ANTHROPIC_API_KEY else 'openai'}.com/v1",
                embedding_endpoint_type="openai",
                embedding_endpoint="https://api.openai.com/v1",
                embedding_model="text-embedding-ada-002"
            )
            
            # Create interface
            self.interface = CLIInterface()
            
            # Create memory instance
            memory = Memory(blocks=[])
            
            # Create agent state
            agent_state = AgentState(
                persona=DEFAULT_PERSONA,
                human=DEFAULT_HUMAN,
                messages=[],
                memory=memory
            )
            agent_state.llm_config = llm_config
            
            user = {
                "id": "default_user",
                "name": "User",
                "preferences": {}
            }
            
            # Initialize Letta agent
            self.agent = Agent(
                agent_state=agent_state,
                user=user,
                interface=self.interface
            )
            
            # Initialize memory processor
            self.memory_processor = MemoryProcessor(self.agent)
            
        except Exception as e:
            raise RuntimeError(f"Failed to initialize MemGPTService: {str(e)}")

    async def process_memory_content(self, content: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process and analyze content with optional context"""
        try:
            if not content or not isinstance(content, str):
                raise ValueError("Invalid content provided")

            # Use the agent to analyze the content
            analysis = await self.agent.analyze_content(content, context)
            
            if not analysis:
                raise ValueError("Analysis failed to produce results")

            return {
                'sentiment': analysis.get('sentiment', 0),
                'emotional_context': analysis.get('emotional_context', 'neutral'),
                'key_concepts': analysis.get('key_concepts', []),
                'patterns': analysis.get('patterns', []),
                'importance': analysis.get('importance', 0.5),
                'associations': analysis.get('associations', []),
                'summary': analysis.get('summary', '')
            }
        except Exception as e:
            print(f"Error processing content: {str(e)}")
            raise ValueError(f"Content analysis failed: {str(e)}")

    async def store_memory(self, memory: BaseMemory):
        try:
            # Process content for analysis
            content = str(memory.data.get('content', memory.data))
            memory_analysis = await self.process_memory_content(content)
            
            # Prepare data for Supabase
            supabase_data = {
                "key": memory.key,
                "type": memory.memory_type,
                "content": content,
                "metadata": memory.metadata or {},
                "emotional_context": memory_analysis.get('emotional_context', 'neutral'),
                "importance": memory_analysis.get('importance_score', 0.5),
                "associations": memory_analysis.get('associations', []),
                "platform": memory.metadata.get('platform', 'default'),
                "archive_status": "active"
            }

            # Store in Supabase
            response = await self.supabase.table('memories').insert(supabase_data).execute()
            
            if hasattr(response, 'error') and response.error:
                raise Exception(response.error.message)
            
            return {
                "success": True,
                "data": response.data[0] if response.data else supabase_data
            }
        except Exception as e:
            print(f"Error storing memory: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # Memory Chaining feature
    async def chain_memories(self, memory_key: str, config: ChainConfig):
        try:
            # Get initial memory
            initial_memory = await self.get_memory(memory_key)
            if not initial_memory["success"]:
                return {"success": False, "error": "Initial memory not found"}

            # Find related memories through semantic search
            related_memories = await self.agent.memory.search(
                query=initial_memory["data"]["content"],
                limit=config.depth * 5
            )

            # Build memory chain
            memory_chain = [initial_memory["data"]]
            current_memory = initial_memory["data"]
            
            for _ in range(config.depth):
                next_memory = await self._find_most_related(current_memory, related_memories)
                if next_memory and next_memory not in memory_chain:
                    memory_chain.append(next_memory)
                    current_memory = next_memory

            return {"success": True, "data": {"chain": memory_chain}}
        except Exception as e:
            print(f"Error in memory chaining: {str(e)}")
            return {"success": False, "error": str(e)}

    # Memory Clustering feature
    async def cluster_memories(self, config: ClusterConfig):
        try:
            memories = await self.get_memories_by_timeframe(config.time_period)
            
            if not memories:
                return {"success": True, "data": {"clusters": []}}

            # Use memory processor for clustering
            clusters = await self.memory_processor.cluster_memories(
                memories,
                min_size=config.min_cluster_size,
                similarity_threshold=config.similarity_threshold
            )

            return {"success": True, "data": {"clusters": clusters}}
        except Exception as e:
            print(f"Error in memory clustering: {str(e)}")
            return {"success": False, "error": str(e)}

    async def track_memory_evolution(self, concept: str):
        """Track how a concept evolved over different time periods"""
        try:
            time_periods = ['day', 'week', 'month']
            evolution_data = {}
            
            for period in time_periods:
                memories = await self.get_memories_by_timeframe(period)
                if memories:
                    analysis = await self.memory_processor.analyze_concept_evolution(
                        concept,
                        memories
                    )
                    evolution_data[period] = analysis

            return {"success": True, "data": {"evolution": evolution_data}}
        except Exception as e:
            print(f"Error tracking memory evolution: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _find_most_related(self, source_memory: Dict, potential_memories: List[Dict]) -> Optional[Dict]:
        """Find the most semantically similar memory"""
        try:
            if not potential_memories:
                return None

            # Use memory processor for similarity analysis
            most_similar = await self.memory_processor.find_most_similar(
                source_memory,
                potential_memories
            )
            
            return most_similar
        except Exception as e:
            print(f"Error finding related memory: {str(e)}")
            return None

    async def get_memories_by_timeframe(self, timeframe: str) -> List[Dict]:
        """Get memories within specified timeframe"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - {
                'day': timedelta(days=1),
                'week': timedelta(weeks=1),
                'month': timedelta(days=30)
            }.get(timeframe, timedelta(days=1))

            response = await self.supabase.table('memories')\
                .select("*")\
                .gte('created_at', start_date.isoformat())\
                .lte('created_at', end_date.isoformat())\
                .execute()

            return response.data or []
        except Exception as e:
            print(f"Error getting memories by timeframe: {str(e)}")
            return []

    # Your existing methods...
    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        try:
            # Enhanced semantic search using both systems
            [supabase_results, semantic_results] = await asyncio.gather(
                self.supabase.table('memories')
                    .select("*")
                    .eq('type', memory_type)
                    .eq('archive_status', 'active')
                    .execute(),
                self.agent.memory.search(
                    query=query.get('content', ''),
                    limit=10,
                    filter_fn=lambda x: x.get('type') == memory_type
                )
            )
            
            # Combine and rank results
            all_results = await self.memory_processor.combine_and_rank_results(
                supabase_results.data or [],
                semantic_results,
                query
            )
            
            return {"success": True, "data": {"memories": all_results}}
        except Exception as e:
            print(f"Error querying memories: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_memory(self, key: str):
        try:
            [supabase_result, letta_result] = await asyncio.gather(
                self.supabase.table('memories')
                    .select("*")
                    .eq('id', key)
                    .single()
                    .execute(),
                self.agent.memory.get(key)
            )
            
            if supabase_result.data:
                if letta_result:
                    letta_data = eval(str(letta_result))
                    enhanced_data = {
                        **supabase_result.data,
                        'enhanced_analysis': letta_data.get('analysis', {})
                    }
                    return {"success": True, "data": enhanced_data}
                return {"success": True, "data": supabase_result.data}
            
            return {"success": False, "error": "Memory not found"}
        except Exception as e:
            print(f"Error getting memory: {str(e)}")
            return {"success": False, "error": str(e)}

    async def summarize_memories(self, timeframe: str = 'recent', limit: int = 5):
        """Generate a summary of recent memories"""
        try:
            memories = await self.get_memories_by_timeframe(timeframe)
            if not memories:
                return {"success": True, "data": {"summary": "No memories found for the specified timeframe."}}
                
            summary = await self.memory_processor.generate_summary(memories[:limit])
            return {"success": True, "data": {"summary": summary}}
        except Exception as e:
            print(f"Error summarizing memories: {str(e)}")
            return {"success": False, "error": str(e)}

# FastAPI setup
app = FastAPI()
service = MemGPTService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://terminal.goatse.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    content: str = Field(..., description="Content to analyze")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional context")

@app.post("/analyze")
async def analyze_content(request: AnalyzeRequest):
    try:
        if not request.content:
            raise HTTPException(status_code=400, detail="Content is required")

        # Process the content
        result = await app.state.memgpt_service.process_memory_content(
            content=request.content,
            context=request.context
        )

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        print(f"Error in analyze_content: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    
# Existing endpoints
@app.post("/store", response_model=MemoryResponse)
async def store_memory(memory: BaseMemory):
    result = await service.store_memory(memory)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/memories/{key}", response_model=MemoryResponse)
async def get_memory(key: str, type: Optional[MemoryType] = None):
    result = await service.get_memory(key)
    if not result["success"]:
        raise HTTPException(
            status_code=404 if "not found" in str(result["error"]).lower() else 500, 
            detail=result["error"]
        )
    return result

@app.post("/query")
async def query_content(request: QueryRequest):
    try:
        print(f"Received query request: {request}")  # Debug logging
        
        if not request.query:
            raise HTTPException(status_code=400, detail="Query is required")

        # Process based on query type
        if request.type == 'analysis':
            result = await app.state.memgpt_service.process_memory_content(
                content=request.query,
                context=request.context
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown query type: {request.type}")

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# New feature endpoints
@app.post("/memories/chain/{memory_key}")
async def chain_memories(memory_key: str, config: ChainConfig):
    result = await service.chain_memories(memory_key, config)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/memories/cluster")
async def cluster_memories(config: ClusterConfig):
    result = await service.cluster_memories(config)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/memories/evolution/{concept}")
async def track_memory_evolution(concept: str):
    result = await service.track_memory_evolution(concept)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/summary")
async def get_memory_summary(timeframe: str = 'recent', limit: int = 5):
    result = await service.summarize_memories(timeframe, limit)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

if __name__ == "__main__":
    try:
        print("Starting MemGPT Service...")
        uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")
    except Exception as e:
        print(f"Failed to start service: {str(e)}")