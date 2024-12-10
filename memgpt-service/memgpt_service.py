# memgpt_service.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any, List
import memgpt
import uvicorn
from memgpt.memory import MemoryStore
from datetime import datetime

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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for development/testing
memory_store = {}

@app.post("/store")
async def store_memory(memory: BaseMemory):
    try:
        # Store in memory_store with timestamp
        memory_store[memory.key] = {
            **memory.dict(),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Initialize MemGPT client and store memory
        # This is where you'd implement MemGPT-specific storage
        
        return MemoryResponse(success=True, data=memory.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/{key}")
async def get_memory(key: str, type: MemoryType):
    try:
        if key not in memory_store:
            return MemoryResponse(success=False, error="Memory not found")
            
        memory = memory_store[key]
        if memory["memory_type"] != type:
            return MemoryResponse(success=False, error="Memory type mismatch")
            
        return MemoryResponse(success=True, data=memory)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query_memories(type: MemoryType, query: Dict[str, Any]):
    try:
        # Filter memories by type and query parameters
        matching_memories = [
            memory for memory in memory_store.values()
            if memory["memory_type"] == type and all(
                query_val == memory.get(query_key)
                for query_key, query_val in query.items()
            )
        ]
        
        return MemoryResponse(success=True, data={"memories": matching_memories})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)