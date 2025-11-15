# app/llm.py
import os
import logging
from typing import AsyncGenerator
from llama_index.llms.openai import OpenAI
from llama_index.core.llms import ChatMessage, MessageRole

# Initialize OpenAI LLM
llm = OpenAI(
    model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
    temperature=0.7,
    max_tokens=int(os.getenv("OPENAI_MAX_TOKENS", "3000")),  # Increased for comprehensive explanations
)

async def stream_chat_completion(system_prompt: str, user_message: str) -> AsyncGenerator[dict, None]:
    """
    Stream chat completion using LlamaIndex OpenAI LLM.
    
    Args:
        system_prompt: System prompt message
        user_message: User message
    
    Yields:
        Dict with type "delta" and "token", type "error", or type "done"
    """
    try:
        # Create messages
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=user_message),
        ]
        
        # Stream response
        # Check if astream_chat exists (may vary by LlamaIndex version)
        if not hasattr(llm, 'astream_chat'):
            raise AttributeError("LLM does not support astream_chat method")
        
        response_stream = await llm.astream_chat(messages=messages)
        
        async for token in response_stream:
            # Extract content from token - handle different LlamaIndex return types
            content = None
            
            # Try different ways to extract content based on token structure
            if hasattr(token, 'delta') and token.delta:
                delta = token.delta
                if isinstance(delta, str):
                    content = delta
                elif hasattr(delta, 'content'):
                    content = delta.content
                elif hasattr(delta, 'text'):
                    content = delta.text
                else:
                    content = str(delta)
            elif hasattr(token, 'content'):
                content = token.content
            elif hasattr(token, 'text'):
                content = token.text
            elif isinstance(token, str):
                content = token
            else:
                # Try to get content from message if token is a message object
                content = getattr(token, 'content', None) or getattr(token, 'text', None) or str(token)
            
            if content:
                yield {"type": "delta", "token": content}
        
        yield {"type": "done"}
        
    except Exception as e:
        # Log error for debugging
        logging.error(f"Error in stream_chat_completion: {e}", exc_info=True)
        
        # Yield structured error message (not as content delta)
        yield {"type": "error", "message": "Internal error during chat completion", "code": "llm_failure"}
        yield {"type": "done"}
