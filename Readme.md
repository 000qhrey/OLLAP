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


