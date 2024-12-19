from .vector_store import VectorStore
from .hierarchy import MemoryHierarchy, MemoryNode
from .retrieval import MemoryRetrieval, SearchResult
from .utils import EmbeddingManager

__version__ = '0.1.0'

# Configuration defaults
DEFAULT_EMBEDDING_MODEL = "text-embedding-ada-002"
DEFAULT_VECTOR_DIMENSION = 1536
DEFAULT_BATCH_SIZE = 8
DEFAULT_IMPORTANCE_THRESHOLD = 0.7
DEFAULT_SIMILARITY_THRESHOLD = 0.8

__all__ = [
    'VectorStore',
    'MemoryHierarchy',
    'MemoryNode',
    'MemoryRetrieval',
    'SearchResult',
    'EmbeddingManager',
    'DEFAULT_EMBEDDING_MODEL',
    'DEFAULT_VECTOR_DIMENSION',
    'DEFAULT_BATCH_SIZE',
    'DEFAULT_IMPORTANCE_THRESHOLD',
    'DEFAULT_SIMILARITY_THRESHOLD'
]

def init_memory_system(supabase_client):
    """Initialize the complete memory system"""
    embedding_manager = EmbeddingManager(
        model=DEFAULT_EMBEDDING_MODEL,
        batch_size=DEFAULT_BATCH_SIZE
    )
    
    vector_store = VectorStore(
        supabase=supabase_client,
        embedding_manager=embedding_manager
    )
    
    hierarchy = MemoryHierarchy(
        supabase=supabase_client
    )
    
    retrieval = MemoryRetrieval(
        supabase=supabase_client,
        vector_store=vector_store,
        embedding_manager=embedding_manager
    )
    
    return {
        'embedding_manager': embedding_manager,
        'vector_store': vector_store,
        'hierarchy': hierarchy,
        'retrieval': retrieval
    }

MEMORY_CONFIG = {
    'embedding': {
        'cache_size': 10000,
        'batch_size': 8,
        'model': 'text-embedding-ada-002'
    },
    'retrieval': {
        'default_strategy': 'hybrid',
        'min_relevance': 0.5,
        'max_results': 10
    },
    'hierarchy': {
        'max_depth': 5,
        'consolidation_threshold': 0.8,
        'prune_age_days': 30
    },
    'vector_store': {
        'index_type': 'flat',  # or 'hnsw', 'ivf'
        'sync_interval': 3600  # seconds
    }
}