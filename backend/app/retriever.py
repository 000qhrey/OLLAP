# app/retriever.py
import os
import anyio
from typing import List, Dict
from app.ingest import _get_or_create_index_sync

def _retrieve_matches_sync(query: str, subject: str, top_k: int = 5) -> List[Dict]:
    """
    retrieve matches from subject-specific collection using LlamaIndex.
    
    Args:
        query: Search query text
        subject: Subject name (e.g., "maths", "physics", "chemistry")
        top_k: Number of results to return
    
    Returns:
        List of matches with id, score, and payload
    """
    try:
        # Get index for subject
        index = _get_or_create_index_sync(subject)
        
        # Create retriever
        retriever = index.as_retriever(similarity_top_k=top_k)
        
        # Retrieve nodes (this may return list[NodeWithScore] or list[Node])
        results = retriever.retrieve(query)
        
        # Convert to expected format - normalize for different return types
        matches = []
        for item in results:
            try:
                # Handle NodeWithScore or Node types
                node = getattr(item, "node", item)
                score = float(getattr(item, "score", 0.0))
                
                # Extract text - try multiple methods
                text = None
                if hasattr(node, "get_text"):
                    text = node.get_text()
                elif hasattr(node, "text"):
                    text = node.text
                elif hasattr(node, "get_content"):
                    text = node.get_content()
                else:
                    text = str(node)
                
                # Extract metadata
                metadata = getattr(node, "metadata", {}) or {}
                doc_id = metadata.get("doc_id", metadata.get("source", ""))
                title = metadata.get("title", "")
                chunk_idx = metadata.get("chunk_index", 0)
                
                # Try to extract chunk index from node_id if not in metadata
                if not chunk_idx and hasattr(node, 'node_id'):
                    node_id_str = str(node.node_id)
                    if "::" in node_id_str:
                        try:
                            chunk_idx = int(node_id_str.split("::")[-1])
                        except (ValueError, IndexError):
                            chunk_idx = 0
                
                subject_meta = metadata.get("subject", subject)
                
                # Create node_id
                node_id = None
                if hasattr(node, "node_id"):
                    node_id = str(node.node_id)
                elif hasattr(node, "id_"):
                    node_id = str(node.id_)
                elif doc_id:
                    node_id = f"{doc_id}::{chunk_idx}"
                else:
                    node_id = f"unknown::{chunk_idx}"
                
                matches.append({
                    "id": node_id,
                    "score": float(score),
                    "payload": {
                        "doc_id": doc_id,
                        "title": title,
                        "text": text,
                        "chunk_index": chunk_idx,
                        "subject": subject_meta,
                    }
                })
            except Exception as e:
                # Fallback for unexpected item structure
                try:
                    node_id = str(getattr(item, "node_id", getattr(item, "id_", "unknown")))
                    text = str(item)
                    score = float(getattr(item, "score", 0.0))
                    doc_id = ""
                    chunk_idx = 0
                    
                    matches.append({
                        "id": node_id,
                        "score": float(score),
                        "payload": {
                            "doc_id": doc_id,
                            "title": "",
                            "text": text,
                            "chunk_index": chunk_idx,
                            "subject": subject,
                        }
                    })
                except Exception:
                    # Skip this item if we can't process it
                    continue
        
        return matches
    except Exception as e:
        # Log error but don't expose internal details to client
        import logging
        logging.error(f"Error retrieving matches for subject '{subject}': {e}")
        # Return empty list instead of raising - allows graceful degradation
        return []

async def retrieve_matches(query: str, subject: str, top_k: int = 5) -> List[Dict]:
    """
    Retrieve matches from subject-specific collection using LlamaIndex.
    Runs synchronous LlamaIndex operations in threadpool.
    
    Args:
        query: Search query text
        subject: Subject name (e.g., "maths", "physics", "chemistry")
        top_k: Number of results to return
    
    Returns:
        List of matches with id, score, and payload
    """
    return await anyio.to_thread.run_sync(_retrieve_matches_sync, query, subject, top_k)
