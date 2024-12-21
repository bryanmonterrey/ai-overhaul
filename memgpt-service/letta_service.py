# memgpt-service/letta_service.py
import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, validator
from enum import Enum
from typing import Optional, Dict, Any, List, Union
from config import LLMConfig  
from interface import CLIInterface
from agent import Agent  
from memory_processor import MemoryProcessor  
import uvicorn
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncio
from memory_base import Memory
import uuid
from dspy_modules.service import DSPyService
from pathlib import Path



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
    query: Union[str, Dict[str, Any]] = Field(..., description="Query content or parameters")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional context")

    @validator('query')
    def validate_query(cls, v):
        if isinstance(v, dict):
            return json.dumps(v)
        return v

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

class ConsciousnessState:
    def __init__(
        self,
        currentThought: str = '',
        shortTermMemory: list = None,
        longTermMemory: list = None,
        emotionalState: str = 'neutral',
        attentionFocus: list = None,
        activeContexts: set = None
    ):
        self.currentThought = currentThought
        self.shortTermMemory = shortTermMemory or []
        self.longTermMemory = longTermMemory or []
        self.emotionalState = emotionalState
        self.attentionFocus = attentionFocus or []
        self.activeContexts = activeContexts or set()

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
        # Add these new attributes
        self.tweetStyle = 'shitpost'  # Default style
        self.consciousness = ConsciousnessState(
            currentThought='',
            shortTermMemory=[],
            longTermMemory=[],
            emotionalState='neutral',
            attentionFocus=[],
            activeContexts=set()
        )

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
            self.agent.service = self
            
            # Initialize memory processor
            self.memory_processor = MemoryProcessor(self.agent)

            # Initialize DSPy service
            prompt_dir = Path('../app/core/prompts')  # Points to your Next.js prompts
            self.dspy_service = DSPyService(
                prompt_dir=prompt_dir,
                model_config={
                    'model': "anthropic/claude-2" if ANTHROPIC_API_KEY else "gpt-4",
                    'llm_config': llm_config,
                    'api_key': ANTHROPIC_API_KEY if ANTHROPIC_API_KEY else OPENAI_API_KEY
                }
            )

            self.trading_chat = TradingChat(
            self,
            self.memory_processor,
            self.dspy_service
            )
            self.trading_memory = TradingMemory(
                self.memory_processor
            )

            
            
        except Exception as e:
            raise RuntimeError(f"Failed to initialize MemGPTService: {str(e)}")
        
    async def _memory_maintenance_loop(self):
        """Background task for periodic memory maintenance"""
        while True:
            try:
                await self.memory_processor.maintain_memory_system()
                await asyncio.sleep(3600)  # Run every hour
            except Exception as e:
                print(f"Error in memory maintenance loop: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying

    async def process_memory_content(self, content: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process and analyze content with optional context"""
        try:
            if not content or not isinstance(content, str):
                raise ValueError("Invalid content provided")

            # Use the agent to analyze the content
            agent_analysis = await self.agent.analyze_content(content, context)
            dspy_analysis = await self.dspy_service.generate_response(
                input_text=content,
                emotional_state=agent_analysis.get('emotional_context', 'neutral'),
                style=self.agent.agent_state.tweetStyle,
                context=context
            )
            
            if not agent_analysis:
                raise ValueError("Analysis failed to produce results")

            return {
                'sentiment': agent_analysis.get('sentiment', 0),
                'emotional_context': agent_analysis.get('emotional_context', 'neutral'),
                'key_concepts': agent_analysis.get('key_concepts', []),
                'patterns': agent_analysis.get('patterns', []),
                'importance': agent_analysis.get('importance', 0.5),
                'associations': agent_analysis.get('associations', []),
                'summary': agent_analysis.get('summary', ''),
                'dspy_analysis': dspy_analysis.get('data', {})
            }
        except Exception as e:
            print(f"Error processing content: {str(e)}")
            raise ValueError(f"Content analysis failed: {str(e)}")

    async def store_memory(self, memory: BaseMemory):
        """Store memory with enhanced logging."""
        try:
            print(f"Storing memory with key: {memory.key}")
            print(f"Memory type: {memory.memory_type}")
            print(f"Memory metadata: {json.dumps(memory.metadata, indent=2)}")
            
            content = str(memory.data.get('content', memory.data))
            memory_analysis = await self.process_memory_content(content)
            
            # Prepare data for Supabase
            memory_id = str(uuid.uuid4())
            supabase_data = {
                "id": memory_id,
                "key": memory_id,
                "type": memory.memory_type,
                "content": content,
                "metadata": {
                    **memory.metadata,
                    "original_key": memory.key  # Store original key in metadata
                },
                "emotional_context": memory_analysis.get('emotional_context', 'neutral'),
                "importance": memory_analysis.get('importance_score', 0.5),
                "associations": memory_analysis.get('associations', []),
                "platform": memory.metadata.get('platform', 'default'),
                "archive_status": "active"
            }

            print(f"Prepared Supabase data: {json.dumps(supabase_data, indent=2)}")
            
            result = self.supabase.table('memories').insert(supabase_data).execute()
            print(f"Supabase insert result: {json.dumps(result.data if hasattr(result, 'data') else {}, indent=2)}")
            
            if hasattr(result, 'data'):
                inserted_data = result.data[0] if isinstance(result.data, list) and result.data else result.data
            else:
                inserted_data = supabase_data

            return {
                "success": True,
                "data": inserted_data
            }

        except Exception as e:
            print(f"Error storing memory: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def chain_memories(self, memory_key: str, config: ChainConfig):
        """Chain memories with support for tweet-based relationships and DSPy enhancement."""
        try:
            # Validate and sanitize config
            depth = min(max(1, config.depth), 5)
            min_similarity = min(max(0.1, config.min_similarity), 1.0)

            # Get initial memory with expanded search
            initial_memory = await self.get_memory(memory_key)
            if not initial_memory["success"]:
                return {"success": False, "error": "Initial memory not found"}

            # Extract content safely
            memory_data = initial_memory["data"]
            content = memory_data.get("content", "")
            if isinstance(content, dict) and 'messages' in content:
                content = content['messages'][0].get('content', "") if content['messages'] else ""

            # Start building the chain
            memory_chain = [memory_data]
            seen_ids = {memory_data['id']}

            try:
                # First, check for direct replies using metadata
                reply_query = self.supabase.table('memories')\
                    .select("*")\
                    .eq('type', memory_data['type'])\
                    .eq('archive_status', 'active')\
                    .execute()

                replies = [m for m in reply_query.data 
                          if m.get('metadata', {}).get('reply_to') == memory_key 
                          and m['id'] not in seen_ids]

                # Add replies to chain
                for reply in replies[:depth-1]:
                    if reply['id'] not in seen_ids:
                        memory_chain.append(reply)
                        seen_ids.add(reply['id'])

                # If we still need more memories, use both systems for search
                if len(memory_chain) < depth:
                    # Original semantic search
                    agent_results = await self.agent.memory.search(
                        query=content,
                        limit=(depth - len(memory_chain)) * 2
                    )
                    
                    # DSPy semantic search (run in parallel)
                    dspy_results = await self.dspy_service.find_related(
                        source_content=content,
                        limit=(depth - len(memory_chain)) * 2,
                        context={
                            'emotional_state': self.agent.agent_state.consciousness.emotionalState,
                            'style': self.agent.agent_state.tweetStyle
                        }
                    )
                    
                    # Process agent search results
                    agent_memories = []
                    if agent_results:
                        agent_memories = (
                            agent_results.data if hasattr(agent_results, 'data')
                            else agent_results if isinstance(agent_results, list)
                            else []
                        )

                    # Process DSPy search results
                    dspy_memories = dspy_results.get('data', {}).get('memories', []) if dspy_results.get('success') else []

                    # Combine and deduplicate results
                    all_memories = []
                    for memory in agent_memories + dspy_memories:
                        if memory.get('id') and memory['id'] not in seen_ids:
                            all_memories.append(memory)
                            seen_ids.add(memory['id'])
                            if len(memory_chain) >= depth:
                                break
                    
                    # Sort combined results by relevance score if available
                    sorted_memories = sorted(
                        all_memories,
                        key=lambda x: (
                            x.get('relevance_score', 0) +  # Agent score
                            x.get('dspy_score', 0)         # DSPy score
                        ),
                        reverse=True
                    )

                    # Add top memories to chain
                    memory_chain.extend(sorted_memories[:depth - len(memory_chain)])

                return {
                    "success": True,
                    "data": {
                        "chain": memory_chain,
                        "total": len(memory_chain),
                        "dspy_insights": dspy_results.get('data', {}).get('insights', []) if 'dspy_results' in locals() else []
                    }
                }

            except Exception as search_error:
                print(f"Error in memory search: {str(search_error)}")
                return {
                    "success": True,
                    "data": {
                        "chain": memory_chain,
                        "error": "Failed to find additional related memories"
                    }
                }

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
        
    async def analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content for patterns and context"""
        try:
            # Use both systems for better analysis
            memory_result = await self.memory_processor.analyze_content(content)
            dspy_result = await self.dspy_service.analyze_content(
                content=content,
                emotional_state=self.agent.state.consciousness.emotionalState,
                style=self.agent.state.tweetStyle
            )

            return {
                "success": True,
                "data": {
                    **memory_result,  # Original analysis
                    "dspy_patterns": dspy_result.get('patterns', []),
                    "dspy_insights": dspy_result.get('insights', []),
                    "combined_score": (
                        memory_result.get('importance', 0) + 
                        dspy_result.get('importance', 0)
                    ) / 2
                }
            }
        except Exception as e:
            print(f"Error in analyze_content: {str(e)}")
            return {
                "success": False,
                "error": f"Content analysis failed: {str(e)}"
            }

    async def _find_most_related(self, source_memory: Dict, potential_memories: List[Dict]) -> Optional[Dict]:
        """Find the most semantically similar memory using both systems"""
        try:
            if not potential_memories or not source_memory:
                return None

            # Get source content
            source_content = self._extract_content(source_memory)
            if not source_content:
                return None

            # Process potential memories
            valid_memories = self._process_memories(potential_memories)
            if not valid_memories:
                return None

            # Use both systems to find related memories
            memory_similar = await self.memory_processor.find_most_similar(
                {"content": source_content},
                [{"content": m['_processed_content']} for m in valid_memories]
            )

            dspy_similar = await self.dspy_service.find_related(
                source_content=source_content,
                candidates=[m['_processed_content'] for m in valid_memories],
                context={
                    'emotional_state': self.agent.state.consciousness.emotionalState,
                    'style': self.agent.state.tweetStyle
                }
            )

            # Combine results
            memory_score = memory_similar.get('score', 0) if memory_similar else 0
            dspy_score = dspy_similar.get('score', 0) if dspy_similar else 0

            # Use the result with higher confidence
            best_match = memory_similar if memory_score > dspy_score else dspy_similar
            if best_match:
                for memory in valid_memories:
                    if memory['_processed_content'] == best_match.get('content'):
                        memory.pop('_processed_content', None)
                        return memory

            return None
        except Exception as e:
            print(f"Error finding related memory: {str(e)}")
            return None
        
    async def _process_memories(self, memories: List[Dict]) -> List[Dict]:
        """Process and prepare memories for comparison"""
        try:
            processed = []
            for memory in memories:
                content = self._extract_content(memory)
                if content:
                    memory_copy = memory.copy()
                    memory_copy['_processed_content'] = content
                    processed.append(memory_copy)
            return processed
        except Exception as e:
            print(f"Error processing memories: {str(e)}")
            return []

    def _extract_content(self, memory: Dict) -> Optional[str]:
        """Helper to extract content safely"""
        try:
            content = memory.get("content", "")
            if isinstance(content, dict):
                content = (
                    content.get("messages", [])[0].get("content", "")
                    if "messages" in content
                    else str(content)
                )
            return str(content) if content else None
        except (AttributeError, IndexError) as e:
            print(f"Error extracting content: {e}")
            return None

    async def get_memories_by_timeframe(self, timeframe: str) -> List[Dict]:
        """Get memories within specified timeframe"""
        try:
            # Use UTC.now() instead of deprecated utcnow()
            end_date = datetime.now(timezone.utc)
            start_date = end_date - {
                'day': timedelta(days=1),
                'week': timedelta(weeks=1),
                'month': timedelta(days=30)
            }.get(timeframe, timedelta(days=1))

            # Remove await, add execute() directly
            response = self.supabase.table('memories')\
                .select("*")\
                .gte('created_at', start_date.isoformat())\
                .lte('created_at', end_date.isoformat())\
                .execute()

            # Properly handle response
            if hasattr(response, 'data'):
                return response.data or []
            return []
        except Exception as e:
            print(f"Error getting memories by timeframe: {str(e)}")
            return []

    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        """Query memories with proper metadata handling and async search."""
        try:
            # Modified Supabase query without await
            query_result = self.supabase.table('memories')\
                .select("*")\
                .eq('type', memory_type)\
                .eq('archive_status', 'active')\
                .execute()
            
            # Handle the response data
            db_results = []
            if hasattr(query_result, 'data'):
                db_results = query_result.data

            # Modified semantic search with proper await
            semantic_results = []
            if query.get('content'):
                try:
                    search_result = await self.agent.memory.search(
                        query=query.get('content', ''),
                        limit=10,
                        filter_fn=lambda x: x.get('type') == memory_type
                    )
                    
                    if isinstance(search_result, list):
                        semantic_results = search_result
                    elif hasattr(search_result, 'data'):
                        semantic_results = search_result.data
                except Exception as search_error:
                    print(f"Search error: {str(search_error)}")
                    semantic_results = []

            # Combine and rank results
            all_results = await self.memory_processor.combine_and_rank_results(
                db_results,
                semantic_results,
                query
            )

            return {
                "success": True, 
                "data": {
                    "memories": all_results
                }
            }

        except Exception as e:
            print(f"Error querying memories: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def get_memory(self, key: str, type: Optional[MemoryType] = None):
        """Get memory with properly formatted JSONB querying."""
        try:
            # Build base query
            base_query = self.supabase.table('memories')
            
            # Try direct ID match first
            response = base_query.select("*").eq('id', key).execute()
            data_list = response.data if hasattr(response, 'data') else []
            memory_data = data_list[0] if data_list else None

            if not memory_data:
                # Try to find by tweet_id in metadata using containment operator
                metadata_query = base_query.select("*")\
                    .eq('type', 'tweet_history')\
                    .contains('metadata', {'tweet_id': key})\
                    .execute()
                
                data_list = metadata_query.data if hasattr(metadata_query, 'data') else []
                memory_data = data_list[0] if data_list else None

            if not memory_data:
                # Try to find by reply_to in metadata using containment
                reply_query = base_query.select("*")\
                    .contains('metadata', {'reply_to': key})\
                    .execute()
                
                data_list = reply_query.data if hasattr(reply_query, 'data') else []
                memory_data = data_list[0] if data_list else None

            if memory_data:
                # Process content if it's a JSON string
                try:
                    if isinstance(memory_data.get('content'), str):
                        if memory_data['content'].startswith('{'):
                            memory_data['content'] = json.loads(memory_data['content'])
                except json.JSONDecodeError:
                    pass  # Keep original content if parse fails
                
                return {"success": True, "data": memory_data}
                
            return {
                "success": False, 
                "error": "Memory not found",
                "debug_info": {
                    "key": key,
                    "type": type,
                    "search_attempts": [
                        "direct_id",
                        "metadata_tweet_id",
                        "metadata_reply_to"
                    ]
                }
            }

        except Exception as e:
            print(f"Error getting memory: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def summarize_memories(self, timeframe: str = 'recent', limit: int = 5):
        """Generate a summary of recent memories"""
        try:
            memories = await self.get_memories_by_timeframe(timeframe)
            if not memories:
                return {"success": True, "data": {"summary": "No memories found for the specified timeframe."}}

            # Get both summaries
            memory_summary = await self.memory_processor.generate_summary(memories[:limit])
            dspy_summary = await self.dspy_service.generate_summary(
                memories=memories[:limit],
                style=self.agent.agent_state.tweetStyle,
                emotional_state=self.agent.agent_state.consciousness.emotionalState
            )

            return {
                "success": True, 
                "data": {
                    "memory_summary": memory_summary,
                    "dspy_summary": dspy_summary.get('summary', ''),
                    "key_points": dspy_summary.get('key_points', []),
                    "trends": dspy_summary.get('trends', [])
                }
            }
        except Exception as e:
            print(f"Error summarizing memories: {str(e)}")
            return {"success": False, "error": str(e)}

    async def handle_ai_trading(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AI trading operations"""
        try:
            command_type = command.get('type')
            if command_type == 'execute_trade':
                return await self._execute_ai_trade(command)
            elif command_type == 'update_strategy':
                return await self._update_ai_strategy(command)
            elif command_type == 'get_status':
                return await self._get_ai_trading_status()
            else:
                raise ValueError(f"Unknown command type: {command_type}")
        except Exception as e:
            logging.error(f"AI trading error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def handle_holder_trading(
        self,
        user_address: str,
        command: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle holder trading operations"""
        try:
            # Verify holder status
            is_holder = await self._verify_token_holder(user_address)
            if not is_holder:
                return {
                    "success": False,
                    "error": "Not a token holder"
                }

            command_type = command.get('type')
            if command_type == 'update_settings':
                return await self._update_holder_settings(user_address, command)
            elif command_type == 'get_portfolio':
                return await self._get_holder_portfolio(user_address)
            elif command_type == 'toggle_trading':
                return await self._toggle_holder_trading(user_address, command)
            else:
                raise ValueError(f"Unknown command type: {command_type}")
        except Exception as e:
            logging.error(f"Holder trading error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

# FastAPI setup
app = FastAPI()
service = MemGPTService()
app.state.memgpt_service = service 

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

@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_content(request: AnalyzeRequest):
    try:
        if not request.content:
            raise HTTPException(status_code=400, detail="Content is required")

        # Process the content
        result = await service.process_memory_content(
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

@app.post("/query")
async def query_content(request: QueryRequest):
    try:
        print(f"Received query request: {request}")  
        
        if not request.query:
            raise HTTPException(status_code=400, detail="Query is required")


        if request.type == 'analysis':
            result = await service.process_memory_content(
                content=request.query,
                context=request.context
            )
            return {"success": True, "data": result}
        else:
            # Properly await the memory query
            result = await service.query_memories(
                memory_type=request.type,
                query={"content": request.query, "context": request.context}
            )
            return result
            
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# Existing endpoints
@app.post("/store", response_model=MemoryResponse)
async def store_memory(memory: BaseMemory):
    result = await service.store_memory(memory)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/memories/{key}", response_model=MemoryResponse)  # This one should be added
async def get_memory(key: str, type: Optional[MemoryType] = None):
    result = await service.get_memory(key)
    if not result["success"]:
        raise HTTPException(
            status_code=404 if "not found" in str(result["error"]).lower() else 500, 
            detail=result["error"]
        )
    return result



# New feature endpoints
@app.post("/memories/chain/{memory_key}")
async def chain_memories(memory_key: str, config: ChainConfig):
    """Chain memories endpoint with better error handling."""
    try:
        # Validate UUID format
        try:
            uuid_obj = uuid.UUID(memory_key)
            key = str(uuid_obj)
        except ValueError:
            if not memory_key:
                raise HTTPException(status_code=400, detail="Memory key is required")
            key = memory_key  # Allow non-UUID keys for metadata lookup
            
        result = await service.get_memory(key)
        if not result["success"]:
            return {
                "success": True,
                "data": {
                    "chain": [],
                    "error": "Initial memory not found"
                }
            }
            
        # If we found the memory, proceed with chaining
        chain_result = await service.chain_memories(key, config)
        if not chain_result["success"]:
            return {
                "success": True,
                "data": {
                    "chain": [result["data"]],  # Return at least the initial memory
                    "error": chain_result["error"]
                }
            }
            
        return chain_result
        
    except Exception as e:
        print(f"Chain memories error: {str(e)}")
        return {
            "success": True,
            "data": {
                "chain": [],
                "error": str(e)
            }
        }
    
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
        
        async def start_service():
            # Create service with maintenance loop
            service = MemGPTService()
            
            # Run FastAPI with uvicorn
            config = uvicorn.Config(
                app,
                host="0.0.0.0",
                port=3001,
                log_level="info"
            )
            server = uvicorn.Server(config)
            await server.serve()
        
        # Run everything in the event loop
        asyncio.run(start_service())
        
    except Exception as e:
        print(f"Failed to start service: {str(e)}")