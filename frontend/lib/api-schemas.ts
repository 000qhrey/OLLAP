import { z } from 'zod';

// ============================================================================
// Chat API Schemas
// ============================================================================

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  subject: z.string().min(1, 'Subject is required').max(100),
  max_retrieval_k: z.number().int().positive().max(20).optional(),
  syllabus_hints: z.string().max(1000).optional(),
}).strict(); // Strict mode: reject extra fields

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Stream event types for chat
export const ChatStreamDeltaSchema = z.object({
  type: z.literal('delta'),
  token: z.string().min(1),
}).strict();

export const ChatStreamErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  code: z.string().max(100).optional(),
}).strict();

export const ChatStreamDoneSchema = z.object({
  type: z.literal('done'),
}).strict();

export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  ChatStreamDeltaSchema,
  ChatStreamErrorSchema,
  ChatStreamDoneSchema,
]);

export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;

// ============================================================================
// Flashcards API Schemas
// ============================================================================

export const FlashcardSchema = z.object({
  id: z.string().min(1).max(200),
  front: z.string().min(1).max(500),
  back: z.string().min(1),
  tags: z.array(z.string().max(50)).max(20).optional(),
  source: z.string().max(200).optional(),
  needs_review: z.boolean().optional(),
  image: z
    .string()
    .max(10000)
    .nullable()
    .optional()
    .transform((val) => (val === null ? undefined : val))
    .refine(
      (val) => {
        if (!val || val === undefined) return true;
        return val.startsWith('data:image/') || z.string().url().safeParse(val).success;
      },
      { message: 'Image must be a valid URL or data URI' }
    ),
}).strict();

export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ChatMessageSchema = z.object({
  role: z.string().min(1).max(50),
  content: z.string().min(1).max(10000),
}).strict();

const FlashcardRequestBaseSchema = z.object({
  topic: z.string().min(1, 'Topic cannot be empty').max(500, 'Topic too long').optional(),
  subject: z.string().min(1, 'Subject is required').max(100),
  num: z.number().int().positive().max(50).optional().default(8),
  syllabus_hints: z.string().max(1000).optional(),
  chat_context: z.array(ChatMessageSchema).optional(),
}).strict();

export const FlashcardRequestSchema = FlashcardRequestBaseSchema.refine(
  (data) => data.topic || data.chat_context,
  {
    message: "Either 'topic' or 'chat_context' must be provided",
    path: ["topic"],
  }
);

export type FlashcardRequest = z.infer<typeof FlashcardRequestSchema>;

export const FlashcardResponseSchema = z.object({
  cards: z.array(FlashcardSchema).min(1).max(50),
}).strict();

export type FlashcardResponse = z.infer<typeof FlashcardResponseSchema>;

// ============================================================================
// Subjects API Schemas
// ============================================================================

export const SubjectsResponseSchema = z.object({
  subjects: z.array(z.string().min(1)),
  count: z.number().int().nonnegative(),
}).strict();

export type SubjectsResponse = z.infer<typeof SubjectsResponseSchema>;

// ============================================================================
// Ingest API Schemas
// ============================================================================

export const IngestRequestSchema = z.object({
  doc_id: z.string().min(1, 'Document ID is required').max(200),
  title: z.string().max(500).optional(),
  text: z.string().min(1, 'Text content is required'),
  subject: z.string().min(1, 'Subject is required').max(100),
}).strict();

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestResponseSchema = z.object({
  ok: z.boolean(),
  upserted: z.number().int().nonnegative(),
  subject: z.string().min(1),
}).strict();

export type IngestResponse = z.infer<typeof IngestResponseSchema>;

// Batch ingest schemas
export const BatchIngestResultSchema = z.object({
  doc_id: z.string().min(1).max(200),
  file: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  upserted: z.number().int().nonnegative(),
}).strict();

export const BatchIngestErrorSchema = z.object({
  file: z.string().min(1).max(500),
  error: z.string().min(1).max(1000),
}).strict();

export const BatchIngestResponseSchema = z.object({
  ok: z.boolean(),
  subject: z.string().min(1),
  processed: z.number().int().nonnegative(),
  results: z.array(BatchIngestResultSchema),
  errors: z.array(BatchIngestErrorSchema),
}).strict();

export type BatchIngestResponse = z.infer<typeof BatchIngestResponseSchema>;

// Upload ingest schemas
export const UploadIngestResponseSchema = z.object({
  ok: z.boolean(),
  doc_id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  filename: z.string().min(1).max(500),
  subject: z.string().min(1),
  upserted: z.number().int().nonnegative(),
  chunks: z.number().int().nonnegative(),
  message: z.string().min(1).max(500),
}).strict();

export type UploadIngestResponse = z.infer<typeof UploadIngestResponseSchema>;

// ============================================================================
// Error Response Schema
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string().min(1).max(1000),
  detail: z.string().max(2000).optional(),
  code: z.string().max(100).optional(),
}).strict();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Documents Structure Schema
// ============================================================================

export const DocumentFileSchema = z.object({
  name: z.string().min(1).max(500),
  path: z.string().min(1).max(1000),
  size: z.number().int().nonnegative(),
}).strict();

export const DocumentsStructureResponseSchema = z.object({
  structure: z.record(z.string(), z.array(DocumentFileSchema)),
}).strict();

export type DocumentsStructureResponse = z.infer<typeof DocumentsStructureResponseSchema>;

// ============================================================================
// Health Check Schema
// ============================================================================

export const ServiceStatusSchema = z.object({
  status: z.string().min(1).max(100),
  services: z.record(z.string(), z.string()),
}).strict();

export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

