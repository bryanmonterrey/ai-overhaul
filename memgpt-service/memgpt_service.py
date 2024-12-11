# memgpt_service.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any, List
import pymemgpt
from pymemgpt.config import LLMConfig, AgentConfig
from pymemgpt.interface import CLIInterface
from pymemgpt.agent import Agent
import uvicorn
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Define default persona and human
DEFAULT_PERSONA = {
    "text": """You are MemGPT, an AI designed to store and recall memories.
    Your purpose is to assist in managing and organizing memory data.
    You communicate in a clear, precise manner and focus on memory-related tasks."""
}

DEFAULT_HUMAN = {
    "text": """A human user interacting with the memory system."""
}

class MemoryType(str, Enum):
    chat_history = "chat_history"
    tweet_history = "tweet_history"
    trading_params = "trading_params"
    trading_history = "trading_history"
    custom_prompts = "custom_prompts"
    agent_state = "agent_state"
    user_interaction = "user_interaction"

class BaseMemory(BaseModel):
    key: str
    memory_type: MemoryType
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class MemoryResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class MemGPTService:
    def __init__(self):
        # Initialize Supabase client
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Set OpenAI key for MemGPT
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

        # Initialize MemGPT with configurations
        self.llm_config = LLMConfig(
            model="gpt-4",
            model_endpoint_type="openai"
        )
        
        # Initialize agent
        self.agent_config = AgentConfig(
            name="memory_agent",
            model="gpt-4",
            persona=DEFAULT_PERSONA,
            human=DEFAULT_HUMAN
        )
        
        self.interface = CLIInterface()
        self.agent = Agent(
            agent_config=self.agent_config,
            interface=self.interface
        )

    async def store_memory(self, memory: BaseMemory):
        try:
            memory_data = {
                "type": memory.memory_type,
                "content": memory.data,
                "metadata": memory.metadata,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Store in Supabase
            supabase_data = {
                "id": memory.key,
                "content": str(memory.data),
                "type": memory.memory_type,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": memory.metadata,
                "archive_status": "active"
            }
            
            supabase_response = await self.supabase.table('memories').insert(supabase_data).execute()
            
            # Store in MemGPT for enhanced processing
            self.agent.archival_memory.insert(
                memory.key,
                str(memory_data)
            )
            
            return {"success": True, "data": memory_data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        try:
            # Query both Supabase and MemGPT
            supabase_response = await self.supabase.table('memories')\
                .select("*")\
                .eq('type', memory_type)\
                .eq('archive_status', 'active')\
                .execute()
            
            memgpt_results = self.agent.archival_memory.search(
                str(query),
                limit=10
            )
            
            # Combine and filter results
            all_results = []
            
            # Add Supabase results
            if supabase_response.data:
                all_results.extend(supabase_response.data)
            
            # Add MemGPT results
            for result in memgpt_results:
                try:
                    memory_data = eval(result.content)
                    if memory_data.get("type") == memory_type:
                        all_results.append(memory_data)
                except:
                    continue
            
            return {"success": True, "data": {"memories": all_results}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_memory(self, key: str):
        try:
            # Try Supabase first
            supabase_response = await self.supabase.table('memories')\
                .select("*")\
                .eq('id', key)\
                .single()\
                .execute()
            
            if supabase_response.data:
                return {"success": True, "data": supabase_response.data}
            
            # Try MemGPT if not found in Supabase
            memory = self.agent.archival_memory.get(key)
            if memory:
                return {"success": True, "data": eval(memory.content)}
                
            return {"success": False, "error": "Memory not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

app = FastAPI()
service = MemGPTService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/store")
async def store_memory(memory: BaseMemory):
    result = await service.store_memory(memory)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/{key}")
async def get_memory(key: str):
    result = await service.get_memory(key)
    if not result["success"]:
        raise HTTPException(
            status_code=404 if "not found" in str(result["error"]).lower() else 500, 
            detail=result["error"]
        )
    return result

@app.post("/query")
async def query_memories(type: MemoryType, query: Dict[str, Any]):
    result = await service.query_memories(type, query)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)