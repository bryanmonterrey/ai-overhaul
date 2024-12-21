# memgpt-service/chat/trading_chat.py
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum

class CommandType(Enum):
    TRADE = "trade"
    ANALYSIS = "analysis"
    SETTINGS = "settings"
    PORTFOLIO = "portfolio"
    SYSTEM = "system"

class TradingChat:
    def __init__(self, letta_service, memory_processor, dspy_service):
        self.letta = letta_service
        self.memory = memory_processor
        self.dspy = dspy_service
        self.command_handlers = self._init_command_handlers()
        
    def _init_command_handlers(self) -> Dict[str, callable]:
        return {
            CommandType.TRADE: self._handle_trade_command,
            CommandType.ANALYSIS: self._handle_analysis_command,
            CommandType.SETTINGS: self._handle_settings_command,
            CommandType.PORTFOLIO: self._handle_portfolio_command,
            CommandType.SYSTEM: self._handle_system_command
        }
        
    async def process_admin_message(self, message: str) -> Dict[str, Any]:
        """Process admin chat messages"""
        try:
            # Use DSPy to analyze intent and extract command
            analysis = await self.dspy_service.analyze_trading_command(
                message,
                context="admin"
            )
            
            # Get command handler
            handler = self.command_handlers.get(analysis["command_type"])
            if not handler:
                return {
                    "response": "I don't understand that command.",
                    "error": "Invalid command type"
                }
                
            # Execute command with admin privileges
            result = await handler(
                analysis["parameters"],
                is_admin=True
            )
            
            # Store interaction in memory
            await self.memory.store_interaction(
                content=message,
                response=result,
                metadata={
                    "type": "admin_trading_chat",
                    "command": analysis["command_type"],
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            return result
            
        except Exception as e:
            return {
                "response": f"Error processing command: {str(e)}",
                "error": str(e)
            }
            
    async def process_holder_message(
        self,
        message: str,
        user_address: str
    ) -> Dict[str, Any]:
        """Process holder chat messages"""
        try:
            # Verify holder status
            holder_info = await self.letta.verify_holder(user_address)
            if not holder_info["is_holder"]:
                return {
                    "response": "You need to hold tokens to use this feature.",
                    "error": "Not a token holder"
                }
                
            # Use DSPy to analyze intent and extract command
            analysis = await self.dspy_service.analyze_trading_command(
                message,
                context="holder"
            )
            
            # Get command handler
            handler = self.command_handlers.get(analysis["command_type"])
            if not handler:
                return {
                    "response": "I don't understand that command.",
                    "error": "Invalid command type"
                }
                
            # Execute command with holder privileges
            result = await handler(
                analysis["parameters"],
                is_admin=False,
                user_address=user_address
            )
            
            # Store interaction in memory
            await self.memory.store_interaction(
                content=message,
                response=result,
                metadata={
                    "type": "holder_trading_chat",
                    "user_address": user_address,
                    "command": analysis["command_type"],
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            return result
            
        except Exception as e:
            return {
                "response": f"Error processing command: {str(e)}",
                "error": str(e)
            }
            
    async def _handle_trade_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle trade execution commands"""
        if is_admin:
            # Admin can execute system-wide trades
            return await self.letta.execute_ai_trade(params)
        else:
            # Holders can only manage their own trades
            return await self.letta.execute_holder_trade(user_address, params)
            
    async def _handle_analysis_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle market analysis commands"""
        analysis = await self.letta.analyze_market(params)
        
        if is_admin:
            # Include detailed system metrics
            return {
                **analysis,
                "system_metrics": await self.letta.get_system_metrics()
            }
        else:
            # Include holder-specific insights
            return {
                **analysis,
                "holder_insights": await self.letta.get_holder_insights(user_address)
            }
            
    async def _handle_settings_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle settings management commands"""
        if is_admin:
            return await self.letta.update_system_settings(params)
        else:
            return await self.letta.update_holder_settings(user_address, params)
            
    async def _handle_portfolio_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle portfolio information commands"""
        if is_admin:
            return await self.letta.get_system_portfolio()
        else:
            return await self.letta.get_holder_portfolio(user_address)
            
    async def _handle_system_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle system maintenance commands"""
        if not is_admin:
            return {
                "response": "System commands are only available to admins.",
                "error": "Insufficient privileges"
            }
            
        return await self.letta.execute_system_command(params)