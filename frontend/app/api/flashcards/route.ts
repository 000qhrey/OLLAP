import { NextRequest, NextResponse } from 'next/server';
import { FlashcardRequestSchema, FlashcardResponseSchema, ErrorResponseSchema } from '@/lib/api-schemas';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request with Zod
    const validationResult = FlashcardRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          detail: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    const { topic, num, subject, syllabus_hints, chat_context } = validationResult.data;

    // Proxy the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/flashcards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        subject,
        num: num ?? 8,
        syllabus_hints,
        chat_context,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      // Try to parse as error response
      try {
        const errorData = JSON.parse(errorText);
        const errorValidation = ErrorResponseSchema.safeParse(errorData);
        if (errorValidation.success) {
          return NextResponse.json(errorValidation.data, { status: backendResponse.status });
        }
      } catch {
        // Not JSON, use raw text
      }
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    
    // Validate response with Zod
    const responseValidation = FlashcardResponseSchema.safeParse(data);
    if (!responseValidation.success) {
      console.error('Invalid flashcard response from backend:', responseValidation.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend' },
        { status: 500 }
      );
    }

    return NextResponse.json(responseValidation.data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

