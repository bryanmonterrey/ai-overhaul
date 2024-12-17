# dspy_modules/service.py
import dspy
from pathlib import Path
from typing import Dict, Any, Optional
from .core import PersonalityModule, teleprompter

class DSPyService:
    def __init__(self, prompt_dir: Path, model_config: Dict[str, Any]):
        # Configure DSPy with your model
        dspy.settings.configure(
            lm=model_config['model'],
            rm=model_config.get('retrieval_model', None)
        )
        
        # Initialize modules
        self.personality = PersonalityModule(prompt_dir)
        
        # Load example data for training
        self.load_examples()
        
    def load_examples(self):
        """Load training examples for bootstrapping"""
        # This would load from your training data
        self.examples = []  # You'll populate this with your training data
        
        # Train the teleprompter
        if self.examples:
            teleprompter.bootstrap(
                self.personality,
                self.examples,
                metric='exact_match'
            )
    
    async def generate_response(self,
                              input_text: str,
                              emotional_state: str,
                              style: str,
                              context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate a response using the DSPy personality module"""
        try:
            # Generate response
            result = self.personality(
                input_text=input_text,
                emotional_state=emotional_state,
                style=style,
                context=context
            )
            
            return {
                'success': True,
                'data': {
                    'response': result.response,
                    'reasoning': result.reasoning,
                    'metadata': result.metadata
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    async def optimize_response(self,
                              input_text: str,
                              target_style: str,
                              feedback: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize responses based on feedback"""
        try:
            # Use teleprompter to optimize based on feedback
            optimized = teleprompter.optimize(
                self.personality,
                input_text,
                target_style,
                metric_feedback=feedback
            )
            
            return {
                'success': True,
                'data': {
                    'optimized_response': optimized.response,
                    'improvements': optimized.reasoning
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }