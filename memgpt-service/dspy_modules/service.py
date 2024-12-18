import dspy
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from .core import PersonalityModule, teleprompter, PromptManager

class PromptBuilder:
    def __init__(self, personality: PersonalityModule):
        self.personality = personality

    def buildPrompt(self, config: Dict[str, Any]) -> str:
        """Build prompts based on type and configuration"""
        prompt_type = config.get('type', '')
        
        if prompt_type == 'summary':
            return self._build_summary_prompt(config)
        elif prompt_type == 'similarity':
            return self._build_similarity_prompt(config)
        else:
            raise ValueError(f"Unknown prompt type: {prompt_type}")

    def _build_summary_prompt(self, config: Dict[str, Any]) -> str:
        memories = config.get('memories', [])
        style = config.get('style', 'default')
        emotional_state = config.get('emotional_state', 'neutral')
        
        # Get style-specific prompt elements
        style_prompt = self.personality.get_style_prompt(style)
        
        memories_text = "\n".join([
            f"Memory {i+1}: {content}" 
            for i, content in enumerate(memories)
        ])
        
        return f"""Analyze and summarize the following memories:
        Style: {style}
        Emotional State: {emotional_state}
        
        {style_prompt}
        
        Memories to summarize:
        {memories_text}
        
        Provide:
        1. A concise summary
        2. Key points identified
        3. Notable trends or patterns
        
        Format the response as:
        Summary: <summary>
        Key Points: <comma-separated list>
        Trends: <comma-separated list>
        """

    def _build_similarity_prompt(self, config: Dict[str, Any]) -> str:
        source = config.get('source', '')
        candidates = config.get('candidates', [])
        style = config.get('style', 'default')
        emotional_state = config.get('emotional_state', 'neutral')
        
        style_prompt = self.personality.get_style_prompt(style)
        
        candidates_text = "\n".join([
            f"Candidate {i+1}: {content}" 
            for i, content in enumerate(candidates)
        ])
        
        return f"""Compare the similarity between the source content and candidates:
        Style: {style}
        Emotional State: {emotional_state}
        
        {style_prompt}
        
        Source:
        {source}
        
        Candidates:
        {candidates_text}
        
        For each candidate provide:
        1. Similarity score (0-1)
        2. Key insights about the relationship
        
        Format as JSON:
        {{
            "similarities": [scores],
            "insights": {{
                "0": [insights_for_first],
                "1": [insights_for_second],
                ...
            }}
        }}
        """

class DSPyService:
    def __init__(self, prompt_dir: Path, model_config: Dict[str, Any]):
        # Configure DSPy with your model
        if model_config['model'].startswith('anthropic'):
            # Configure for Anthropic
            dspy.settings.configure(model=model_config['model'])
        else:
            # Configure for OpenAI
            dspy.settings.configure(model=model_config['model'])
        
        # Initialize modules
        self.personality = PersonalityModule(prompt_dir)
        self.prompt_builder = PromptBuilder(self.personality)
        
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

            # Use the personality module's predict_step method
            result = self.personality.predict_step(prompt)
            
            # Parse the response
            response_lines = result.response.split('\n')
            summary = []
            key_points = []
            trends = []
            current_section = None
            
            for line in response_lines:
                line = line.strip()
                if line.startswith('Summary:'):
                    current_section = 'summary'
                    summary.append(line.replace('Summary:', '').strip())
                elif line.startswith('Key Points:'):
                    current_section = 'key_points'
                    points = line.replace('Key Points:', '').strip()
                    if points:
                        key_points.extend([p.strip() for p in points.split(',')])
                elif line.startswith('Trends:'):
                    current_section = 'trends'
                    trend_list = line.replace('Trends:', '').strip()
                    if trend_list:
                        trends.extend([t.strip() for t in trend_list.split(',')])
                elif line and current_section:
                    if current_section == 'summary':
                        summary.append(line)
                    elif current_section == 'key_points':
                        key_points.extend([p.strip() for p in line.split(',')])
                    elif current_section == 'trends':
                        trends.extend([t.strip() for t in line.split(',')])
                
            return {
                'success': True,
                'data': {
                    'summary': ' '.join(summary),
                    'key_points': [p for p in key_points if p],
                    'trends': [t for t in trends if t]
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
        candidates: List[str] = None,
        limit: int = 5,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Find related content using DSPy's semantic understanding"""
        try:
            emotional_state = context.get('emotional_state', 'neutral') if context else 'neutral'
            style = context.get('style', 'default') if context else 'default'

            if candidates is None:
                candidates = []

            # Create a prompt for finding related content
            prompt = self.prompt_builder.buildPrompt({
                'type': 'similarity',
                'source': source_content,
                'candidates': candidates,
                'style': style,
                'emotional_state': emotional_state
            })

            # Use the personality module's predict_step method
            result = self.personality.predict_step(prompt)
            
            try:
                # Try to parse JSON from the response
                parsed_result = json.loads(result.response)
                
                # Process and score results
                scored_results = []
                for idx, candidate in enumerate(candidates):
                    score = parsed_result.get('similarities', [])[idx] if parsed_result.get('similarities') else 0
                    scored_results.append({
                        'content': candidate,
                        'dspy_score': float(score),
                        'insights': parsed_result.get('insights', {}).get(str(idx), [])
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
                        'insights': parsed_result.get('insights', {}),
                        'analysis': parsed_result.get('analysis', {})
                    }
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': 'Failed to parse similarity results'
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