# dspy_modules/service.py
import dspy
from pathlib import Path
from typing import Dict, Any, Optional, List
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
        
    async def generate_summary(self, memories: List[Dict], style: str, emotional_state: str) -> Dict[str, Any]:
        """Generate a summary of memories using DSPy"""
        try:
            # Create a prompt for summarization
            prompt = self.prompt_builder.buildPrompt({
                'type': 'summary',
                'memories': [m.get('content', '') for m in memories],
                'style': style,
                'emotional_state': emotional_state
            })

            # Generate summary using DSPy
            result = await self.predict(prompt)
            
            return {
                'success': True,
                'data': {
                    'summary': result.get('summary', ''),
                    'key_points': result.get('key_points', []),
                    'trends': result.get('trends', [])
                }
            }
        except Exception as e:
            print(f"Error generating DSPy summary: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    async def find_related(
        self, 
        source_content: str,
        candidates: List[str],
        limit: int = 5,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Find related content using DSPy's semantic understanding"""
        try:
            emotional_state = context.get('emotional_state', 'neutral')
            style = context.get('style', 'default')

            # Create a prompt for finding related content
            prompt = self.prompt_builder.buildPrompt({
                'type': 'similarity',
                'source': source_content,
                'candidates': candidates,
                'style': style,
                'emotional_state': emotional_state
            })

            # Use DSPy to find similarities
            result = await self.predict(prompt)
            
            # Process and score results
            scored_results = []
            for idx, candidate in enumerate(candidates):
                score = result.get('similarities', [])[idx] if result.get('similarities') else 0
                scored_results.append({
                    'content': candidate,
                    'dspy_score': float(score),
                    'insights': result.get('insights', {}).get(str(idx), [])
                })

            # Sort by score and limit results
            sorted_results = sorted(
                scored_results, 
                key=lambda x: x['dspy_score'], 
                reverse=True
            )[:limit]

            return {
                'success': True,
                'data': {
                    'memories': sorted_results,
                    'insights': result.get('insights', {}),
                    'analysis': result.get('analysis', {})
                }
            }
        except Exception as e:
            print(f"Error finding related content with DSPy: {str(e)}")
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