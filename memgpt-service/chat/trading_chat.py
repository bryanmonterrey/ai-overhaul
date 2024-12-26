# memgpt-service/chat/trading_chat.py
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
import anthropic
import os
import json

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
        self.dspy_service = dspy_service
        self.command_handlers = self._init_command_handlers()
        self.claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
    def _init_command_handlers(self) -> Dict[str, callable]:
        return {
            CommandType.TRADE: self._handle_trade_command,
            CommandType.ANALYSIS: self._handle_analysis_command,
            CommandType.SETTINGS: self._handle_settings_command,
            CommandType.PORTFOLIO: self._handle_portfolio_command,
            CommandType.SYSTEM: self._handle_system_command
        }
    
    async def analyze_message_with_claude(self, message: str, context: str) -> Dict[str, Any]:
        """Use Claude for natural language understanding of commands"""
        try:
            response = await self.claude.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=1024,
                messages=[{
                    "role": "system",
                    "content": "You are a Solana trading assistant helping users execute trades and analyze the market."
                },
                {
                    "role": "user",
                    "content": f"""Analyze this trading message and determine the command type and parameters:
                    Message: {message}
                    Context: {context}
                    
                    Available commands:
                    - TRADE: For trade execution requests
                    - ANALYSIS: For market analysis requests
                    - SETTINGS: For system settings changes
                    - PORTFOLIO: For portfolio information requests
                    - SYSTEM: For system maintenance commands
                    
                    Respond with a JSON object containing:
                    1. command_type: The type of command identified
                    2. parameters: Relevant parameters extracted from the message
                    3. natural_response: A conversational response to the user
                    
                    Example:
                    {{
                        "command_type": "TRADE",
                        "parameters": {{
                            "action": "buy",
                            "token": "SOL",
                            "amount": 10
                        }},
                        "natural_response": "I understand you want to buy 10 SOL. I'll help you execute this trade."
                    }}"""
                }]
            )
            
            analysis = json.loads(response.content[0].text)
            return analysis

        except Exception as e:
            print(f"Claude analysis error: {str(e)}")
            return {
                "command_type": "SYSTEM",
                "parameters": {
                    "action": "error",
                    "error": str(e)
                },
                "natural_response": "I apologize, but I'm having trouble understanding your request. Could you please rephrase it?"
            }
        
    async def process_admin_message(self, message: str) -> Dict[str, Any]:
        """Process admin chat messages"""
        print("Starting process_admin_message with:", message)
        try:
            # Use Claude to analyze the message
            analysis = await self.analyze_message_with_claude(message, "admin")
            print("Claude analysis result:", analysis)

            # For system messages, return natural response
            if analysis["command_type"] == "SYSTEM":
                return {
                    "response": analysis.get("natural_response", "I'm here to help. What would you like to do?")
                }

            # Get command handler
            handler = self.command_handlers.get(analysis["command_type"])
            print("Found handler:", handler)

            if not handler:
                return {
                    "response": "I don't understand that command. Could you try rephrasing it?",
                    "error": "Invalid command type"
                }

            # Execute command with admin privileges
            print("Executing handler with parameters:", analysis["parameters"])
            result = await handler(
                analysis["parameters"],
                is_admin=True
            )
            print("Handler result:", result)

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
            
            # Combine the natural response with the result
            final_response = {
                "response": analysis.get("natural_response", str(result)),
                "data": result
            }
            
            return final_response

        except Exception as e:
            print("Error in process_admin_message:", str(e))
            return {
                "response": f"I encountered an error: {str(e)}. Could you try again?",
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