# memgpt-service/trading/realtime.py

from typing import Dict, Any, List, Optional, Callable
from decimal import Decimal
import asyncio
from datetime import datetime, timedelta
import json
from dataclasses import dataclass, asdict
import logging
from .risk_helpers import RiskHelpers
from .portfolio.risk_calculator import RiskCalculator
import uuid
import logging
from .solana_service import SolanaService
import aiohttp

@dataclass
class ConsciousnessMetrics:
    """Metrics for the consciousness system"""
    emotional_state: str
    confidence_level: float
    attention_focus: List[str]
    decision_factors: Dict[str, float]
    risk_tolerance: float
    market_perception: str

@dataclass
class MonitoringMetrics:
    """Real-time monitoring metrics with consciousness integration"""
    timestamp: datetime
    portfolio_value: Decimal
    day_pnl: Decimal
    day_pnl_percent: float
    current_drawdown: float
    risk_level: str
    volatility_24h: float
    sharpe_ratio: float
    total_positions: int
    active_trades: int
    largest_position: Dict[str, Any]
    risk_warnings: List[str]
    performance_metrics: Dict[str, float]
    consciousness_state: Optional[ConsciousnessMetrics] = None

class RealTimeMonitor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ws_handler = None  # Will be set later
        self.risk_calculator = RiskCalculator(config.get("risk_calculator", {
            "max_position_size": 100,
            "max_portfolio_var": 0.05,
            "max_concentration": 0.2,
            "var_confidence": 0.95,
            "var_window": 30
        }))
        self.risk_helpers = RiskHelpers()
        self.supabase = None  # Will be set by the trading handler
        self.solana_service = SolanaService()
        self.wallet = None
        
        # Initialize monitoring state
        self.monitoring_state = {
            "last_update": datetime.now(),
            "subscribers": [],
            "active_alerts": set(),
            "metrics_history": [],
            "consciousness_history": [],
            "risk_thresholds": config.get("risk_thresholds", {
                "max_drawdown": 0.15,  # 15%
                "position_concentration": 0.25,  # 25%
                "volatility_threshold": 0.50,  # 50% annualized
            })
        }

    def set_ws_handler(self, ws_handler):
        """Set WebSocket handler"""
        self.ws_handler = ws_handler

    async def setup_wallet(self, private_key: str):
        """Initialize wallet for trading"""
        from solana.keypair import Keypair
        try:
            keypair = Keypair.from_secret_key(bytes.fromhex(private_key))
            self.wallet = keypair
            return True
        except Exception as e:
            logging.error(f"Wallet setup error: {str(e)}")
            return False

    async def start_monitoring(self):
        """Start the monitoring loop"""
        while True:
            try:
                # Collect and analyze metrics
                metrics = await self.collect_metrics()
                
                # Update consciousness state if available
                if hasattr(self, 'memory_processor'):
                    consciousness = await self.update_consciousness_state(metrics)
                    metrics.consciousness_state = consciousness
                
                # Check for risk alerts
                alerts = self.check_risk_alerts(metrics)
                
                # Store historical data
                self.store_metrics(metrics)
                
                # Notify subscribers
                await self.notify_subscribers({
                    "type": "metrics_update",
                    "data": asdict(metrics),
                    "alerts": alerts
                })
                
                # Update state
                self.monitoring_state["last_update"] = datetime.now()
                
            except Exception as e:
                logging.error(f"Monitoring error: {str(e)}")
                
            await asyncio.sleep(self.config.get("update_interval", 5))

    async def collect_metrics(self) -> MonitoringMetrics:
        """Collect real-time metrics"""
        try:
            # Get portfolio data
            portfolio = await self.get_portfolio_data()
            
            # Calculate performance metrics
            performance = self.calculate_performance_metrics(portfolio)
            
            # Calculate risk metrics
            risk_metrics = await self.calculate_risk_metrics(portfolio)
            
            return MonitoringMetrics(
                timestamp=datetime.now(),
                portfolio_value=portfolio["total_value"],
                day_pnl=performance["day_pnl"],
                day_pnl_percent=performance["day_pnl_percent"],
                current_drawdown=risk_metrics["current_drawdown"],
                risk_level=self.determine_risk_level(risk_metrics),
                volatility_24h=risk_metrics["volatility_24h"],
                sharpe_ratio=risk_metrics["sharpe_ratio"],
                total_positions=len(portfolio["positions"]),
                active_trades=len(portfolio["active_trades"]),
                largest_position=self.get_largest_position(portfolio),
                risk_warnings=risk_metrics["warnings"],
                performance_metrics=performance
            )
        except Exception as e:
            logging.error(f"Error collecting metrics: {str(e)}")
            raise

    def check_risk_alerts(self, metrics: MonitoringMetrics) -> List[Dict[str, Any]]:
        """Check for risk threshold breaches"""
        alerts = []
        thresholds = self.monitoring_state["risk_thresholds"]
        
        # Check drawdown
        if metrics.current_drawdown > thresholds["max_drawdown"]:
            alerts.append({
                "type": "risk_alert",
                "level": "high",
                "message": f"Drawdown threshold exceeded: {metrics.current_drawdown:.2%}"
            })
            
        # Check position concentration
        if metrics.largest_position["percentage"] > thresholds["position_concentration"]:
            alerts.append({
                "type": "risk_alert",
                "level": "medium",
                "message": f"High position concentration in {metrics.largest_position['token']}"
            })
            
        # Check volatility
        if metrics.volatility_24h > thresholds["volatility_threshold"]:
            alerts.append({
                "type": "risk_alert",
                "level": "medium",
                "message": f"High volatility detected: {metrics.volatility_24h:.2%}"
            })
            
        return alerts

    def store_metrics(self, metrics: MonitoringMetrics):
        """Store metrics for historical analysis"""
        self.monitoring_state["metrics_history"].append(asdict(metrics))
        
        # Keep last 24 hours of data (assuming 5-second updates)
        max_history = 17280  # 24 * 60 * 12
        if len(self.monitoring_state["metrics_history"]) > max_history:
            self.monitoring_state["metrics_history"] = self.monitoring_state["metrics_history"][-max_history:]

    async def subscribe(self, callback: Callable[[Dict[str, Any]], None]) -> str:
        """Subscribe to monitoring updates"""
        self.monitoring_state["subscribers"].append(callback)
        return str(len(self.monitoring_state["subscribers"]) - 1)

    async def unsubscribe(self, subscriber_id: str):
        """Unsubscribe from updates"""
        idx = int(subscriber_id)
        if idx < len(self.monitoring_state["subscribers"]):
            self.monitoring_state["subscribers"].pop(idx)

    async def notify_subscribers(self, update: Dict[str, Any]):
        """Notify all subscribers of updates"""
        # First broadcast to Supabase realtime
        await self.broadcast_trading_update(
            update_type=update["type"],
            data=update["data"],
            channel="trading_updates"
        )
        
        # Then notify local subscribers
        for subscriber in self.monitoring_state["subscribers"]:
            try:
                await subscriber(update)
            except Exception as e:
                logging.error(f"Error notifying subscriber: {str(e)}")

    async def setup_wallet(self, private_key: str = None):
        """Initialize wallet for trading"""
        try:
            if not private_key:
                return False
                
            from solana.keypair import Keypair
            try:
                # Try to load as hex
                key_bytes = bytes.fromhex(private_key.strip())
            except ValueError:
                # Try to load as base58
                from base58 import b58decode
                key_bytes = b58decode(private_key)
                
            self.wallet = Keypair.from_secret_key(key_bytes)
            return True
        except Exception as e:
            logging.error(f"Wallet setup error: {str(e)}")
            return False

    async def broadcast_trading_update(self, update_type: str, data: Dict[str, Any], channel: str):
        """Broadcast trading updates to WebSocket clients"""
        try:
            if not self.ws_handler:
                logging.error("WebSocket handler not initialized")
                return

            formatted_update = {
                "type": update_type,
                "data": data,
                "timestamp": datetime.now().isoformat(),
                "source": "trading_system"
            }
            
            # Add additional metadata for specific update types
            if update_type == "metrics_update":
                formatted_update["interval"] = "5s"
                formatted_update["version"] = "2.0"
            elif update_type == "risk_alert":
                formatted_update["priority"] = data.get("level", "medium")
                formatted_update["requires_action"] = data.get("requires_action", False)

            # Broadcast via WebSocket handler
            await self.ws_handler.broadcast_update(channel, formatted_update)

            # Also broadcast to Supabase if available
            if self.supabase:
                try:
                    supabase_channel = self.supabase.channel(channel)
                    supabase_channel.subscribe()
                    await supabase_channel.send({
                        "type": "broadcast",
                        "event": "trading_update",
                        "payload": formatted_update
                    })
                except Exception as se:
                    logging.error(f"Supabase broadcast error: {str(se)}")
                    # Continue execution even if Supabase broadcast fails
                    pass
                
        except Exception as e:
            logging.error(f"Error broadcasting update: {str(e)}")

    async def execute_solana_trade(self, params: dict) -> dict:
        """Execute trade through Jupiter API with WebSocket updates"""
        try:
            trade_id = str(uuid.uuid4())
            
            # Send initial status
            await self.broadcast_trading_update(
                update_type="trade_status",
                data={
                    "trade_id": trade_id,
                    "status": "initiated",
                    "params": params,
                    "timestamp": datetime.now().isoformat()
                },
                channel="trading_updates"
            )

            # Validate parameters
            required_fields = ['asset', 'amount', 'side']
            missing_fields = [field for field in required_fields if field not in params]
            if missing_fields:
                await self._send_trade_error(trade_id, f"Missing fields: {missing_fields}")
                return {
                    "success": False,
                    "error": f"Missing required fields: {', '.join(missing_fields)}"
                }

            # Convert parameters for execution
            trade_params = {
                'inputMint': self.solana_service.token_addresses['SOL'] if params['side'] == 'buy' else params['asset'],
                'outputMint': params['asset'] if params['side'] == 'buy' else self.solana_service.token_addresses['SOL'],
                'amount': str(int(float(params['amount']) * 10**9)),
                'slippageBps': params.get('slippage', 100),
                'onlyDirectRoutes': False,
                'asLegacyTransaction': True
            }

            try:
                # Get quote from Jupiter
                quote_result = await self.solana_service.execute_swap(trade_params)
                
                # Send route check status
                await self.broadcast_trading_update(
                    update_type="trade_status",
                    data={
                        "trade_id": trade_id,
                        "status": "route_found",
                        "quote": quote_result,
                        "timestamp": datetime.now().isoformat()
                    },
                    channel="trading_updates"
                )

                # Store trade intent
                trade_intent = {
                    'id': trade_id,
                    'params': trade_params,
                    'quote': quote_result,
                    'status': 'pending',
                    'timestamp': datetime.now().isoformat()
                }

                # Store in Supabase
                await self.supabase.table('trade_intents').insert(trade_intent).execute()

                # Now we need to get transaction data and sign it
                async with aiohttp.ClientSession() as session:
                    # Get swap transaction data
                    swap_url = "https://quote-api.jup.ag/v6/swap"
                    swap_data = {
                        'quoteResponse': quote_result,
                        'userPublicKey': self.wallet.public_key if self.wallet else None,
                        'wrapUnwrapSOL': True
                    }

                    async with session.post(swap_url, json=swap_data) as response:
                        if response.status != 200:
                            error_data = await response.json()
                            raise ValueError(f"Swap error: {error_data.get('error', 'Unknown error')}")
                        
                        swap_transaction = await response.json()
                        
                        if not self.wallet:
                            # Return unsigned transaction if no wallet
                            return {
                                'success': True,
                                'trade_id': trade_id,
                                'status': 'needs_signature',
                                'transaction': swap_transaction,
                                'params': trade_params,
                                'quote': quote_result,
                                'timestamp': datetime.now().isoformat()
                            }

                        # If wallet is available, sign and submit transaction
                        try:
                            from solana.transaction import Transaction
                            from base58 import b58decode
                            
                            # Decode and sign transaction
                            transaction = Transaction.deserialize(b58decode(swap_transaction['transaction']))
                            signed_tx = transaction.sign(self.wallet)
                            
                            # Submit transaction
                            submit_url = "https://quote-api.jup.ag/v6/swap/submit"
                            submit_data = {
                                'transaction': signed_tx.serialize()
                            }
                            
                            async with session.post(submit_url, json=submit_data) as submit_response:
                                if submit_response.status != 200:
                                    error_data = await submit_response.json()
                                    raise ValueError(f"Submit error: {error_data.get('error', 'Unknown error')}")
                                
                                result = await submit_response.json()
                                
                                # Update trade status
                                await self.broadcast_trading_update(
                                    update_type="trade_status",
                                    data={
                                        "trade_id": trade_id,
                                        "status": "executed",
                                        "signature": result.get('txid'),
                                        "params": trade_params,
                                        "timestamp": datetime.now().isoformat()
                                    },
                                    channel="trading_updates"
                                )
                                
                                # Update in database
                                await self.supabase.table('trade_intents')\
                                    .update({
                                        'status': 'executed',
                                        'signature': result.get('txid')
                                    })\
                                    .eq('id', trade_id)\
                                    .execute()
                                
                                return {
                                    'success': True,
                                    'trade_id': trade_id,
                                    'status': 'executed',
                                    'signature': result.get('txid'),
                                    'params': trade_params,
                                    'timestamp': datetime.now().isoformat()
                                }
                                
                        except Exception as e:
                            await self._send_trade_error(trade_id, f"Transaction error: {str(e)}")
                            raise

            except Exception as e:
                await self._send_trade_error(trade_id, str(e))
                raise

        except Exception as e:
            error_msg = f"Trade execution error: {str(e)}"
            logging.error(error_msg)
            if 'trade_id' in locals():
                await self._send_trade_error(trade_id, error_msg)
            return {
                'success': False,
                'error': error_msg
            }

    def set_supabase_client(self, supabase_client):
        """Set Supabase client for realtime updates"""
        self.supabase = supabase_client

    async def store_trade_execution(self, data: dict) -> None:
        """Store trade execution data"""
        try:
            execution_data = {
                **data,
                'timestamp': datetime.now().isoformat()
            }
            await self.supabase.table('trade_executions').insert(execution_data).execute()
        except Exception as e:
            logging.error(f"Error storing trade execution: {str(e)}")

    async def _send_trade_error(self, trade_id: str, error: str):
        """Send trade error update via WebSocket"""
        await self.broadcast_trading_update(
            update_type="trade_status",
            data={
                "trade_id": trade_id,
                "status": "error",
                "error": error,
                "timestamp": datetime.now().isoformat()
            },
            channel="trading_updates"
        )

    async def handle_trade_update(self, tx_signature: str, status: str):
        """Handle trade status updates from frontend"""
        try:
            # Find trade intent
            response = await self.supabase.table('trade_intents')\
                .select('*')\
                .eq('status', 'pending')\
                .order('timestamp', desc=True)\
                .limit(1)\
                .execute()

            if response.data:
                trade_intent = response.data[0]
                trade_id = trade_intent['id']

                # Update status
                await self.broadcast_trading_update(
                    update_type="trade_status",
                    data={
                        "trade_id": trade_id,
                        "status": status,
                        "signature": tx_signature,
                        "timestamp": datetime.now().isoformat()
                    },
                    channel="trading_updates"
                )

                # Update in database
                await self.supabase.table('trade_intents')\
                    .update({'status': status, 'tx_signature': tx_signature})\
                    .eq('id', trade_id)\
                    .execute()

        except Exception as e:
            logging.error(f"Error handling trade update: {str(e)}")

    async def get_portfolio_data(self) -> Dict[str, Any]:
        """Get current portfolio data"""
        # Implementation needed
        pass

    def calculate_performance_metrics(self, portfolio: Dict[str, Any]) -> Dict[str, float]:
        """Calculate performance metrics from portfolio data"""
        # Implementation needed
        pass

    async def calculate_risk_metrics(self, portfolio: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate risk metrics from portfolio data"""
        # Implementation needed
        pass

    def determine_risk_level(self, risk_metrics: Dict[str, Any]) -> str:
        """Determine overall risk level"""
        # Implementation needed
        pass

    def get_largest_position(self, portfolio: Dict[str, Any]) -> Dict[str, Any]:
        """Get largest position details"""
        # Implementation needed
        pass