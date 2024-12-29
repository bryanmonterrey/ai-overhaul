# memgpt-service/chat/trading_chat.py
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
import os
import json
import logging
class CommandType(Enum):
    TRADE = "trade"
    ANALYSIS = "analysis"
    SETTINGS = "settings"
    PORTFOLIO = "portfolio"
    SYSTEM = "system"
    CONFIRM = "confirm"

class TradingChat:
    def __init__(self, letta_service, memory_processor, dspy_service):
        self.letta = letta_service
        self.memory = memory_processor
        self.dspy_service = dspy_service
        self.command_handlers = self._init_command_handlers()
        self.realtime_monitor = letta_service.realtime_monitor  # Add this line
        self.trading_memory = letta_service.trading_memory 
        self.last_trade = None

        self.solana_service = letta_service.solana_service
        
    def _init_command_handlers(self) -> Dict[str, callable]:
        return {
            CommandType.TRADE.value.lower(): self._handle_trade_command,
            CommandType.ANALYSIS.value.lower(): self._handle_analysis_command,
            CommandType.SETTINGS.value.lower(): self._handle_settings_command,
            CommandType.PORTFOLIO.value.lower(): self._handle_portfolio_command,
            CommandType.SYSTEM.value.lower(): self._handle_system_command,
            CommandType.CONFIRM.value.lower(): self._handle_trade_command
        }
    
    
    # memgpt-service/chat/trading_chat.py
    async def analyze_message_with_claude(self, message: str, context: str) -> Dict[str, Any]:
        """Use Claude for natural language understanding of commands"""
        try:
            prompt = f"""Command Analysis Task:
    Message: {message}
    Context: {context}
    Previous Trade Parameters: {json.dumps(self.last_trade) if self.last_trade else 'None'}

    Available commands:
    - TRADE: For trade execution requests (e.g., "buy 100 SOL", "sell 50 USDC", "swap 0.01 SOL for BONK")
        Required parameters: 
        - asset: The token to trade
        - amount: The amount to trade
        - side: 'buy' or 'sell'
    - CONFIRM: For confirming trades (maps to TRADE command)
        Should extract parameters from previous trade context:
        - asset: Same as previous trade
        - amount: Same as previous trade
        - side: Same as previous trade
    - ANALYSIS: For market analysis requests (e.g., "analyze SOL price", "check market conditions")
    - SETTINGS: For system settings changes
    - PORTFOLIO: For portfolio information requests
    - SYSTEM: For system maintenance commands

    For swap operations, map the parameters as follows:
    - For "swap X tokenA for tokenB": 
        asset = tokenB
        amount = X
        side = "buy"
    - For "swap tokenA for X tokenB":
        asset = tokenB
        amount = X
        side = "buy"

    For confirmation messages, if user confirms (e.g., "yes", "confirm", "do it"):
        Use command_type = "TRADE" and include previous trade parameters

    Respond with only a JSON object containing:
    1. command_type: The type of command identified
    2. parameters: Relevant parameters extracted from the message
    3. natural_response: A clear, concise response (do not include any technical details or JSON in this response)

    Example responses:
    {{"command_type": "TRADE", "parameters": {{"asset": "SOL", "amount": 100, "side": "buy"}}, "natural_response": "I understand you want to buy 100 SOL. Please confirm this trade."}}
    {{"command_type": "TRADE", "parameters": {{"asset": "BONK", "amount": 0.01, "side": "buy"}}, "natural_response": "I understand you want to swap 0.01 SOL for BONK. Please confirm this trade."}}
    {{"command_type": "TRADE", "parameters": {{"asset": "BONK", "amount": 0.01, "side": "buy"}}, "natural_response": "Executing the trade of 0.01 SOL for BONK."}}"""

            response = await self.dspy_service.predict_with_retry(prompt)

            try:
                # Parse if it's valid JSON
                if response.strip().startswith('{'):
                    analysis = json.loads(response)
                    # Keep original command type
                    analysis["command_type"] = analysis.get("command_type", "SYSTEM")
                    # Clean up natural response
                    analysis["natural_response"] = (
                        analysis.get("natural_response", "")
                        .replace("Here is the analysis:", "")
                        .replace("`", "")
                        .replace("json", "")
                        .strip()
                    )
                    # Ensure parameters is a dict
                    if not isinstance(analysis.get("parameters"), dict):
                        analysis["parameters"] = {}
                else:
                    # If not JSON, create a proper response
                    analysis = {
                        "command_type": "SYSTEM",
                        "parameters": {},
                        "natural_response": response.strip()
                    }
            except json.JSONDecodeError:
                # If parsing fails, create a clean response
                analysis = {
                    "command_type": "SYSTEM",
                    "parameters": {},
                    "natural_response": "I'm sorry, I'm having trouble understanding. Could you try rephrasing that?"
                }

            return analysis

        except Exception as e:
            print(f"Claude analysis error: {str(e)}")
            return {
                "command_type": "SYSTEM",
                "parameters": {
                    "action": "error",
                    "error": str(e)
                },
                "natural_response": "I apologize, I'm having trouble processing your request. Could you try again?"
            }
    
    async def process_admin_message(self, message: str) -> Dict[str, Any]:
        """Process admin chat messages"""
        print("Starting process_admin_message with:", message)
        try:
            # Use Claude to analyze the message
            analysis = await self.analyze_message_with_claude(message, "admin")
            print("Claude analysis result:", analysis)

            # Get command type and convert to lowercase for comparison
            command_type = analysis["command_type"].lower() if analysis.get("command_type") else "system"

            # For system messages, return natural response
            if command_type == "system":
                return {
                    "response": analysis.get("natural_response", "I'm here to help. What would you like to do?")
                }

            # Handle confirmation - use last trade parameters
            if command_type == "confirm" and self.last_trade:
                analysis["parameters"] = self.last_trade
                command_type = "trade"

            # Store trade parameters for future confirmation
            elif command_type == "trade" and not command_type == "confirm":
                self.last_trade = analysis["parameters"]

            # Get command handler using lowercase command type
            handler = self.command_handlers.get(command_type)
            print("Found handler:", handler)

            if not handler:
                return {
                    "response": analysis.get("natural_response", "I don't understand that command. Could you try rephrasing it?"),
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
                    "command": analysis["command_type"],  # Store original command type
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
        try:
            logging.info(f"Starting trade execution with params: {params}")
            
            # Validate required parameters
            required_params = ['asset', 'amount', 'side']
            missing_params = [p for p in required_params if not params.get(p)]
            if missing_params:
                logging.error(f"Missing parameters: {missing_params}")
                return {
                    "success": False,
                    "error": f"Missing required parameters: {', '.join(missing_params)}"
                }

            # Get token info first - handles both symbol and contract address
            try:
                token_data = await self.solana_service._call_agent_kit('getTokenData', {
                    'symbol': params['asset'],
                    'discover': True
                })
                
                if not token_data:
                    return {
                        'success': False,
                        'error': f"Could not verify token: {params['asset']}",
                        'user_message': f"I couldn't verify the token {params['asset']}. Please check the symbol/address and try again."
                    }

                # Store token info for the trade
                params['token_data'] = token_data
                params['asset'] = token_data['symbol']  # Use verified symbol

            except Exception as token_error:
                logging.error(f"Error verifying token: {str(token_error)}")
                # Continue with original asset if token verification fails
                logging.info("Proceeding with unverified token")

            # For "swap X SOL for TOKEN" we need to adjust the amount calculation
            input_amount = float(params['amount'])
            if params['side'] == 'buy' and params.get('asset').upper() != 'SOL':
                # If we're swapping SOL for another token, this is the SOL amount
                input_amount = float(params['amount'])
                logging.info(f"Using SOL input amount: {input_amount}")
            else:
                # If we're swapping token for SOL, we need price data
                try:
                    token_price = await self.solana_service.get_token_price(params['asset'])
                    input_amount = float(params['amount']) * float(token_price)
                    logging.info(f"Calculated amount in SOL: {input_amount}")
                except Exception as e:
                    logging.error(f"Error calculating token amount: {e}")
                    input_amount = float(params['amount'])

            # Format trade parameters
            trade_params = {
                'asset': params['asset'],
                'amount': input_amount,
                'side': params['side'].lower(),
                'slippage': params.get('slippage', 100),  # 1% default
                'useMev': params.get('useMev', True),
                'receive_asset': self.solana_service.token_addresses.get('SOL'),
                'token_data': params.get('token_data')  # Include token data if available
            }
            
            logging.info(f"Formatted trade parameters: {trade_params}")

            if is_admin:
                # Execute through realtime monitor with debugging
                try:
                    logging.info("Executing admin trade through realtime monitor")
                    result = await self.realtime_monitor.execute_solana_trade(trade_params)
                    logging.info(f"Trade execution result: {result}")
                    
                    # Store execution data
                    try:
                        execution_data = {
                            "type": "trade_attempt",
                            "data": {
                                **trade_params,
                                "original_amount": params['amount']  # Store original amount for reference
                            },
                            "result": result,
                            "timestamp": datetime.now().isoformat()
                        }
                        await self.trading_memory.store_trade_execution(execution_data)
                        logging.info("Trade execution stored in memory")
                    except Exception as mem_error:
                        logging.error(f"Error storing trade execution: {str(mem_error)}")

                    # Format user-friendly response
                    if result.get('success'):
                        response = {
                            **result,
                            'formatted_amount': params['amount'],  # Original amount
                            'token_symbol': params['asset'].upper(),
                            'token_data': params.get('token_data'),  # Include token data
                            'user_message': f"Successfully executed {params['side']} trade for {params['amount']} {params['asset'].upper()}"
                        }
                        
                        # Add warnings for unverified tokens
                        if params.get('token_data') and not params['token_data'].get('verified'):
                            response['warnings'] = ["This token is not verified. Please verify the contract address."]
                    else:
                        response = {
                            **result,
                            'user_message': f"Trade failed: {result.get('error', 'Unknown error')}"
                        }

                    return response

                except Exception as exec_error:
                    logging.error(f"Trade execution error: {str(exec_error)}")
                    raise
            else:
                logging.info(f"Executing holder trade for address: {user_address}")
                return await self.letta.execute_holder_trade(user_address, trade_params)

        except Exception as e:
            error_msg = f"Trade execution error: {str(e)}"
            logging.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                'user_message': f"Failed to execute trade: {str(e)}"
            }
                
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

    async def store_interaction(self, message: str, response: Dict[str, Any]):
        try:
            await self.memory_processor.process_new_memory({
                'content': message,
                'type': 'trading_chat',
                'metadata': {
                    'response': response,
                    'timestamp': datetime.now().isoformat()
                }
            })
        except Exception as e:
            print(f"Error storing interaction: {str(e)}")
            raise e

    async def get_trading_context(self) -> Dict[str, Any]:
        """Get relevant trading context from memory"""
        try:
            # Query recent trading memories
            memories = await self.memory_processor.query_memories(
                memory_type="trading_history",
                limit=10
            )
            
            return {
                "recent_trades": memories,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Error getting trading context: {str(e)}")
            return {}