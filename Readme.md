# OLLAP - AI-Powered Learning Companion

A Retrieval-Augmented Generation (RAG) application that provides personalized tutoring, interactive chat, and flashcard generation for high school subjects (Mathematics, Physics, Chemistry).



### System Components

```
┌─────────────────┐
│  Next.js Frontend│  (React, TypeScript, Tailwind)
│  Port: 3000      │
└────────┬─────────┘
         │ HTTP/REST
         │
┌────────▼─────────┐
│  FastAPI Backend │  (Python, Uvicorn)
│  Port: 8000      │
└────────┬─────────┘
         │
    ┌────┴────┬──────────────┐
    │         │              │
┌───▼───┐ ┌──▼────┐    ┌─────▼─────┐
│ Qdrant│ │ OpenAI│    │  OpenAI   │
│Vector │ │Embed  │    │   Chat    │
│  DB   │ │ Model │    │   Model   │
└───────┘ └───────┘    └───────────┘
```

## Design Decisions

The architecture follows a straightforward RAG pattern with a few intentional choices that balance simplicity with effectiveness. We opted for subject-specific vector collections in Qdrant rather than a single unified collection, which allows for cleaner separation of knowledge domains and makes it easier to manage and query subject-specific content. This approach also simplifies the retrieval process since we don't need to filter by subject after the fact—the collection itself acts as the filter.

Streaming responses were implemented from day one using Server-Sent Events (SSE), which provides a better user experience than waiting for complete responses. The frontend handles token-by-token updates, giving users immediate feedback that the system is working. We chose LlamaIndex for document chunking and retrieval because it abstracts away much of the complexity around embedding management and provides a clean API for both ingestion and querying, even if it adds a slight dependency overhead.

Session state lives entirely in browser localStorage, which means sessions persist across page refreshes but don't sync across devices. This tradeoff was assumed to be acceptable for an MVP focused on individual learning sessions rather than multi-device continuity.

The flashcard generation system extracts topics from chat context when not explicitly provided, making it feel more integrated with the conversation flow. We validate flashcards using Pydantic models with retry logic, which helps handle the occasional JSON parsing issues that arise when working with LLM outputs. The system also includes basic deduplication logic in the chat responses to prevent the model from repeating itself, though this is a heuristic approach rather than a perfect solution.

## What We Chose Not to Build (and Why)

Several features that would enhance the platform were intentionally left out, primarily due to scope and complexity considerations. User authentication and accounts were skipped entirely, it significantly reduces development time and removes barriers to entry. Users can start learning immediately without any signup process.

We didn't implement persistent backend storage for chat sessions. All session data lives in the browser's localStorage, which means sessions are device-specific and can be lost if users clear their browser data. A proper database-backed session system would require user accounts, session management, and additional API endpoints, which felt like scope creep for an MVP.

Advanced flashcard features like spaced repetition algorithms, difficulty tracking, and long-term retention analytics weren't built. The current system generates flashcards on-demand but doesn't track which ones users have mastered or optimize review schedules. Implementing proper spaced repetition would require persistent storage, user tracking, and algorithmic complexity that goes beyond the core RAG functionality.

Multi-modal support was left out—the system only handles text documents (PDFs and plain text). Images, diagrams, and mathematical formulas embedded in documents aren't extracted or displayed, which limits the richness of the learning materials. Supporting images would require OCR, image embedding models, and more complex document parsing pipelines.

Collaborative features like shared sessions, study groups, or teacher dashboards weren't considered. The platform is designed as a personal learning companion rather than a collaborative learning environment. Adding collaboration would require user management, permissions, real-time synchronization, and significantly more complex state management.

## Tradeoffs Due to Time

The chunking strategy is relatively basic—documents are split by character count with some overlap, but we don't use semantic chunking that would group related concepts together more intelligently. This means some chunks might split concepts awkwardly, though in practice the retrieval system handles this reasonably well.

Retrieval uses simple vector similarity search without hybrid approaches like combining dense embeddings with keyword matching or reranking. A more sophisticated retrieval pipeline might improve relevance, but the current approach works well enough for most queries and keeps the system simple to maintain.

There's no caching layer for common queries or retrieved chunks. Every chat request hits the vector database and the LLM API

Error handling is functional but not comprehensive. The system gracefully degrades when services are unavailable (returning empty results rather than crashing), but error messages could be more informative and recovery mechanisms more robust. Production systems would benefit from structured logging, error tracking, and more detailed user-facing error messages.

The UI is functional but not polished. While it uses a modern component library and follows basic design principles, there's room for improvement in animations, loading states, accessibility features, and overall polish. The focus was on getting core functionality working rather than pixel-perfect design.

Testing infrastructure wasn't set up—there are no unit tests, integration tests, or end-to-end tests.

Document format support is limited to PDFs and plain text files. More advanced formats like Word documents, LaTeX files, or structured data formats weren't implemented. The PDF extraction also uses a basic approach that might struggle with complex layouts or scanned documents, though it handles most standard PDFs reasonably well.


