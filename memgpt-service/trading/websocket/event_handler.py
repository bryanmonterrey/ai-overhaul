# memgpt-service/trading/websocket/event_handler.py

from typing import Dict, Any, Optional, Set, List
import asyncio
import json
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass, asdict

@dataclass
class WSClient:
    """WebSocket client information"""
    id: str
    user_address: Optional[str]
    subscriptions: Set[str]
    last_heartbeat: datetime

class WebSocketEventHandler:
    def __init__(self):
        self.clients: Dict[str, WSClient] = {}
        self.channels: Dict[str, Set[str]] = {
            'monitoring': set(),
            'trades': set(),
            'alerts': set(),
            'admin': set(),
            'holder': set()
        }

    async def start(self):
        """Start the WebSocket handler and its cleanup task"""
        asyncio.create_task(self._cleanup_inactive_clients())

    async def register_client(
        self,
        client_id: str,
        user_address: Optional[str] = None
    ) -> WSClient:
        """Register a new WebSocket client"""
        client = WSClient(
            id=client_id,
            user_address=user_address,
            subscriptions=set(),
            last_heartbeat=datetime.now()
        )
        self.clients[client_id] = client
        return client

    async def unregister_client(self, client_id: str):
        """Unregister a WebSocket client"""
        if client_id in self.clients:
            # Remove from all channels
            for channel in self.channels.values():
                channel.discard(client_id)
            del self.clients[client_id]

    async def subscribe(self, client_id: str, channels: List[str]) -> bool:
        """Subscribe client to channels"""
        try:
            if client_id not in self.clients:
                return False

            client = self.clients[client_id]
            
            for channel in channels:
                if channel in self.channels:
                    self.channels[channel].add(client_id)
                    client.subscriptions.add(channel)

            return True
            
        except Exception as e:
            logging.error(f"Error in subscribe: {str(e)}")
            return False

    async def unsubscribe(self, client_id: str, channels: List[str]) -> bool:
        """Unsubscribe client from channels"""
        try:
            if client_id not in self.clients:
                return False

            client = self.clients[client_id]
            
            for channel in channels:
                if channel in self.channels:
                    self.channels[channel].discard(client_id)
                    client.subscriptions.discard(channel)

            return True
            
        except Exception as e:
            logging.error(f"Error in unsubscribe: {str(e)}")
            return False

    async def broadcast_update(
        self,
        channel: str,
        data: Dict[str, Any],
        user_address: Optional[str] = None
    ):
        """Broadcast update to subscribed clients"""
        try:
            message = {
                "type": "update",
                "channel": channel,
                "data": data,
                "timestamp": datetime.now().isoformat()
            }

            # If user_address is provided, send only to that user's clients
            if user_address:
                await self._send_to_user(user_address, message)
            else:
                await self._broadcast_to_channel(channel, message)

        except Exception as e:
            logging.error(f"Error broadcasting update: {str(e)}")

    async def send_alert(
        self,
        alert_data: Dict[str, Any],
        user_address: Optional[str] = None
    ):
        """Send alert to relevant clients"""
        try:
            message = {
                "type": "alert",
                "data": alert_data,
                "timestamp": datetime.now().isoformat()
            }

            if user_address:
                await self._send_to_user(user_address, message)
            else:
                await self._broadcast_to_channel('alerts', message)

        except Exception as e:
            logging.error(f"Error sending alert: {str(e)}")

    async def update_heartbeat(self, client_id: str):
        """Update client heartbeat timestamp"""
        if client_id in self.clients:
            self.clients[client_id].last_heartbeat = datetime.now()

    async def _cleanup_inactive_clients(self):
        """Remove inactive clients periodically"""
        while True:
            try:
                now = datetime.now()
                inactive_timeout = timedelta(minutes=5)
                
                inactive_clients = [
                    client_id
                    for client_id, client in self.clients.items()
                    if now - client.last_heartbeat > inactive_timeout
                ]
                
                for client_id in inactive_clients:
                    await self.unregister_client(client_id)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logging.error(f"Error in cleanup task: {str(e)}")
                await asyncio.sleep(60)

    async def _send_to_user(self, user_address: str, message: Dict[str, Any]):
        """Send message to all clients of a specific user"""
        try:
            user_clients = [
                client_id
                for client_id, client in self.clients.items()
                if client.user_address == user_address
            ]
            
            for client_id in user_clients:
                if client_id in self.clients:
                    await self._send_to_client(client_id, message)
                    
        except Exception as e:
            logging.error(f"Error sending to user: {str(e)}")

    async def _broadcast_to_channel(self, channel: str, message: Dict[str, Any]):
        """Broadcast message to all clients subscribed to a channel"""
        if channel in self.channels:
            for client_id in self.channels[channel]:
                if client_id in self.clients:
                    await self._send_to_client(client_id, message)

    async def _send_to_client(self, client_id: str, message: Dict[str, Any]):
        """Send message to specific client"""
        try:
            # The actual sending mechanism will depend on your WebSocket implementation
            # This is a placeholder for the actual WebSocket send
            pass
        except Exception as e:
            logging.error(f"Error sending to client {client_id}: {str(e)}")