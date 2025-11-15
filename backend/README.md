# FastAPI RAG Backend

A FastAPI backend implementing a Retrieval-Augmented Generation (RAG) pipeline for document ingestion, chat, and flashcard generation.

## Features

- **Document Ingestion**: Chunk and embed documents (PDF/plain text) → upsert into Qdrant vector store
- **RAG Chat**: Retrieve top-K relevant chunks and stream LLM responses with context
- **Flashcard Generation**: Generate validated JSON flashcards from retrieved context
- **Streaming Responses**: Server-Sent Events (SSE) for real-time chat streaming

## Architecture

```
Frontend (Next.js TS)
⇅ HTTPS
FastAPI (Uvicorn) — API layer

/ingest → chunk & embed → upsert → Qdrant
/chat → retrieve → call LLM (streaming) → stream tokens to frontend
/flashcards → retrieve → call LLM for JSON → parse & validate → return
/session, /feedback, /health

Vector DB: Qdrant (local or cloud)
Embeddings: OpenAI embeddings
LLM: OpenAI Chat Completions (streaming)
```

## Prerequisites

- Python 3.11+
- Qdrant running (local or cloud)
- OpenAI API key

## Setup

1. **Install dependencies**:
   ```bash
   # Option 1: Using pip with pyproject.toml
   pip install -e .
   
   # Option 2: Using requirements.txt
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   Create a `.env` file in the backend directory with:
   ```bash
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_CHAT_MODEL=gpt-4o-mini
   OPENAI_EMBED_MODEL=text-embedding-3-small

   # Qdrant Configuration
   QDRANT_HOST=localhost
   QDRANT_PORT=6333
   QDRANT_COLLECTION=docs
   ```

3. **Start Qdrant** (if running locally):
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

4. **Run the server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   Or use the entry point:
   ```bash
   python main.py
   ```

## API Endpoints

### POST `/api/ingest`
Ingest a document into the vector store for a specific subject.

**Request**:
```json
{
  "doc_id": "string",
  "title": "string",
  "text": "string",
  "subject": "maths"  // Required: maths, physics, chemistry, etc.
}
```

**Response**:
```json
{
  "ok": true,
  "upserted": 12,
  "subject": "maths"
}
```

### POST `/api/chat` (streamed)
Chat with RAG context from a specific subject. Returns streaming text/event-stream.

**Request**:
```json
{
  "session_id": "optional-string",
  "message": "user text",
  "subject": "maths",  // Required: which subject to query
  "max_retrieval_k": 5,
  "syllabus_hints": "optional text"
}
```

**Response**: Streaming newline-delimited JSON:
```
{"type":"delta","token":"first chunk"}
{"type":"delta","token":"next chunk"}
{"type":"done","messageId":"msg-123"}
```

### POST `/api/flashcards`
Generate flashcards from retrieved context for a specific subject.

**Request**:
```json
{
  "topic": "string",
  "subject": "maths",  // Required: which subject to query
  "num": 8,
  "syllabus_hints": "optional"
}
```

**Response**:
```json
{
  "cards": [
    {
      "id": "...",
      "front": "...",
      "back": "...",
      "tags": ["..."],
      "source": "docId#chunkIdx",
      "needs_review": false
    }
  ]
}
```

### GET `/api/subjects`
List all available subjects (from documents folder and Qdrant collections).

**Response**:
```json
{
  "subjects": ["maths", "physics", "chemistry"],
  "count": 3
}
```

### GET `/api/documents/structure`
Get the structure of the documents folder organized by subject.

**Response**:
```json
{
  "structure": {
    "maths": [
      {"name": "book1.pdf", "path": "documents/maths/book1.pdf", "size": 12345}
    ],
    "physics": [...]
  }
}
```

### POST `/api/ingest/upload`
Upload and ingest a document file directly via multipart/form-data.

**Form Data**:
- `file` (required): The document file (.pdf, .txt, .md)
- `subject` (required): Subject name (e.g., "maths", "physics")
- `doc_id` (optional): Document ID (defaults to filename without extension)
- `title` (optional): Document title (defaults to filename)
- `skip_existing` (optional): Skip if document already exists (default: false)

**Example using curl**:
```bash
curl -X POST "http://localhost:8000/api/ingest/upload" \
  -F "file=@document.pdf" \
  -F "subject=maths" \
  -F "title=Mathematics Textbook"
```

**Example using JavaScript (FormData)**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('subject', 'maths');
formData.append('title', 'My Document');

const response = await fetch('http://localhost:8000/api/ingest/upload', {
  method: 'POST',
  body: formData
});
```

**Response**:
```json
{
  "ok": true,
  "doc_id": "document",
  "title": "Document",
  "filename": "document.pdf",
  "subject": "maths",
  "upserted": 45,
  "chunks": 45,
  "message": "Document ingested successfully"
}
```

### POST `/api/ingest/batch`
Batch ingest all documents from a subject folder.

**Query Parameters**:
- `subject` (required): Subject name (e.g., "maths", "physics")
- `doc_id_prefix` (optional): Prefix for document IDs (defaults to subject name)

**Example**:
```
POST /api/ingest/batch?subject=maths
```

**Response**:
```json
{
  "ok": true,
  "subject": "maths",
  "processed": 3,
  "results": [
    {
      "doc_id": "maths_book1",
      "file": "book1.pdf",
      "title": "Book1",
      "upserted": 45
    }
  ],
  "errors": []
}
```

### GET `/api/health`
Health check endpoint.

**Response**:
```json
{
  "status": "ok"
}
```

## Project Structure

```
backend/
├── documents/           # Documents organized by subject
│   ├── maths/          # Maths documents
│   ├── physics/        # Physics documents
│   └── chemistry/      # Chemistry documents
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   ├── ingest.py        # Document chunking and upsert (subject-specific)
│   ├── embeddings.py    # OpenAI embedding calls
│   ├── retriever.py     # Qdrant retrieval (subject-specific)
│   ├── llm.py           # OpenAI chat completion (streaming)
│   ├── flashcards.py    # Flashcard generation and validation
│   └── batch_ingest.py  # Batch document processing utilities
├── main.py              # Entry point
├── pyproject.toml       # Dependencies
├── requirements.txt     # Alternative dependencies file
└── README.md
```

## Data Persistence

**Important**: All ingested documents are permanently stored in Qdrant. Once a document is ingested, it persists across server restarts and does NOT need to be re-ingested.

- **Qdrant Persistence**: Qdrant stores data on disk (when running via Docker, data persists in volumes)
- **No Re-ingestion**: Documents are only ingested once - subsequent ingestion requests for the same document will be skipped (when using `skip_existing=True`)
- **Upsert Behavior**: Using `upsert` ensures that if you re-ingest the same document, it will update existing chunks rather than creating duplicates
- **Collection Persistence**: Collections persist permanently - they are only created if they don't exist, never recreated (which would delete data)

## Multi-Subject Support

The backend supports multiple subjects, each with its own Qdrant collection:

- **Subject Collections**: Each subject (maths, physics, chemistry, etc.) has its own Qdrant collection
- **Documents Folder**: Organize documents in `documents/{subject}/` folders
- **Subject Selection**: All query endpoints require a `subject` parameter to specify which collection to use
- **Batch Ingestion**: Use `/api/ingest/batch?subject=maths` to ingest all documents from a subject folder (automatically skips already-ingested documents)

### Setting Up Documents

1. Create subject folders in the `documents/` directory:
   ```bash
   mkdir -p documents/maths documents/physics documents/chemistry
   ```

2. Place PDF or text files in the appropriate subject folders

3. Batch ingest documents:
   ```bash
   curl -X POST "http://localhost:8000/api/ingest/batch?subject=maths"
   ```

4. Query by subject:
   ```bash
   curl -X POST "http://localhost:8000/api/chat" \
     -H "Content-Type: application/json" \
     -d '{"message": "What is calculus?", "subject": "maths"}'
   ```

## Development

The server runs with auto-reload enabled in development mode. Make changes to the code and they will be automatically reflected.

## Security Notes

- Store all secret keys in `.env` file (not committed to git)
- In production, configure CORS middleware with specific origins
- Consider adding rate limiting middleware
- Use environment-specific configurations

