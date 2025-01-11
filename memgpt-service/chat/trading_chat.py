from typing import Dict, Any, Optional
from datetime import datetime
import os
import json
import logging
import uuid
logging.basicConfig(level=logging.INFO)

class CommandType(str, Enum):
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
        self.realtime_monitor = letta_service.realtime_monitor
        self.trading_memory = letta_service.trading_memory 
        self.last_trade = None
        self.solana_service = letta_service.solana_service

    async def process_admin_message(self, message: str, wallet_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process admin chat messages with improved session handling"""
        try:
            # Extract original signature first
            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )

            # Initialize trading session with preserved signature
            session_result = await self.solana_service.init_trading_session({
                'publicKey': wallet_info['publicKey'],
                'signature': original_signature,
                'credentials': {
                    'publicKey': wallet_info['publicKey'],
                    'signature': original_signature
                }
            })

            if not session_result.get('success'):
                return {
                    'success': False,
                    'error': session_result.get('error', 'Session initialization failed'),
                    'user_message': 'Failed to initialize trading session'
                }

            # Get session ID
            session_id = session_result['sessionId']

            # Store original wallet info
            wallet_with_session = {
                'publicKey': wallet_info['publicKey'],
                'sessionId': session_id,
                'signature': original_signature,
                'credentials': {
                    'publicKey': wallet_info['publicKey'],
                    'sessionId': session_id,
                    'signature': original_signature,
                    'signTransaction': True,
                    'signAllTransactions': True,
                    'connected': True
                }
            }

            # Analyze message with the session context
            analysis = await self.analyze_message_with_claude(
                message,
                {
                    'session_id': session_id,
                    'wallet': wallet_with_session
                }
            )

            command_type = analysis.get('command_type', '').lower()
            if not command_type:
                return {
                    'success': False,
                    'error': 'Invalid command type',
                    'user_message': 'Could not understand the command'
                }

            # Handle confirmation - use last trade parameters
            if command_type == 'confirm' and self.last_trade:
                analysis['parameters'] = {
                    **self.last_trade,
                    'wallet': wallet_with_session
                }
                command_type = 'trade'

            # Store trade parameters for future confirmation
            if command_type == 'trade' and analysis.get('parameters'):
                self.last_trade = {
                    k: v for k, v in analysis['parameters'].items()
                    if k != 'wallet'
                }

            # Get command handler
            handler = self.command_handlers.get(command_type)
            if not handler:
                return {
                    'success': False,
                    'error': 'Invalid command type',
                    'user_message': "I don't understand that command"
                }

            # Execute command
            result = await handler(
                {
                    **analysis.get('parameters', {}),
                    'wallet': wallet_with_session,
                    'sessionId': session_id
                },
                is_admin=True
            )

            # Store interaction in memory
            await self.store_interaction(
                message,
                {
                    'command_type': command_type,
                    'result': result,
                    'session_id': session_id
                }
            )

            return {
                'success': True,
                'response': analysis.get('natural_response') or str(result),
                'data': result
            }

        except Exception as e:
            logging.error(f"Error in process_admin_message: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'user_message': 'An error occurred while processing your request'
            }

    async def execute_trade(self, params: dict) -> dict:
        """Execute a trade with proper session handling"""
        try:
            # Get original signature first
            wallet_info = params.get('wallet')
            if not wallet_info:
                raise ValueError("No wallet info provided")

            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )

            # Execute trade through realtime monitor with session
            if self.realtime_monitor:
                # Add session context
                trade_params = {
                    **params,
                    'wallet': {
                        'publicKey': wallet_info['publicKey'],
                        'sessionId': params.get('sessionId'),
                        'signature': original_signature,
                        'credentials': {
                            'publicKey': wallet_info['publicKey'],
                            'sessionId': params.get('sessionId'),
                            'signature': original_signature
                        }
                    }
                }

                return await self.realtime_monitor.execute_solana_trade(trade_params)
            else:
                raise ValueError("No trade executor available")

        except Exception as e:
            logging.error(f"Trade execution error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'user_message': 'Failed to execute trade'
            }

    async def store_interaction(self, message: str, response: Dict[str, Any]):
        """Store chat interaction with session context"""
        try:
            metadata = {
                'response': response,
                'type': 'trading_chat',
                'timestamp': datetime.now().isoformat(),
                'session_id': response.get('session_id')
            }
            
            result = await self.memory_processor.process_new_memory(message, metadata)
            if not result:
                logging.error("Failed to store interaction in memory")
                
        except Exception as e:
            logging.error(f"Error storing interaction: {str(e)}")

    async def analyze_message_with_claude(self, message: str, context: str) -> Dict[str, Any]:
        """Use Claude for natural language understanding with session context"""
        try:
            prompt = f"""Command Analysis Task:
    Message: {message}
    Context: {context}
    Previous Trade Parameters: {json.dumps(self.last_trade) if self.last_trade else 'None'}
    Session ID: {context.get('session_id')}

    Available commands:
    - TRADE: For trade execution requests
        Required parameters: 
        - asset: The exact token symbol/address from the message
        - amount: The exact numerical amount from the message
        - side: 'buy' or 'sell'
        - session_id: Current session ID
    - CONFIRM: For confirming trades (maps to TRADE command)
        Should use previous trade parameters
    - ANALYSIS: For market analysis requests
        Required parameters:
        - asset: Token to analyze (if specified)
        - timeframe: Time period (if specified)
        - session_id: Current session ID
    ...
    """

            response = await self.dspy_service.predict_with_retry(prompt)
            
            try:
                if response.strip().startswith('{'):
                    analysis = json.loads(response)
                    analysis["command_type"] = analysis.get("command_type", "SYSTEM")
                    if not isinstance(analysis.get("parameters"), dict):
                        analysis["parameters"] = {}
                    # Add session info
                    if analysis["parameters"]:
                        analysis["parameters"]["session_id"] = context.get('session_id')
                else:
                    analysis = {
                        "command_type": "SYSTEM",
                        "parameters": {"session_id": context.get('session_id')},
                        "natural_response": response.strip()
                    }
            except json.JSONDecodeError:
                analysis = {
                    "command_type": "SYSTEM",
                    "parameters": {"session_id": context.get('session_id')},
                    "natural_response": "I'm sorry, I'm having trouble understanding. Could you try rephrasing that?"
                }

            return analysis

        except Exception as e:
            logging.error(f"Claude analysis error: {str(e)}")
            return {
                "command_type": "SYSTEM",
                "parameters": {
                    "action": "error",
                    "error": str(e),
                    "session_id": context.get('session_id')
                },
                "natural_response": "I apologize, I'm having trouble processing your request. Could you try again?"
            }

    # Add other required methods...
