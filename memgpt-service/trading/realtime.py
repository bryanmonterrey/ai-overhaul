# memgpt-service/trading/realtime.py
from datetime import datetime
from typing import Dict, Any

async def broadcast_trading_update(
    update_type: str,
    data: Dict[str, Any],
    channel: str
):
    """Broadcast trading updates to WebSocket clients"""
    await supabase.channel(channel).send({
        "type": "broadcast",
        "event": "trading_update",
        "payload": {
            "type": update_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
    })