# app/embeddings.py
# DEPRECATED: This module is deprecated. Embeddings are now handled by LlamaIndex.
# Kept for backward compatibility only.
import os
import aiohttp

OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
OPENAI_BASE = "https://api.openai.com/v1/embeddings"

async def embed_texts(texts, show_progress: bool = True):
    """
    Embed texts using OpenAI API with progress tracking.
    
    Args:
        texts: List of text strings to embed
        show_progress: Whether to show progress bar (default: True)
    
    Returns:
        List of embedding vectors
    """
    from tqdm import tqdm
    
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    num_texts = len(texts)
    
    # Show progress bar for embedding generation
    if show_progress and num_texts > 0:
        pbar = tqdm(total=num_texts, desc="Generating embeddings", unit="chunk", leave=False)
        pbar.set_postfix({"model": OPENAI_EMBED_MODEL})
    
    try:
        # simple batching - OpenAI can handle up to 2048 texts per request
        async with aiohttp.ClientSession() as session:
            payload = {"model": OPENAI_EMBED_MODEL, "input": texts}
            headers = {"Authorization": f"Bearer {openai_api_key}", "Content-Type": "application/json"}
            async with session.post(OPENAI_BASE, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"OpenAI API error: {resp.status} - {error_text}")
                data = await resp.json()
                
                if show_progress and num_texts > 0:
                    pbar.update(num_texts)  # Update progress bar
                
                return [item["embedding"] for item in data["data"]]
    finally:
        if show_progress and num_texts > 0:
            pbar.close()

