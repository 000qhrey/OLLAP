import { NextRequest } from 'next/server';
import { ChatRequestSchema, ChatStreamEventSchema, ChatStreamErrorSchema, ErrorResponseSchema } from '@/lib/api-schemas';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request with Zod
    const validationResult = ChatRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data',
          detail: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, message, subject, max_retrieval_k } = validationResult.data;

    // Proxy the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        message,
        subject,
        max_retrieval_k: max_retrieval_k ?? 5,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return new Response(
        JSON.stringify({ error: `Backend error: ${errorText}` }),
        { status: backendResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response from backend to frontend
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = backendResponse.body?.getReader();
          if (!reader) {
            controller.error(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                // Validate stream event with Zod (strict validation)
                const eventValidation = ChatStreamEventSchema.safeParse(parsed);
                if (eventValidation.success) {
                  // Forward validated event
                  controller.enqueue(encoder.encode(JSON.stringify(eventValidation.data) + '\n'));
                } else {
                  // Log validation error and skip invalid events (strict mode)
                  console.warn('Invalid stream event skipped:', eventValidation.error);
                  // Optionally send error event instead of invalid data
                  const errorEvent = ChatStreamErrorSchema.parse({
                    type: 'error',
                    message: 'Invalid event format from backend',
                    code: 'validation_error'
                  });
                  controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              // Validate stream event with Zod (strict validation)
              const eventValidation = ChatStreamEventSchema.safeParse(parsed);
              if (eventValidation.success) {
                controller.enqueue(encoder.encode(JSON.stringify(eventValidation.data) + '\n'));
              } else {
                // Log validation error and skip invalid events
                console.warn('Invalid stream event in buffer skipped:', eventValidation.error);
              }
            } catch (e) {
              // Ignore parse errors for remaining buffer
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

