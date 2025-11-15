# app/flashcards.py
import os
import aiohttp
import json
import re
import logging
from typing import List, Dict
from app.models import Flashcard, ChatMessage

CHAT_COMPLETION_URL = "https://api.openai.com/v1/chat/completions"

def sanitize_json_like(text: str) -> str:
    """
    Sanitize JSON-like text from LLM output.
    Strips code fences, trailing commas, and extracts first JSON object.
    """
    # Remove markdown code fences
    text = text.strip()
    text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^```\s*', '', text, flags=re.MULTILINE)
    text = text.rstrip('`').strip()
    
    # Try to extract first JSON object using regex
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        text = json_match.group(0)
    
    # Remove trailing commas before closing braces/brackets
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    
    return text.strip()

async def extract_topic_from_chat_context(chat_context: List[ChatMessage], subject: str) -> str:
    """
    Extract the main topic/concept from chat conversation history.
    
    Args:
        chat_context: List of chat messages (user and assistant)
        subject: Subject name for context
    
    Returns:
        Extracted topic string
    """
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # Build conversation history (limit to last 10 messages to avoid token limits)
    recent_messages = chat_context[-10:] if len(chat_context) > 10 else chat_context
    conversation_text = "\n".join([
        f"{msg.role}: {msg.content}" for msg in recent_messages
    ])
    
    prompt = f"""You are analyzing a {subject} tutoring conversation. Extract the main topic or concept that the student has been learning about.

Conversation:
{conversation_text}

Based on this conversation, what is the main topic or concept the student has been discussing? 
Return ONLY the topic name (e.g., "mole concept", "quadratic equations", "photosynthesis"). 
Keep it concise (1-5 words maximum). Do not include explanations or additional text."""

    headers = {"Authorization": f"Bearer {openai_api_key}", "Content-Type": "application/json"}
    model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 50,
        "temperature": 0.3,
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(CHAT_COMPLETION_URL, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"OpenAI API error: {resp.status} - {error_text}")
                
                data = await resp.json()
                if "choices" not in data or len(data["choices"]) == 0:
                    raise Exception(f"Invalid response from OpenAI: {data}")
                
                topic = data["choices"][0]["message"]["content"].strip()
                # Remove quotes if present
                topic = topic.strip('"\'')
                
                if not topic or len(topic) > 500:
                    # Fallback: use first user message or a default
                    user_messages = [msg.content for msg in chat_context if msg.role == "user"]
                    if user_messages:
                        topic = user_messages[0][:100] + "..."
                    else:
                        topic = f"{subject} concepts"
                
                return topic
    except Exception as e:
        logging.warning(f"Error extracting topic from chat context: {e}")
        # Fallback: use first user message or a default
        user_messages = [msg.content for msg in chat_context if msg.role == "user"]
        if user_messages:
            # Try to extract a simple topic from first message
            first_msg = user_messages[0].lower()
            # Look for common patterns
            if "teach" in first_msg or "explain" in first_msg or "about" in first_msg:
                # Try to extract what comes after these words
                for pattern in [r"teach\s+(?:me\s+)?(?:about\s+)?(.+?)(?:\s|$)", 
                                r"explain\s+(?:to\s+me\s+)?(?:about\s+)?(.+?)(?:\s|$)",
                                r"about\s+(.+?)(?:\s|$|,|\?|\.)"]:
                    match = re.search(pattern, first_msg)
                    if match:
                        topic = match.group(1).strip()[:100]
                        if topic:
                            return topic
            return user_messages[0][:100] + "..."
        return f"{subject} concepts"

async def generate_flashcards_from_context(topic: str, num: int, context: str):
    """
    Generate flashcards from context with retry logic and robust JSON parsing.
    
    Args:
        topic: Topic for flashcards
        num: Number of flashcards to generate
        context: Context text to use
    
    Returns:
        List of validated flashcard dictionaries
    
    Raises:
        Exception: If LLM fails to return valid JSON after retries
    """
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    prompt = f"""You are an expert science teacher. Using ONLY the CONTEXT below, generate exactly {num} flashcards about "{topic}" as valid JSON and NOTHING else.

CRITICAL: Return ONLY valid JSON. Do not include markdown code fences, explanations, or any other text.

Context:
{context}

Output format (must be valid JSON):
{{"cards":[{{"front":"<<=140 chars>", "back":"<concise answer>", "tags":["tag1"], "source":"docId#chunkIdx", "needs_review": false}}, ...]}}
"""
    
    headers = {"Authorization": f"Bearer {openai_api_key}", "Content-Type": "application/json"}
    model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.3,  # Lower temperature for more consistent JSON
    }
    
    max_retries = 3
    last_error = None
    raw_responses = []
    
    for attempt in range(max_retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(CHAT_COMPLETION_URL, json=payload, headers=headers) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        raise Exception(f"OpenAI API error: {resp.status} - {error_text}")
                    
                    data = await resp.json()
                    if "choices" not in data or len(data["choices"]) == 0:
                        raise Exception(f"Invalid response from OpenAI: {data}")
                    
                    text = data["choices"][0]["message"]["content"]
                    raw_responses.append(text)
                    
                    # Sanitize JSON
                    clean_text = sanitize_json_like(text)
                    
                    # Try to parse JSON
                    try:
                        parsed = json.loads(clean_text)
                    except json.JSONDecodeError as e:
                        # Log for debugging but don't expose full raw text
                        logging.warning(f"JSON parse error (attempt {attempt + 1}/{max_retries}): {str(e)}")
                        logging.debug(f"Raw response (first 500 chars): {text[:500]}")
                        last_error = f"Invalid JSON: {str(e)}"
                        if attempt < max_retries - 1:
                            # Tighten prompt for retry
                            prompt = f"""You MUST return ONLY valid JSON. No markdown, no explanations, no code fences.

Generate exactly {num} flashcards about "{topic}" using this context:

{context}

Return ONLY this JSON structure (no other text):
{{"cards":[{{"front":"question", "back":"answer", "tags":["tag"], "source":"source", "needs_review": false}}]}}
"""
                            payload["messages"] = [{"role": "user", "content": prompt}]
                            continue
                        else:
                            # Last attempt failed
                            raise Exception(f"LLM did not return valid JSON after {max_retries} attempts. Last error: {last_error}")
                    
                    # Validate structure
                    if not isinstance(parsed, dict) or "cards" not in parsed:
                        raise ValueError("Response missing 'cards' key")
                    
                    cards = parsed.get("cards", [])
                    if not isinstance(cards, list):
                        raise ValueError("'cards' must be a list")
                    
                    # Validate and normalize cards using strict Pydantic models
                    validated = []
                    for i, c in enumerate(cards):
                        if not isinstance(c, dict):
                            continue
                        
                        try:
                            # Prepare card data with defaults
                            card_data = {
                                "id": c.get("id") or f"{topic}-{i}",
                                "front": c.get("front", "").strip()[:500],
                                "back": c.get("back", "").strip(),
                                "source": c.get("source", "unknown"),
                                "needs_review": bool(c.get("needs_review", False)) or (c.get("back", "").strip() == ""),
                            }
                            
                            # Add optional fields if present and not None
                            if "tags" in c and c["tags"] is not None:
                                card_data["tags"] = c["tags"]
                            if "image" in c and c["image"] is not None:
                                card_data["image"] = c["image"]
                            
                            # Validate using strict Pydantic model
                            card = Flashcard(**card_data)
                            validated.append(card.model_dump(exclude_none=True))
                        except Exception as e:
                            # Log validation error but continue processing other cards
                            logging.warning(f"Skipping invalid flashcard at index {i}: {e}")
                            continue
                    
                    if len(validated) == 0:
                        raise ValueError("No valid cards generated")
                    
                    return validated
                    
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries - 1:
                logging.warning(f"Flashcard generation attempt {attempt + 1} failed: {e}, retrying...")
                continue
            else:
                # Final attempt failed - include sanitized error info
                error_msg = f"Failed to generate flashcards after {max_retries} attempts: {last_error}"
                if raw_responses:
                    # Include first 200 chars of last raw response for debugging (redacted)
                    error_msg += f" (Last raw response preview: {raw_responses[-1][:200]}...)"
                raise Exception(error_msg)
    
    # Should not reach here, but just in case
    raise Exception(f"Unexpected error generating flashcards: {last_error}")

