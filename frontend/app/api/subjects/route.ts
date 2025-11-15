import { NextResponse } from 'next/server';
import { SubjectsResponseSchema, ErrorResponseSchema } from '@/lib/api-schemas';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/subjects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Next.js API)',
        'Accept': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      
      // Check if Cloudflare challenge page
      if (errorText.includes('Just a moment') || errorText.includes('challenge-platform')) {
        return NextResponse.json(
          { error: 'Backend request blocked by Cloudflare. Please configure Cloudflare to allow API requests or use a direct backend URL.' },
          { status: 503 }
        );
      }
      
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
        { error: `Backend error: ${errorText.substring(0, 200)}` },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    
    // Validate response with Zod
    const responseValidation = SubjectsResponseSchema.safeParse(data);
    if (!responseValidation.success) {
      console.error('Invalid subjects response from backend:', responseValidation.error);
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

