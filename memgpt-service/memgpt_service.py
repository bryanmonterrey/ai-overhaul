# memgpt_service.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import memgpt
import uvicorn
from typing import Optional, Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MemoryRequest(BaseModel):
    key: str
    data: Optional[Dict[str, Any]] = None
    context: Optional[str] = None

class MemoryResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@app.post("/memory/store")
async def store_memory(request: MemoryRequest):
    try:
        # Initialize MemGPT client and store memory
        # This is a placeholder for the actual MemGPT implementation
        return MemoryResponse(success=True, data={"key": request.key})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/{key}")
async def get_memory(key: str):
    try:
        # Retrieve memory using MemGPT
        # This is a placeholder for the actual MemGPT implementation
        return MemoryResponse(success=True, data={"key": key, "value": "memory_data"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)