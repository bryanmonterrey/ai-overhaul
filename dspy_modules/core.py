# dspy_modules/core.py
import dspy
import json
from pathlib import Path
from typing import Dict, Any, Optional
import re

class PromptManager:
    """Manages loading and parsing prompts from TypeScript files"""
    
    @staticmethod
    def extract_ts_string(content: str, variable_name: str) -> str:
        """Extract template strings from TypeScript files"""
        pattern = f"{variable_name}\\s*=\\s*`([^`]*)`"
        match = re.search(pattern, content, re.DOTALL)
        return match.group(1) if match else ""

    @staticmethod
    def load_prompt_file(file_path: Path) -> str:
        with open(file_path, 'r') as f:
            return f.read()

    @staticmethod
    def parse_tweet_styles(content: str) -> Dict[str, Any]:
        """Parse tweet styles from TypeScript enum"""
        style_pattern = r"export enum TweetStyle {([^}]*)}"
        traits_pattern = r"export const STYLE_TRAITS: Record<TweetStyle, StyleConfig> = ({[^}]*})"
        
        styles = {}
        style_match = re.search(style_pattern, content)
        traits_match = re.search(traits_pattern, content)
        
        if style_match and traits_match:
            # Parse enum values
            style_content = style_match.group(1)
            style_items = [s.strip().split('=')[0].strip() 
                         for s in style_content.split(',') if s.strip()]
            
            # Parse traits
            traits_content = traits_match.group(1)
            # Convert TypeScript to Python dict syntax
            traits_dict = eval(traits_content.replace(':', '=')
                             .replace('true', 'True')
                             .replace('false', 'False'))
            
            for style in style_items:
                if style in traits_dict:
                    styles[style] = traits_dict[style]
                    
        return styles

class PersonalityModule(dspy.Module):
    """Core personality module that integrates with existing prompts"""
    
    def __init__(self, prompt_dir: Path):
        super().__init__()
        self.prompt_dir = prompt_dir
        self.prompt_manager = PromptManager()
        self.load_prompts()
        
    def load_prompts(self):
        """Load all prompt templates and configurations"""
        # Load tweet styles
        styles_content = self.prompt_manager.load_prompt_file(
            self.prompt_dir / 'styles' / 'tweet-styles.ts'
        )
        self.tweet_styles = self.prompt_manager.parse_tweet_styles(styles_content)
        
        # Load personality prompts
        personality_content = self.prompt_manager.load_prompt_file(
            self.prompt_dir / 'builders' / 'personality-prompt.ts'
        )
        self.core_traits = self.prompt_manager.extract_ts_string(
            personality_content, 'PERSONALITY_CORE_TRAITS'
        )
        self.critical_rules = self.prompt_manager.extract_ts_string(
            personality_content, 'CRITICAL_RULES'
        )
        
    def forward(self, 
                input_text: str,
                emotional_state: str,
                style: str,
                context: Optional[Dict[str, Any]] = None) -> dspy.Prediction:
        """Generate a response using multi-step reasoning"""
        
        # Step 1: Analyze context and emotional state
        analysis = self.predict(dspy.ChainOfThought(
            f"""Analyze the input and determine appropriate response approach.
            Input: {input_text}
            Emotional State: {emotional_state}
            Style: {style}
            
            {self.core_traits}
            
            Think through step by step:
            1. What is the key message or topic?
            2. How does the emotional state affect our response?
            3. What style elements should we emphasize?
            4. What unique perspective can we add?
            """))
        
        # Step 2: Generate response using analysis
        response = self.predict(dspy.ChainOfThought(
            f"""Generate a response based on the analysis.
            Analysis: {analysis.reasoning}
            
            Style Guidelines:
            {self.tweet_styles.get(style, {})}
            
            {self.critical_rules}
            
            Generate a response that:
            1. Matches the determined style
            2. Incorporates the emotional state
            3. Adds unique value or perspective
            4. Follows all critical rules
            """))
        
        return dspy.Prediction(
            response=response.response,
            reasoning=analysis.reasoning,
            metadata={
                'style': style,
                'emotional_state': emotional_state,
                'analysis': analysis
            }
        )

# Initialize teleprompter for response optimization
teleprompter = dspy.teleprompt.BootstrapFewShot(metric='exact_match')