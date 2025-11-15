# app/models.py
"""
Strict Pydantic models for request/response validation.
These models use strict mode to prevent JSON drift and ensure type safety.
"""
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import List, Optional, Literal
from enum import Enum


# ============================================================================
# Base Configuration
# ============================================================================

class StrictBaseModel(BaseModel):
    """Base model with strict validation enabled."""
    model_config = ConfigDict(
        strict=True,
        extra='forbid',  # Reject extra fields
        validate_assignment=True,  # Validate on assignment
        use_enum_values=True,
    )


# ============================================================================
# Chat API Models
# ============================================================================

class ChatRequest(StrictBaseModel):
    """Request model for chat endpoint."""
    session_id: Optional[str] = Field(None, min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=10000, description="User message")
    subject: str = Field(..., min_length=1, max_length=100, description="Subject name")
    max_retrieval_k: Optional[int] = Field(5, ge=1, le=20, description="Number of retrieval results")
    syllabus_hints: Optional[str] = Field(None, max_length=1000, description="Optional syllabus hints")

    @field_validator('subject')
    @classmethod
    def validate_subject(cls, v: str) -> str:
        """Normalize subject to lowercase."""
        return v.lower().strip()


class ChatStreamDelta(StrictBaseModel):
    """Delta event in chat stream."""
    type: Literal['delta'] = Field(..., description="Event type")
    token: str = Field(..., min_length=1, description="Token content")


class ChatStreamError(StrictBaseModel):
    """Error event in chat stream."""
    type: Literal['error'] = Field(..., description="Event type")
    message: str = Field(..., min_length=1, description="Error message")
    code: Optional[str] = Field(None, max_length=100, description="Error code")


class ChatStreamDone(StrictBaseModel):
    """Done event in chat stream."""
    type: Literal['done'] = Field(..., description="Event type")


# Union type for stream events (discriminated union)
ChatStreamEvent = ChatStreamDelta | ChatStreamError | ChatStreamDone


# ============================================================================
# Flashcards API Models
# ============================================================================

class Flashcard(StrictBaseModel):
    """Flashcard model."""
    id: str = Field(..., min_length=1, max_length=200, description="Flashcard ID")
    front: str = Field(..., min_length=1, max_length=500, description="Front side of flashcard")
    back: str = Field(..., min_length=1, description="Back side of flashcard")
    tags: Optional[List[str]] = Field(None, description="Tags for the flashcard")
    source: Optional[str] = Field(None, max_length=200, description="Source document reference")
    needs_review: Optional[bool] = Field(False, description="Whether flashcard needs review")
    image: Optional[str] = Field(None, max_length=10000, description="Optional image URL or data URI")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate and normalize tags."""
        if v is None:
            return None
        # Filter out empty tags and limit length
        validated = [tag.strip()[:50] for tag in v if tag.strip()]
        return validated[:20] if validated else None  # Max 20 tags


class ChatMessage(StrictBaseModel):
    """Chat message model for context extraction."""
    role: str = Field(..., description="Message role (user or assistant)")
    content: str = Field(..., min_length=1, max_length=10000, description="Message content")


class FlashcardRequest(StrictBaseModel):
    """Request model for flashcard generation."""
    topic: Optional[str] = Field(None, description="Topic for flashcards (optional if chat_context provided)")
    subject: str = Field(..., min_length=1, max_length=100, description="Subject name")
    num: Optional[int] = Field(8, ge=1, le=50, description="Number of flashcards to generate")
    syllabus_hints: Optional[str] = Field(None, max_length=1000, description="Optional syllabus hints")
    chat_context: Optional[List[ChatMessage]] = Field(None, description="Chat conversation history for context extraction")

    @field_validator('subject')
    @classmethod
    def validate_subject(cls, v: str) -> str:
        """Normalize subject to lowercase."""
        return v.lower().strip()
    
    @field_validator('topic')
    @classmethod
    def validate_topic_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate topic length if provided."""
        if v is not None:
            v = v.strip()
            if len(v) < 1 or len(v) > 500:
                raise ValueError("Topic must be between 1 and 500 characters")
        return v
    
    @model_validator(mode='after')
    def validate_topic_or_context(self):
        """Ensure either topic or chat_context is provided."""
        if not self.topic and (not self.chat_context or len(self.chat_context) == 0):
            raise ValueError("Either 'topic' or 'chat_context' must be provided")
        return self


class FlashcardResponse(StrictBaseModel):
    """Response model for flashcard generation."""
    cards: List[Flashcard] = Field(..., min_length=1, max_length=50, description="Generated flashcards")


# ============================================================================
# Subjects API Models
# ============================================================================

class SubjectsResponse(StrictBaseModel):
    """Response model for subjects list."""
    subjects: List[str] = Field(..., description="List of available subjects")
    count: int = Field(..., ge=0, description="Number of subjects")

    @field_validator('subjects')
    @classmethod
    def validate_subjects(cls, v: List[str]) -> List[str]:
        """Validate and normalize subject names."""
        return [s.strip().lower() for s in v if s.strip()]


# ============================================================================
# Ingest API Models
# ============================================================================

class IngestRequest(StrictBaseModel):
    """Request model for document ingestion."""
    doc_id: str = Field(..., min_length=1, max_length=200, description="Document ID")
    title: Optional[str] = Field(None, max_length=500, description="Document title")
    text: str = Field(..., min_length=1, description="Document text content")
    subject: str = Field(..., min_length=1, max_length=100, description="Subject name")

    @field_validator('subject')
    @classmethod
    def validate_subject(cls, v: str) -> str:
        """Normalize subject to lowercase."""
        return v.lower().strip()


class IngestResponse(StrictBaseModel):
    """Response model for document ingestion."""
    ok: bool = Field(..., description="Success status")
    upserted: int = Field(..., ge=0, description="Number of chunks upserted")
    subject: str = Field(..., min_length=1, description="Subject name")


class BatchIngestResult(StrictBaseModel):
    """Result item for batch ingestion."""
    doc_id: str = Field(..., min_length=1, max_length=200)
    file: str = Field(..., min_length=1, max_length=500)
    title: str = Field(..., min_length=1, max_length=500)
    upserted: int = Field(..., ge=0)


class BatchIngestError(StrictBaseModel):
    """Error item for batch ingestion."""
    file: str = Field(..., min_length=1, max_length=500)
    error: str = Field(..., min_length=1, max_length=1000)


class BatchIngestResponse(StrictBaseModel):
    """Response model for batch ingestion."""
    ok: bool = Field(..., description="Success status")
    subject: str = Field(..., min_length=1, description="Subject name")
    processed: int = Field(..., ge=0, description="Number of files processed")
    results: List[BatchIngestResult] = Field(..., description="Processing results")
    errors: List[BatchIngestError] = Field(..., description="Processing errors")


class UploadIngestResponse(StrictBaseModel):
    """Response model for upload ingestion."""
    ok: bool = Field(..., description="Success status")
    doc_id: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=500)
    filename: str = Field(..., min_length=1, max_length=500)
    subject: str = Field(..., min_length=1, description="Subject name")
    upserted: int = Field(..., ge=0, description="Number of chunks upserted")
    chunks: int = Field(..., ge=0, description="Number of chunks created")
    message: str = Field(..., min_length=1, max_length=500)


# ============================================================================
# Documents Structure API Models
# ============================================================================

class DocumentFile(StrictBaseModel):
    """Document file information."""
    name: str = Field(..., min_length=1, max_length=500)
    path: str = Field(..., min_length=1, max_length=1000)
    size: int = Field(..., ge=0)


class DocumentsStructureResponse(StrictBaseModel):
    """Response model for documents structure."""
    structure: dict[str, List[DocumentFile]] = Field(..., description="Structure organized by subject")


# ============================================================================
# Health Check Models
# ============================================================================

class HealthStatus(str, Enum):
    """Health status enum."""
    OK = "ok"
    DEGRADED = "degraded"
    ERROR = "error"


class ServiceStatus(StrictBaseModel):
    """Service status information."""
    status: str = Field(..., min_length=1, max_length=100)
    services: dict[str, str] = Field(..., description="Service statuses")


# ============================================================================
# Error Response Models
# ============================================================================

class ErrorResponse(StrictBaseModel):
    """Standard error response model."""
    error: str = Field(..., min_length=1, max_length=1000, description="Error message")
    detail: Optional[str] = Field(None, max_length=2000, description="Detailed error information")
    code: Optional[str] = Field(None, max_length=100, description="Error code")

