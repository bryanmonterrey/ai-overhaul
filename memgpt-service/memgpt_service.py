# memgpt_service.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any, List
import memgpt
from memgpt.memory import MemoryStore
import uvicorn
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

class MemGPTService:
    def __init__(self):
        self.store = MemoryStore()
        self.memgpt = memgpt.MemGPT()

    async def store_memory(self, memory: BaseMemory):
        try:
            # Store in MemGPT
            await self.memgpt.store(
                memory.key,
                memory.data,
                memory_type=memory.memory_type,
                metadata=memory.metadata
            )
            return {"success": True, "data": memory.dict()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        try:
            memories = await self.memgpt.query(
                memory_type=memory_type,
                query=query
            )
            return {"success": True, "data": {"memories": memories}}
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
async def get_memory(key: str, type: MemoryType):
    try:
        memory = await service.memgpt.get(key)
        if not memory:
            return MemoryResponse(success=False, error="Memory not found")
        return MemoryResponse(success=True, data=memory)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query_memories(type: MemoryType, query: Dict[str, Any]):
    result = await service.query_memories(type, query)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)