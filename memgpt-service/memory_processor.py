# memgpt-service/memory_processor.py
from typing import List, Dict, Any, TYPE_CHECKING
import numpy as np

if TYPE_CHECKING:
    from agent import Agent

class MemoryProcessor:
    def __init__(self, agent: 'Agent'):
        self.agent = agent

    async def analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content for patterns, sentiment, and key concepts"""
        try:
            # Basic sentiment analysis
            sentiment = self._analyze_sentiment(content)
            
            # Extract key concepts
            key_concepts = self._extract_key_concepts(content)
            
            # Identify patterns
            patterns = self._identify_patterns(content)
            
            return {
                'sentiment': sentiment,
                'emotional_context': self._get_emotional_context(sentiment),
                'key_concepts': key_concepts,
                'patterns': patterns,
                'importance': self._calculate_importance(content),
                'associations': self._find_associations(content),
                'summary': self._generate_summary(content)
            }
        except Exception as e:
            print(f"Error in content analysis: {str(e)}")
            return {}

    def _analyze_sentiment(self, text: str) -> float:
        """Simple sentiment analysis"""
        positive_words = {'good', 'great', 'excellent', 'positive', 'amazing'}
        negative_words = {'bad', 'poor', 'negative', 'terrible', 'awful'}
        
        words = text.lower().split()
        score = 0
        for word in words:
            if word in positive_words:
                score += 1
            elif word in negative_words:
                score -= 1
        return score / (len(words) + 1)  # Normalize

    def _extract_key_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        # Simple implementation - you can make this more sophisticated
        words = text.lower().split()
        # Remove common words and get unique concepts
        common_words = {'the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and'}
        concepts = [w for w in words if w not in common_words and len(w) > 3]
        return list(set(concepts))[:5]  # Return top 5 concepts

    def _identify_patterns(self, text: str) -> List[str]:
        """Identify patterns in text"""
        # Simple pattern recognition - you can enhance this
        patterns = []
        if '?' in text:
            patterns.append('question')
        if '!' in text:
            patterns.append('exclamation')
        if len(text.split()) > 20:
            patterns.append('detailed')
        return patterns

    def _get_emotional_context(self, sentiment: float) -> str:
        """Convert sentiment to emotional context"""
        if sentiment > 0.5:
            return 'excited'
        elif sentiment > 0:
            return 'creative'
        elif sentiment < -0.5:
            return 'chaotic'
        elif sentiment < 0:
            return 'contemplative'
        return 'neutral'

    def _calculate_importance(self, text: str) -> float:
        """Calculate importance score"""
        # Simple scoring based on length and complexity
        length_score = min(1.0, len(text) / 1000)
        complexity_score = len(set(text.split())) / len(text.split())
        return (length_score + complexity_score) / 2

    def _find_associations(self, text: str) -> List[str]:
        """Find related concepts"""
        words = text.lower().split()
        return list(set(words))[:5]  # Return top 5 unique words

    def _generate_summary(self, text: str) -> str:
        """Generate a brief summary"""
        return text[:100] + '...' if len(text) > 100 else text

    async def cluster_memories(
        self,
        memories: List[Dict],
        min_size: int = 3,
        similarity_threshold: float = 0.7
    ) -> List[Dict]:
        """Cluster memories based on content similarity"""
        if not memories:
            return []

        try:
            # Extract contents
            contents = [m.get('content', '') for m in memories]
            
            # Simple clustering based on keyword overlap
            clusters = []
            used_indices = set()
            
            for i, content in enumerate(contents):
                if i in used_indices:
                    continue
                    
                cluster = [memories[i]]
                used_indices.add(i)
                words1 = set(content.lower().split())
                
                for j, other_content in enumerate(contents):
                    if j in used_indices:
                        continue
                    
                    words2 = set(other_content.lower().split())
                    similarity = len(words1 & words2) / len(words1 | words2)
                    
                    if similarity >= similarity_threshold:
                        cluster.append(memories[j])
                        used_indices.add(j)
                
                if len(cluster) >= min_size:
                    clusters.append({
                        'centroid': content,
                        'memories': cluster
                    })
            
            return clusters

        except Exception as e:
            print(f"Error in memory clustering: {str(e)}")
            return []

    async def find_most_similar(
        self,
        source: Dict,
        candidates: List[Dict]
    ) -> Dict:
        """Find most similar memory"""
        try:
            source_content = source.get('content', '').lower()
            source_words = set(source_content.split())
            
            max_similarity = 0
            most_similar = None
            
            for candidate in candidates:
                candidate_content = candidate.get('content', '').lower()
                candidate_words = set(candidate_content.split())
                
                similarity = len(source_words & candidate_words) / len(source_words | candidate_words)
                
                if similarity > max_similarity:
                    max_similarity = similarity
                    most_similar = candidate
            
            return most_similar
            
        except Exception as e:
            print(f"Error finding similar memory: {str(e)}")
            return None

    async def combine_and_rank_results(
        self,
        db_results: List[Dict],
        semantic_results: List[Dict],
        query: Dict
    ) -> List[Dict]:
        """Combine and rank search results"""
        try:
            combined = {}
            
            # Add database results
            for result in db_results:
                key = result.get('id')
                if key:
                    combined[key] = {
                        'memory': result,
                        'score': 0.5  # Base score
                    }
            
            # Add semantic results with higher weight
            for result in semantic_results:
                key = result.get('id')
                if key:
                    if key in combined:
                        combined[key]['score'] += 0.8  # Boost score
                    else:
                        combined[key] = {
                            'memory': result,
                            'score': 0.8
                        }
            
            # Sort by score
            ranked = sorted(
                combined.values(),
                key=lambda x: x['score'],
                reverse=True
            )
            
            return [item['memory'] for item in ranked]
            
        except Exception as e:
            print(f"Error combining results: {str(e)}")
            return []

    async def analyze_concept_evolution(
        self,
        concept: str,
        memories: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze how a concept evolved over time"""
        try:
            analysis = {
                'sentiment': [],
                'frequency': 0,
                'context_changes': [],
                'related_concepts': set()
            }
            
            concept = concept.lower()
            for memory in sorted(memories, key=lambda x: x.get('created_at', '')):
                content = memory.get('content', '').lower()
                if concept in content:
                    analysis['frequency'] += 1
                    analysis['sentiment'].append(self._analyze_sentiment(content))
                    analysis['related_concepts'].update(self._extract_key_concepts(content))
                    
            return {
                'sentiment': sum(analysis['sentiment']) / len(analysis['sentiment']) if analysis['sentiment'] else 0,
                'frequency': analysis['frequency'],
                'context_changes': list(analysis['context_changes']),
                'related_concepts': list(analysis['related_concepts'])
            }
            
        except Exception as e:
            print(f"Error analyzing concept evolution: {str(e)}")
            return {}

    async def generate_summary(self, memories: List[Dict]) -> str:
        """Generate a summary of multiple memories"""
        try:
            if not memories:
                return "No memories to summarize"
                
            # Combine content
            contents = [m.get('content', '') for m in memories]
            combined = ' '.join(contents)
            
            # Generate simple summary
            return self._generate_summary(combined)
            
        except Exception as e:
            print(f"Error generating summary: {str(e)}")
            return "Error generating summary"