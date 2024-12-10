from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any, List
import memgpt
from memgpt.config import LLMConfig, AgentConfig
from memgpt.interface import CLIInterface  # Changed to CLIInterface
from memgpt.agent import Agent
import uvicorn
from datetime import datetime
import os

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
        # Initialize configurations
        self.llm_config = LLMConfig()
        self.agent_config = AgentConfig(
            name="memory_agent",
            model=self.llm_config.model,
            model_endpoint_type=self.llm_config.model_endpoint_type,
            context_window=self.llm_config.context_window
        )
        
        # Initialize agent with CLI interface
        self.interface = CLIInterface()
        self.agent = Agent(
            agent_config=self.agent_config,
            interface=self.interface,
            model_endpoint_type=self.llm_config.model_endpoint_type,
            model=self.llm_config.model
        )

    async def store_memory(self, memory: BaseMemory):
        try:
            memory_data = {
                "type": memory.memory_type,
                "content": memory.data,
                "metadata": memory.metadata,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            self.agent.archival_memory.insert(
                memory.key,
                str(memory_data)
            )
            
            return {"success": True, "data": memory_data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        try:
            results = self.agent.archival_memory.search(
                str(query),
                limit=10
            )
            
            filtered_results = []
            for result in results:
                try:
                    memory_data = eval(result.content)
                    if memory_data.get("type") == memory_type:
                        filtered_results.append(memory_data)
                except:
                    continue
            
            return {"success": True, "data": {"memories": filtered_results}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_memory(self, key: str):
        try:
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
        raise HTTPException(status_code=404 if "not found" in str(result["error"]).lower() else 500, 
                          detail=result["error"])
    return result

@app.post("/query")
async def query_memories(type: MemoryType, query: Dict[str, Any]):
    result = await service.query_memories(type, query)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

if __name__ == "__main__":
    # Initialize NLTK data if needed
    import nltk
    try:
        nltk.download('punkt', quiet=True)
    except:
        print("Warning: NLTK download failed, but service may still work")
    
    uvicorn.run(app, host="0.0.0.0", port=3001)