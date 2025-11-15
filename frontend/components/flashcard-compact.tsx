'use client';

import { Flashcard } from '@/lib/store';
import { BookOpen, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function FlashcardCompact({
  cards,
  onClick,
}: {
  cards: Flashcard[];
  onClick: () => void;
}) {
  if (!cards || cards.length === 0) return null;

  return (
    <Card
      onClick={onClick}
      className="mt-3 p-4 border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">Created flashcards</h4>
              <span className="text-xs text-muted-foreground bg-primary/20 px-2 py-0.5 rounded">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {cards[0]?.front || 'Flashcard set'}
            </p>
            {cards.some(card => card.image) && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <ImageIcon className="w-3 h-3" />
                <span>Includes images</span>
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </Card>
  );
}

