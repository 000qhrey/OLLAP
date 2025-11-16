'use client';

import { Message } from '@/lib/store';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { FlashcardCompact } from './flashcard-compact';
import { cleanLaTeX } from '@/lib/latex-cleaner';

export function MessageBubble({ 
  message, 
  onFlashcardClick 
}: { 
  message: Message;
  onFlashcardClick?: () => void;
}) {
  const isAssistant = message.role === 'assistant';
  // LaTeX is already cleaned in onDone callback after message completion
  // This is kept as a fallback safety net in case a message somehow bypasses cleaning
  const cleanedContent = isAssistant ? cleanLaTeX(message.content) : message.content;
  const flashcards = message.metadata?.flashcards;

  return (
    <div
      className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={`max-w-2xl px-4 py-3 rounded-lg break-words ${
          isAssistant
            ? 'bg-card text-card-foreground border border-border/50'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {isAssistant ? (
          <div className="text-sm leading-relaxed markdown-content overflow-wrap-anywhere">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                // Headers
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-2">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
                // Paragraphs
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                // Lists
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                // Code blocks
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto my-2 text-xs">
                    {children}
                  </pre>
                ),
                // Blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic my-2">
                    {children}
                  </blockquote>
                ),
                // Links
                a: ({ href, children }) => (
                  <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                // Strong/Bold
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                // Emphasis/Italic
                em: ({ children }) => <em className="italic">{children}</em>,
                // Horizontal rule
                hr: () => <hr className="my-4 border-border" />,
                // Tables (from GFM)
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full border-collapse border border-border">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
              }}
            >
              {cleanedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        {flashcards && Array.isArray(flashcards) && flashcards.length > 0 && (
          <FlashcardCompact 
            cards={flashcards} 
            onClick={() => onFlashcardClick?.()} 
          />
        )}
        {message.metadata?.needs_review && (
          <div className="mt-2 text-xs font-semibold opacity-75">
            ⚠ Needs Review
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );
}
