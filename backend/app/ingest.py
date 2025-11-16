# app/ingest.py
"""
Document ingestion module using latest LlamaIndex API patterns.
"""
import os
from typing import List, Optional
from pathlib import Path
import anyio
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document, MetadataMode
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# Import Settings for newer LlamaIndex API
from llama_index.core import Settings

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
BASE_COLLECTION_PREFIX = os.getenv("QDRANT_COLLECTION_PREFIX", "")

# Initialize OpenAI embeddings
_embed_model = OpenAIEmbedding(
    model=os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
)

# Initialize text splitter (transformations)
text_splitter = SentenceSplitter(
    chunk_size=3000,
    chunk_overlap=300,
)

# Prefer passing embed_model and transformations as kwargs for local config
Settings.embed_model = _embed_model
Settings.chunk_size = 3000  # Set chunk_size in Settings (newer API)

def get_collection_name(subject: str) -> str:
    """Get collection name for a subject, normalized to lowercase."""
    subject_normalized = subject.lower().strip()
    if BASE_COLLECTION_PREFIX:
        return f"{BASE_COLLECTION_PREFIX}_{subject_normalized}"
    return subject_normalized

def _get_or_create_index_sync(subject: str) -> VectorStoreIndex:
    """Synchronous version - get or create a VectorStoreIndex for a subject."""
    collection_name = get_collection_name(subject)
    
    # Initialize Qdrant client
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    
    # Create vector store
    vector_store = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
    )
    
    # Create storage context
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Try to load existing index, or create new one
    collection_exists = False
    try:
        # Check if collection exists
        client.get_collection(collection_name)
        collection_exists = True
    except Exception:
        # Collection doesn't exist, need to create it
        pass
    
    if not collection_exists:
        # Get embedding dimension
        embedding_dim = 1536  # Default for text-embedding-3-small
        try:
            # Try synchronous method to get dimension
            test_embedding = _embed_model.get_query_embedding("test")
            embedding_dim = len(test_embedding)
        except Exception:
            # Use default dimension if we can't determine it
            pass
        
        # Create collection with proper dimensions
        try:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=embedding_dim,
                    distance=Distance.COSINE
                )
            )
        except Exception as e:
            # Collection might already exist (race condition), check again
            try:
                client.get_collection(collection_name)
            except Exception:
                # Re-raise original error if collection still doesn't exist
                raise Exception(f"Failed to create Qdrant collection: {e}")
    
    # Load or create index using latest LlamaIndex API
    # Pass embed_model and transformations as kwargs (local config, preferred)
    # Following the pattern: modules accept kwargs for the objects being used
    try:
        # Try with explicit embed_model and transformations (local config)
        index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            storage_context=storage_context,
            embed_model=_embed_model,
            transformations=[text_splitter],
        )
    except TypeError as e:
        # If that doesn't work, try with just embed_model
        try:
            index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context,
                embed_model=_embed_model,
            )
        except TypeError:
            # Last fallback: use Settings defaults (global config)
            # Settings.embed_model and Settings.chunk_size are already configured
            index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context,
            )
    
    return index

def get_or_create_index(subject: str) -> VectorStoreIndex:
    """Get or create a VectorStoreIndex for a subject (synchronous wrapper)."""
    return _get_or_create_index_sync(subject)

def _upsert_document_sync(
    doc_id: str,
    title: str,
    text: str,
    subject: str,
    skip_existing: bool = False,
) -> int:
    """
    
    Args:
        doc_id: Document identifier
        title: Document title
        text: Document text content
        subject: Subject name (e.g., "maths", "physics", "chemistry")
        skip_existing: If True, skip ingestion if document already exists (default: False)
    
    Returns:
        Number of chunks upserted (0 if skipped)
    """
    # Get or create index
    index = _get_or_create_index_sync(subject)
    
    # Check if document already exists
    if skip_existing:
        try:
            # Query the vector store directly to check for existing doc_id
            from qdrant_client import QdrantClient
            from qdrant_client.http.models import Filter, FieldCondition, MatchValue
            
            collection_name = get_collection_name(subject)
            client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
            
            existing = client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="doc_id",
                            match=MatchValue(value=doc_id)
                        )
                    ]
                ),
                limit=1
            )
            if existing[0]:  # Document already exists
                return 0
        except Exception:
            # Collection doesn't exist or error checking - proceed with ingestion
            pass
    
    # Create document with metadata
    document = Document(
        text=text,
        metadata={
            "doc_id": doc_id,
            "title": title,
            "subject": subject.lower(),
        },
        id_=doc_id,
    )
    
    # Insert document (LlamaIndex handles chunking and embedding)
    # The insert method uses the embed_model and transformations configured in the index
    # Following latest LlamaIndex patterns: index already has embed_model and transformations
    ref_doc_ids = index.insert(document)
    
    # Count nodes inserted
    # Estimate based on text length and chunk size
    chunks = text_splitter.split_text(text)
    return len(chunks)

async def upsert_document(
    doc_id: str,
    title: str,
    text: str,
    subject: str,
    skip_existing: bool = False,
    show_progress: bool = True
) -> int:
    """
    Upsert document into subject-specific collection using LlamaIndex.
    Runs synchronous LlamaIndex operations in threadpool.
    
    Args:
        doc_id: Document identifier
        title: Document title
        text: Document text content
        subject: Subject name (e.g., "maths", "physics", "chemistry")
        skip_existing: If True, skip ingestion if document already exists (default: False)
        show_progress: Whether to show progress bars (default: True, but ignored in HTTP context)
    
    Returns:
        Number of chunks upserted (0 if skipped)
    """
    return await anyio.to_thread.run_sync(
        _upsert_document_sync,
        doc_id,
        title,
        text,
        subject,
        skip_existing,
    )

def chunk_text(text: str, max_chars=3000, overlap=300) -> List[dict]:
    """
    Legacy function for backward compatibility.
    Converts text to chunks format expected by old code.
    """
    chunks = text_splitter.split_text(text)
    result = []
    for idx, chunk in enumerate(chunks):
        result.append({
            "id": f"chunk_{idx}",
            "text": chunk,
            "index": idx
        })
    return result
