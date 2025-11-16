# app/main.py
import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from app.models import (
    IngestRequest, IngestResponse,
    ChatRequest, ChatStreamDelta, ChatStreamError, ChatStreamDone,
    FlashcardRequest, FlashcardResponse, Flashcard,
    SubjectsResponse,
    BatchIngestResponse, BatchIngestResult, BatchIngestError,
    UploadIngestResponse,
    DocumentsStructureResponse, DocumentFile,
    ServiceStatus, HealthStatus,
    ErrorResponse,
)
from app.ingest import upsert_document, get_collection_name
from app.retriever import retrieve_matches
from app.llm import stream_chat_completion
from app.flashcards import generate_flashcards_from_context
from app.batch_ingest import scan_documents_folder, process_document_file, extract_text_from_pdf
from pathlib import Path
import tempfile

# Load environment variables
load_dotenv()

app = FastAPI(title="RAG Backend API", version="1.0.0")

# CORS middleware for frontend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
# In production, use specific origin; in development allow localhost
allow_origins = [frontend_url]
if os.getenv("ENVIRONMENT", "development") == "development":
    # Allow common localhost ports in development
    allow_origins.extend([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest) -> IngestResponse:
    """Ingest a document into the vector store."""
    # LlamaIndex handles chunking internally
    upsert_count = await upsert_document(req.doc_id, req.title or "", req.text, req.subject)
    return IngestResponse(ok=True, upserted=upsert_count, subject=req.subject)

@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Chat with RAG context from a specific subject."""
    # 1) retrieve
    matches = await retrieve_matches(req.message, req.subject, top_k=req.max_retrieval_k or 5)
    context = "\n\n---\n\n".join([f"[[source:{m['id']}]]\n{m['payload']['text']}" for m in matches])

    # Personalize tutor based on subject
    tutor_name = "ollap"
    tutor_persona = "an expert high-school tutor"
    
    subject_lower = req.subject.lower()
    if subject_lower == "chemistry":
        tutor_name = "Abel"
        tutor_persona = "an expert chemistry teacher named Abel. You are friendly, patient, and passionate about chemistry. You explain concepts clearly and use examples to help students understand."
    elif subject_lower == "mathematics" or subject_lower == "maths" or subject_lower == "math":
        tutor_name = "John"
        tutor_persona = "an expert mathematics teacher named John. You are enthusiastic, methodical, and patient. You break down complex problems into manageable steps and help students build their problem-solving skills."
    elif subject_lower == "science" or subject_lower == "physics" or subject_lower == "biology":
        tutor_name = "Chris"
        tutor_persona = "an expert Physics teacher named Chris. You are curious, engaging, and make science accessible. You connect concepts to real-world applications and help students see the wonder in scientific discovery."
    
    system_prompt = f"""You are {tutor_persona}. Answer user questions ONLY using the provided CONTEXT snippets below. Each snippet includes a source tag like [[source:docId#chunkIdx]]. If the answer can be constructed from the context, provide a complete, accurate, and well-structured explanation. Include inline citations referencing the snippet(s) used. If you cannot find sufficient information in the provided context, reply exactly: "I don't know based on provided materials." Do not invent facts.

CRITICAL RESPONSE REQUIREMENTS:
1. **COMPLETE RESPONSES**: Always finish your explanation completely. Never cut off mid-sentence or leave explanations incomplete. Ensure all examples, steps, and conclusions are fully presented.
2. **ABSOLUTELY NO REPETITION**: NEVER repeat the same content, paragraph, or explanation twice. Each concept, fact, or explanation should appear EXACTLY ONCE in your response. Do not restate the same information using different words. Do not include duplicate sections. If you find yourself repeating something, STOP and move on to the next point.
3. **ACCURACY**: Use exact formulas, definitions, and terminology from the context. Double-check mathematical expressions and ensure they match the source material exactly.
4. **STRUCTURE**: Organize your response logically:
   - Start with a clear definition or overview
   - Explain key concepts step-by-step
   - Provide worked examples when relevant
   - Conclude with practical applications or important notes

CRITICAL: When explaining concepts, ALWAYS provide:
1. **Intuition-based explanations**: Help students understand the "why" behind concepts, not just the "what"
2. **Real-world examples or analogies**: Connect abstract concepts to everyday experiences or familiar situations
3. **Step-by-step reasoning**: Break down complex ideas into understandable parts

For mathematical and statistical concepts (like regression, correlation, probability, etc.):
- Start with the core definition and purpose
- Explain the key components and what they represent
- Show the formulas clearly with proper notation
- Provide step-by-step calculation methods
- Include worked examples with clear explanations
- Explain interpretation and practical applications
- Mention important limitations or considerations

For example:
- When explaining chemical reactions, use analogies like cooking or building with blocks
- When explaining math concepts, use real-world scenarios like shopping, sports, or construction
- When explaining physics, relate to everyday phenomena like throwing a ball or riding a bike

Format your responses clearly with proper paragraphs, bullet points, or numbered lists when appropriate. Use markdown formatting for better readability:
- **Bold** for key terms and definitions
- *Italics* for emphasis
- Use headers (##, ###) to organize sections
- Use numbered lists for step-by-step procedures
- Use bullet points for lists of concepts or examples

CRITICAL: For mathematical formulas and chemical equations, you MUST use proper LaTeX math notation with special delimiters.
- For inline formulas (within a sentence), wrap them like this: <<< formula >>>
- For display formulas (standalone, centered), wrap them like this: <<< formula >>>
- Examples:
  - Inline: The variable <<< y >>> represents the dependent variable.
  - Display: <<< y = a + bx >>>
  - With subscripts: <<< S_{{xy}} >>>
  - With fractions: <<< \\frac{{S_{{xy}}}}{{S_{{xx}}}} >>>
- Always use proper LaTeX syntax with correct brace grouping for subscripts and superscripts.
- Never use $ signs - always use <<< >>> delimiters for all math formulas.

CONTEXT:
{context}

USER QUESTION:
{req.message}
"""

    # 2) stream using OpenAI style streaming and pipe to client
    async def event_stream():
        try:
            async for chunk in stream_chat_completion(system_prompt, req.message):
                # Validate chunk structure before sending
                try:
                    if chunk.get("type") == "delta":
                        event = ChatStreamDelta(**chunk)
                    elif chunk.get("type") == "error":
                        event = ChatStreamError(**chunk)
                    elif chunk.get("type") == "done":
                        event = ChatStreamDone(**chunk)
                    else:
                        # Invalid type, skip or convert to error
                        event = ChatStreamError(type="error", message="Invalid event type", code="invalid_type")
                    yield (json.dumps(event.model_dump(exclude_none=True)) + "\n")
                except Exception as e:
                    # If validation fails, send error event
                    error_event = ChatStreamError(type="error", message="Invalid event format", code="validation_error")
                    yield (json.dumps(error_event.model_dump(exclude_none=True)) + "\n")
        except Exception as e:
            # If streaming fails, send error message
            error_event = ChatStreamError(type="error", message="Error during chat completion", code="stream_error")
            yield json.dumps(error_event.model_dump(exclude_none=True)) + "\n"
            done_event = ChatStreamDone(type="done")
            yield json.dumps(done_event.model_dump(exclude_none=True)) + "\n"
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

@app.post("/api/flashcards", response_model=FlashcardResponse)
async def flashcards(req: FlashcardRequest) -> FlashcardResponse:
    """Generate flashcards from retrieved context for a specific subject."""
    # Extract topic from chat context if not provided
    topic = req.topic
    if not topic and req.chat_context:
        from app.flashcards import extract_topic_from_chat_context
        topic = await extract_topic_from_chat_context(req.chat_context, req.subject)
    
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required. Either provide 'topic' or 'chat_context'.")
    
    matches = await retrieve_matches(topic, req.subject, top_k=8)
    context = "\n\n---\n\n".join([f"[[source:{m['id']}]]\n{m['payload']['text']}" for m in matches])
    cards_raw = await generate_flashcards_from_context(topic=topic, num=req.num or 8, context=context)
    
    # Validate and convert cards to strict models
    validated_cards = []
    for card_data in cards_raw:
        try:
            card = Flashcard(**card_data)
            validated_cards.append(card)
        except Exception as e:
            # Skip invalid cards, log error
            import logging
            logging.warning(f"Skipping invalid flashcard: {e}")
            continue
    
    if not validated_cards:
        raise HTTPException(status_code=500, detail="No valid flashcards generated")
    
    return FlashcardResponse(cards=validated_cards)

@app.get("/api/subjects", response_model=SubjectsResponse)
async def list_subjects() -> SubjectsResponse:
    """List available subjects by scanning documents folder and Qdrant collections."""
    from pathlib import Path
    from qdrant_client import QdrantClient
    
    subjects_from_folder = set()
    documents_path = Path("documents")
    
    if documents_path.exists():
        # Scan documents folder for subfolders
        for item in documents_path.iterdir():
            if item.is_dir():
                subjects_from_folder.add(item.name.lower())
    
    # Also check Qdrant collections
    subjects_from_collections = set()
    try:
        client = QdrantClient(
            host=os.getenv("QDRANT_HOST", "localhost"),
            port=int(os.getenv("QDRANT_PORT", "6333"))
        )
        # Handle different Qdrant client API versions
        try:
            collections_response = client.get_collections()
            # Handle both .collections attribute and direct list
            if hasattr(collections_response, 'collections'):
                collections = collections_response.collections
            else:
                collections = collections_response
        except Exception:
            # Fallback: try direct call
            collections = client.get_collections()
        
        base_prefix = os.getenv("QDRANT_COLLECTION_PREFIX", "")
        for coll in collections:
            # Handle both object with .name attribute and string
            if hasattr(coll, 'name'):
                coll_name = coll.name
            else:
                coll_name = str(coll)
            
            # Extract subject name from collection (remove prefix if any)
            if base_prefix and coll_name.startswith(f"{base_prefix}_"):
                subject = coll_name[len(f"{base_prefix}_"):]
                subjects_from_collections.add(subject)
            else:
                subjects_from_collections.add(coll_name)
    except Exception as e:
        # Log error but don't fail the endpoint
        import logging
        logging.warning(f"Error fetching Qdrant collections: {e}")
        pass
    
    # Combine and sort
    all_subjects = sorted(subjects_from_folder | subjects_from_collections)
    
    return SubjectsResponse(subjects=all_subjects, count=len(all_subjects))

@app.get("/api/documents/structure", response_model=DocumentsStructureResponse)
async def get_documents_structure() -> DocumentsStructureResponse:
    """Get the structure of documents folder organized by subject."""
    structure_raw = await scan_documents_folder()
    
    # Validate and convert structure to strict models
    validated_structure: dict[str, List[DocumentFile]] = {}
    for subject, files in structure_raw.items():
        validated_files = []
        for file_data in files:
            try:
                file_obj = DocumentFile(**file_data)
                validated_files.append(file_obj)
            except Exception as e:
                import logging
                logging.warning(f"Skipping invalid file entry: {e}")
                continue
        if validated_files:
            validated_structure[subject] = validated_files
    
    return DocumentsStructureResponse(structure=validated_structure)

@app.post("/api/ingest/batch", response_model=BatchIngestResponse)
async def batch_ingest(subject: str, doc_id_prefix: Optional[str] = None) -> BatchIngestResponse:
    """
    Batch ingest all documents from a subject folder.
    
    Query parameters:
        subject: Subject name (e.g., "maths", "physics") - REQUIRED
        doc_id_prefix: Optional prefix for document IDs (defaults to subject name)
    """
    try:
        if not subject or not subject.strip():
            raise HTTPException(status_code=400, detail="subject query parameter is required")
        
        subject = subject.strip().lower()
        
        documents_path = Path("documents") / subject
        if not documents_path.exists():
            raise HTTPException(status_code=404, detail=f"Subject folder '{subject}' not found in documents folder")
        
        if not doc_id_prefix:
            doc_id_prefix = subject
        
        # Get list of files first
        files = [f for f in documents_path.iterdir() if f.is_file()]
        
        if not files:
            return BatchIngestResponse(
                ok=True,
                subject=subject,
                processed=0,
                results=[],
                errors=[BatchIngestError(file="", error="No files found in subject folder")]
            )
        
        results: List[BatchIngestResult] = []
        errors: List[BatchIngestError] = []
        
        # Process all files (no progress bar in HTTP context)
        for file_path in files:
            try:
                # Extract text from document (disable progress bars in HTTP context)
                text = await process_document_file(file_path, show_progress=False)
                if not text:
                    errors.append(BatchIngestError(file=file_path.name, error="Unsupported file type or empty content"))
                    continue
                
                # Generate doc_id from filename
                doc_id = f"{doc_id_prefix}_{file_path.stem}"
                title = file_path.stem.replace("_", " ").title()
                
                # Upsert document (LlamaIndex handles chunking internally)
                # skip_existing=True to avoid re-ingesting already processed documents
                upsert_count = await upsert_document(doc_id, title, text, subject, skip_existing=True, show_progress=False)
                
                results.append(BatchIngestResult(
                    doc_id=doc_id,
                    file=file_path.name,
                    title=title,
                    upserted=upsert_count
                ))
            except Exception as e:
                error_msg = str(e)[:1000]  # Limit error message length
                errors.append(BatchIngestError(file=file_path.name, error=error_msg))
        
        return BatchIngestResponse(
            ok=True,
            subject=subject,
            processed=len(results),
            results=results,
            errors=errors
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during batch ingestion: {str(e)}")

@app.post("/api/ingest/upload", response_model=UploadIngestResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(...),
    doc_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    skip_existing: bool = Form(False)
) -> UploadIngestResponse:
    """
    Upload and ingest a document file directly.
    
    Supports: PDF (.pdf), Text (.txt, .md)
    
    Form data:
        file: The document file to upload (required)
        subject: Subject name (e.g., "maths", "physics") - REQUIRED
        doc_id: Optional document ID (defaults to filename without extension)
        title: Optional document title (defaults to filename)
        skip_existing: If True, skip if document already exists (default: False)
    """
    if not subject or not subject.strip():
        raise HTTPException(status_code=400, detail="subject parameter is required")
    
    subject = subject.strip().lower()
    
    # Validate file type
    filename = file.filename or ""
    file_ext = Path(filename).suffix.lower()
    if file_ext not in ['.pdf', '.txt', '.md']:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Supported types: .pdf, .txt, .md"
        )
    
    # Generate doc_id and title if not provided
    if not doc_id:
        doc_id = Path(filename).stem if filename else "uploaded_doc"
    doc_id = doc_id.strip()[:200]  # Limit length
    
    if not title:
        title = Path(filename).stem.replace("_", " ").title() if filename else "Uploaded Document"
    title = title.strip()[:500]  # Limit length
    
    try:
        # Read file content
        contents = await file.read()
        
        # Extract text based on file type
        text = None
        if file_ext == '.pdf':
            # Save to temporary file for PDF processing
            # Use TemporaryDirectory context manager for better cleanup
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir) / f"upload_{filename or 'temp'}.pdf"
                tmp_path.write_bytes(contents)
                
                # Disable progress bars in HTTP context
                text = await extract_text_from_pdf(tmp_path, show_progress=False)
                # File is automatically cleaned up when exiting context manager
        elif file_ext in ['.txt', '.md']:
            # Process text file directly from memory
            text = contents.decode('utf-8')
        
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="File appears to be empty or could not extract text")
        
        # Upsert document (LlamaIndex handles chunking internally)
        upsert_count = await upsert_document(doc_id, title, text, subject, skip_existing=skip_existing, show_progress=False)
        
        # Estimate chunk count for response
        from app.ingest import text_splitter
        chunks = text_splitter.split_text(text)
        
        message = "Document ingested successfully" if upsert_count > 0 else "Document already exists (skipped)"
        
        return UploadIngestResponse(
            ok=True,
            doc_id=doc_id,
            title=title,
            filename=filename,
            subject=subject,
            upserted=upsert_count,
            chunks=len(chunks),
            message=message
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/health", response_model=ServiceStatus)
async def health() -> ServiceStatus:
    """Health check endpoint that verifies connectivity to dependencies."""
    services: dict[str, str] = {}
    status = "ok"
    
    # Check Qdrant connectivity
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(
            host=os.getenv("QDRANT_HOST", "localhost"),
            port=int(os.getenv("QDRANT_PORT", "6333"))
        )
        # Try to list collections as a connectivity test
        client.get_collections()
        services["qdrant"] = "ok"
    except Exception as e:
        error_msg = str(e)[:100]  # Limit error message length
        services["qdrant"] = f"error: {error_msg}"
        status = "degraded"
    
    # Check OpenAI API key is set
    if os.getenv("OPENAI_API_KEY"):
        services["openai"] = "configured"
    else:
        services["openai"] = "not_configured"
        status = "degraded"
    
    return ServiceStatus(status=status, services=services)

