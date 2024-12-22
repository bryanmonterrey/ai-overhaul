# memgpt-service/trading/memory/trading_memory.py

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from memory_base import Memory
from ..risk_helpers import RiskHelpers

@dataclass
class TradingState:
    """Current trading state including performance and risk metrics"""
    timestamp: datetime
    portfolio_value: Decimal
    active_positions: Dict[str, Any]
    risk_metrics: Dict[str, float]
    performance_metrics: Dict[str, float]
    trading_stats: Dict[str, Any]
    market_conditions: Dict[str, Any]
    consciousness_state: Dict[str, Any]

class TradingMemory:
    def __init__(self, memory_processor):
        self.memory_processor = memory_processor
        self.risk_helpers = RiskHelpers()
        self.state_history: List[TradingState] = []
        self.active_alerts: List[Dict[str, Any]] = []
        self.strategy_history: List[Dict[str, Any]] = []
        self.realtime_monitor = None
        
    async def store_trade_execution(self, trade_result: Dict[str, Any]) -> str:
        """Store trade execution in LettA memory"""
        try:
            # Format trade data for memory storage
            trade_memory = {
                "type": "trading_history",
                "content": {
                    "trade_type": trade_result["type"],
                    "token_in": trade_result["tokenIn"],
                    "token_out": trade_result["tokenOut"],
                    "amount_in": str(trade_result["amountIn"]),
                    "amount_out": str(trade_result["amountOut"]),
                    "timestamp": datetime.now().isoformat(),
                    "tx_hash": trade_result.get("txHash"),
                    "status": trade_result["status"],
                    "price_impact": trade_result.get("priceImpact", 0),
                    "route_info": trade_result.get("routeInfo", {}),
                },
                "metadata": {
                    "importance": 0.8,  # High importance for trades
                    "category": "trade_execution",
                    "strategy": trade_result.get("strategy"),
                    "risk_metrics": await self._calculate_trade_risk_metrics(trade_result)
                }
            }

            # Store in LettA memory system
            memory_result = await self.memory_processor.store_memory(trade_memory)
            
            # Update state history
            await self._update_trading_state(trade_result)
            
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error storing trade execution: {str(e)}")
            return None

    async def store_strategy_update(self, strategy_update: Dict[str, Any]) -> str:
        """Store strategy updates in LettA memory"""
        try:
            strategy_memory = {
                "type": "trading_params",
                "content": {
                    "update_type": "strategy",
                    "timestamp": datetime.now().isoformat(),
                    "parameters": strategy_update["parameters"],
                    "reason": strategy_update.get("reason", ""),
                    "previous_state": strategy_update.get("previous_state", {}),
                },
                "metadata": {
                    "importance": 0.7,
                    "category": "strategy_update",
                    "impact_analysis": await self._analyze_strategy_impact(strategy_update)
                }
            }

            memory_result = await self.memory_processor.store_memory(strategy_memory)
            self.strategy_history.append(strategy_update)
            
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error storing strategy update: {str(e)}")
            return None

    async def get_trading_context(self, timeframe: str = "24h") -> Dict[str, Any]:
        """Get trading context for decision making"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=24)
            
            # Get relevant memories
            memories = await self.memory_processor.query_memories(
                type="trading_history",
                filters={
                    "time_range": {
                        "start": start_time.isoformat(),
                        "end": end_time.isoformat()
                    }
                }
            )

            # Process memories to extract context
            trades = [m for m in memories if m["metadata"]["category"] == "trade_execution"]
            strategies = [m for m in memories if m["metadata"]["category"] == "strategy_update"]

            # Calculate aggregated metrics
            metrics = await self._calculate_aggregated_metrics(trades)
            
            return {
                "recent_trades": trades[-10:],  # Last 10 trades
                "latest_strategy": strategies[-1] if strategies else None,
                "metrics": metrics,
                "active_alerts": self.active_alerts,
                "market_conditions": await self._get_market_conditions(),
                "consciousness_state": await self._get_consciousness_state()
            }

        except Exception as e:
            print(f"Error getting trading context: {str(e)}")
            return {}

    async def update_risk_alert(self, alert: Dict[str, Any], status: str):
        """Update risk alert status and store in memory"""
        try:
            alert_memory = {
                "type": "trading_params",
                "content": {
                    "alert_type": alert["type"],
                    "status": status,
                    "timestamp": datetime.now().isoformat(),
                    "risk_level": alert["risk_level"],
                    "metrics": alert["metrics"],
                    "resolution": alert.get("resolution", "")
                },
                "metadata": {
                    "importance": 0.9 if alert["risk_level"] == "high" else 0.7,
                    "category": "risk_alert",
                    "requires_action": alert.get("requires_action", False)
                }
            }

            memory_result = await self.memory_processor.store_memory(alert_memory)
            
            # Update active alerts
            if status == "resolved":
                self.active_alerts = [a for a in self.active_alerts if a["id"] != alert["id"]]
            elif status == "new":
                self.active_alerts.append(alert)
            
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error updating risk alert: {str(e)}")
            return None

    async def _calculate_trade_risk_metrics(self, trade: Dict[str, Any]) -> Dict[str, float]:
        """Calculate risk metrics for a trade"""
        return await self.risk_helpers.calculate_trade_risk_metrics(trade)

    async def _analyze_strategy_impact(self, strategy: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the potential impact of a strategy update"""
        # Implementation will depend on your risk analysis requirements
        pass

    async def _calculate_aggregated_metrics(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate aggregated metrics from trades"""
        # Implementation will depend on your metrics requirements
        pass

    async def _update_trading_state(self, trade_result: Dict[str, Any]):
        """Update the current trading state"""
        # Implementation will depend on your state management requirements
        pass

    async def _get_market_conditions(self) -> Dict[str, Any]:
        """Get current market conditions"""
        # Implementation will depend on your market data sources
        pass

    async def _get_consciousness_state(self) -> Dict[str, Any]:
        """Get current consciousness state"""
        # Implementation will depend on your consciousness system
        pass

    def set_realtime_monitor(self, monitor):
        """Set the realtime monitor instance"""
        self.realtime_monitor = monitor