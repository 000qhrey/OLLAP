'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCw, AlertCircle, GripVertical, Image as ImageIcon, Bookmark, BookmarkCheck } from 'lucide-react';
import { SavedFlashcardsStorage } from '@/lib/saved-flashcards';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cleanLaTeX } from '@/lib/latex-cleaner';

export function FlashcardViewer({
  cards,
  onMarkKnown,
}: {
  cards: Flashcard[];
  onMarkKnown: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [allCardsSaved, setAllCardsSaved] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Check if all cards are saved
  const checkAllCardsSaved = useCallback(() => {
    const areAllSaved = SavedFlashcardsStorage.areAllSaved(cards);
    setAllCardsSaved(areAllSaved);
  }, [cards]);

  useEffect(() => {
    checkAllCardsSaved();
  }, [cards, checkAllCardsSaved]);

  // Refresh saved status periodically to stay in sync
  useEffect(() => {
    const interval = setInterval(checkAllCardsSaved, 1000);
    return () => clearInterval(interval);
  }, [checkAllCardsSaved]);

  // Reset flipped state when card index changes
  useEffect(() => {
    setFlipped(false);
  }, [index]);

  // Ensure index is within bounds when cards change
  useEffect(() => {
    if (cards?.length && index >= cards.length) {
      setIndex(Math.max(0, cards.length - 1));
    }
  }, [cards, index]);

  if (!cards?.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No flashcards available
      </div>
    );
  }

  const card = cards[index];
  if (!card) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Invalid flashcard data
      </div>
    );
  }

  const hasNext = index < cards.length - 1;
  const hasPrev = index > 0;

  const handlePrevious = () => {
    if (hasPrev) {
      setIndex(index - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setIndex(index + 1);
    }
  };

  const handleSaveAllCards = () => {
    const savedCount = SavedFlashcardsStorage.saveAll(cards);
    // Always check state after save attempt, even if count is 0
    // This handles cases where cards were already saved or couldn't be saved
    setTimeout(() => {
      checkAllCardsSaved();
    }, 100);
  };

  const handleUnsaveAllCards = () => {
    SavedFlashcardsStorage.removeAll(cards);
    // Always refresh state after unsave
    setTimeout(() => {
      checkAllCardsSaved();
    }, 100);
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div 
      ref={viewerRef}
      className="p-6 h-full flex flex-col relative bg-background"
      style={{
        transform: position.x !== 0 || position.y !== 0 ? `translate(${position.x}px, ${position.y}px)` : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } text-muted-foreground hover:text-foreground transition-colors z-10`}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          Card {index + 1} of {cards.length}
        </div>
        {card.needs_review && (
          <div className="flex items-center gap-1 text-xs bg-destructive/20 text-destructive px-2 py-1 rounded">
            <AlertCircle className="h-3 w-3" />
            Needs Review
          </div>
        )}
      </div>

      {/* Card with flip animation */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="flex-1 mb-6 cursor-pointer perspective-1000"
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative w-full h-full preserve-3d transition-transform duration-600"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 w-full h-full bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center backface-hidden overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div className="text-center w-full max-h-full">
              <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">
                Front
              </div>
              
              {/* Image display */}
              {card.image && (
                <div className="mb-4 flex justify-center">
                  <div className="relative w-full max-w-xs h-48 rounded-lg overflow-hidden border border-border bg-muted/50">
                    <img
                      src={card.image}
                      alt={card.front}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              
              <div className="text-lg leading-relaxed text-xl markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-4">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-4">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
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
                  }}
                >
                  {cleanLaTeX(card.front || 'No front content available')}
                </ReactMarkdown>
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                (click to flip)
              </div>
            </div>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0 w-full h-full bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center backface-hidden overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="text-center w-full max-h-full">
              <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">
                Back
              </div>
              
              {/* Image display */}
              {card.image && (
                <div className="mb-4 flex justify-center">
                  <div className="relative w-full max-w-xs h-48 rounded-lg overflow-hidden border border-border bg-muted/50">
                    <img
                      src={card.image}
                      alt={card.back}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              
              <div className="text-lg leading-relaxed text-base markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-4">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-4">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
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
                  }}
                >
                  {cleanLaTeX(card.back || 'No back content available')}
                </ReactMarkdown>
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                (click to flip)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handlePrevious}
          disabled={!hasPrev}
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={() => setFlipped(!flipped)}
            variant="outline"
            size="sm"
          >
            <RotateCw className="h-4 w-4 mr-1" />
            Flip
          </Button>
          <Button
            onClick={allCardsSaved ? handleUnsaveAllCards : handleSaveAllCards}
            variant={allCardsSaved ? "default" : "outline"}
            size="sm"
            className={allCardsSaved 
              ? "bg-green-600 hover:bg-green-700 text-white" 
              : "border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"}
            title={allCardsSaved ? "Remove all flashcards from saved" : "Save all flashcards"}
          >
            {allCardsSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4 mr-1" />
                All Saved
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-1" />
                Save All
              </>
            )}
          </Button>
        </div>

        <Button
          onClick={handleNext}
          disabled={!hasNext}
          variant="outline"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {card.source && (
        <div className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
          Source: {card.source}
        </div>
      )}
    </div>
  );
}
