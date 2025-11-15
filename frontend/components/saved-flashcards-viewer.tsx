'use client';

import { useState, useEffect } from 'react';
import { Flashcard } from '@/lib/store';
import { SavedFlashcardsStorage } from '@/lib/saved-flashcards';
import { FlashcardViewer } from './flashcard-viewer';
import { Button } from '@/components/ui/button';
import { X, BookmarkCheck } from 'lucide-react';

export function SavedFlashcardsViewer({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [savedCards, setSavedCards] = useState<Flashcard[]>([]);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);

  // Load saved cards
  useEffect(() => {
    const loadSavedCards = () => {
      const saved = SavedFlashcardsStorage.getAll();
      setSavedCards(saved);
      
      // If viewing a card that no longer exists, go back to list
      if (showViewer && saved.length === 0) {
        setShowViewer(false);
      } else if (showViewer && selectedCardIndex >= saved.length && saved.length > 0) {
        // If current card was removed, adjust index
        setSelectedCardIndex(saved.length - 1);
      }
    };

    loadSavedCards();
    
    // Refresh saved cards when storage changes
    const interval = setInterval(loadSavedCards, 500);
    return () => clearInterval(interval);
  }, [showViewer, selectedCardIndex]);

  const handleRemoveCard = (cardId: string) => {
    SavedFlashcardsStorage.remove(cardId);
    const updated = savedCards.filter(c => c.id !== cardId);
    setSavedCards(updated);
    
    // Adjust selected index if needed
    if (selectedCardIndex >= updated.length && updated.length > 0) {
      setSelectedCardIndex(updated.length - 1);
    } else if (updated.length === 0) {
      setShowViewer(false);
    }
  };

  const handleViewCard = (index: number) => {
    setSelectedCardIndex(index);
    setShowViewer(true);
  };

  if (showViewer && savedCards.length > 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b border-border flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Saved Flashcards ({savedCards.length})
            </h3>
          </div>
          <Button
            onClick={() => setShowViewer(false)}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {savedCards.length > 0 ? (
            <FlashcardViewer
              cards={savedCards}
              onMarkKnown={() => {}}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <BookmarkCheck className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">No saved flashcards</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Saved Flashcards ({savedCards.length})
          </h3>
        </div>
        {onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {savedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <BookmarkCheck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No saved flashcards yet</p>
            <p className="text-xs mt-2">Save flashcards while viewing them to see them here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedCards.map((card, index) => (
              <div
                key={card.id}
                className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => handleViewCard(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1 line-clamp-2">
                      {card.front}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {card.back}
                    </div>
                    {card.source && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Source: {card.source}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCard(card.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from saved"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

