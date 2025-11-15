import { Flashcard } from './store';

const STORAGE_KEY = 'saved-flashcards';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit (localStorage typically has 5-10MB)

/**
 * LocalStorage-based storage for saved flashcards
 * Uses localStorage for persistence across sessions (much more space than cookies)
 */
export class SavedFlashcardsStorage {
  /**
   * Get all saved flashcards from localStorage
   */
  static getAll(): Flashcard[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as Flashcard[];
      }
    } catch (error) {
      console.error('Error reading saved flashcards from localStorage:', error);
      // Try to recover by clearing corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    
    return [];
  }

  /**
   * Save a flashcard to cookie storage
   */
  static save(card: Flashcard): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const saved = this.getAll();
      
      // Check if card already exists (by ID)
      const exists = saved.some(c => c.id === card.id);
      if (exists) {
        return false; // Already saved
      }
      
      // Add new card
      const updated = [...saved, card];
      
      // Save to localStorage (much more space than cookies)
      this.setStorage(updated);
      
      return true;
    } catch (error) {
      console.error('Error saving flashcard to localStorage:', error);
      return false;
    }
  }

  /**
   * Save multiple flashcards at once (entire stack)
   */
  static saveAll(cards: Flashcard[]): number {
    if (typeof window === 'undefined' || !cards.length) return 0;
    
    try {
      const saved = this.getAll();
      const savedIds = new Set(saved.map(c => c.id));
      
      // Make IDs unique by appending timestamp if they already exist
      // This allows saving the same flashcards from different sessions
      const timestamp = Date.now();
      const newCards = cards.map((card, index) => {
        // If card ID already exists, make it unique
        if (savedIds.has(card.id)) {
          return {
            ...card,
            id: `${card.id}-${timestamp}-${index}`
          };
        }
        return card;
      });
      
      if (newCards.length === 0) {
        return 0; // No cards to save
      }
      
      // Create a set of IDs we're trying to save (for prioritization)
      const newCardIds = new Set(newCards.map(c => c.id));
      
      // Add all new cards
      const updated = [...saved, ...newCards];
      
      // Try to save, but handle size limits (unlikely with localStorage, but good to check)
      let jsonString = JSON.stringify(updated);
      
      if (jsonString.length > MAX_STORAGE_SIZE) {
        // If too large (very unlikely), remove oldest cards that are NOT in the current set we're saving
        let trimmed = [...updated];
        const newCardsArray = [...newCards];
        
        // First, try removing only old cards (not in current set)
        while (JSON.stringify(trimmed).length > MAX_STORAGE_SIZE && trimmed.length > newCardsArray.length) {
          const indexToRemove = trimmed.findIndex(c => !newCardIds.has(c.id));
          if (indexToRemove === -1) {
            break;
          }
          trimmed.splice(indexToRemove, 1);
        }
        
        // If still too large, remove some new cards too (shouldn't happen)
        while (JSON.stringify(trimmed).length > MAX_STORAGE_SIZE && trimmed.length > 0) {
          trimmed.pop();
        }
        
        if (trimmed.length === 0) {
          console.warn('Cannot save flashcards: storage size limit reached');
          return 0;
        }
        
        this.setStorage(trimmed);
        const savedNewCardIds = new Set(trimmed.map(c => c.id));
        const actuallySaved = newCards.filter(c => savedNewCardIds.has(c.id)).length;
        return actuallySaved;
      } else {
        this.setStorage(updated);
        return newCards.length;
      }
    } catch (error) {
      console.error('Error saving flashcards to localStorage:', error);
      return 0;
    }
  }

  /**
   * Remove multiple flashcards by their IDs or content
   * Removes all cards that match the provided cards (by content signature)
   */
  static removeAll(cards: Flashcard[]): number {
    if (typeof window === 'undefined' || !cards.length) return 0;
    
    try {
      const saved = this.getAll();
      
      // Create content signatures for cards to remove
      const contentSignaturesToRemove = new Set(
        cards.map(c => `${c.front}|${c.back}`)
      );
      
      // Remove all cards that match the content signatures
      const updated = saved.filter(c => 
        !contentSignaturesToRemove.has(`${c.front}|${c.back}`)
      );
      
      this.setStorage(updated);
      return saved.length - updated.length;
    } catch (error) {
      console.error('Error removing flashcards from localStorage:', error);
      return 0;
    }
  }

  /**
   * Check if all cards in a set are saved
   * Checks by content (front + back) to handle cards from different sessions with same IDs
   */
  static areAllSaved(cards: Flashcard[]): boolean {
    if (!cards.length) return false;
    const saved = this.getAll();
    
    // Create a set of saved card content signatures (front + back)
    const savedContentSignatures = new Set(
      saved.map(c => `${c.front}|${c.back}`)
    );
    
    // Check if all current cards have matching content in saved cards
    return cards.every(c => savedContentSignatures.has(`${c.front}|${c.back}`));
  }

  /**
   * Remove a flashcard from saved storage
   */
  static remove(cardId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const saved = this.getAll();
      const updated = saved.filter(c => c.id !== cardId);
      this.setStorage(updated);
      return true;
    } catch (error) {
      console.error('Error removing flashcard from localStorage:', error);
      return false;
    }
  }

  /**
   * Check if a flashcard is saved
   */
  static isSaved(cardId: string): boolean {
    const saved = this.getAll();
    return saved.some(c => c.id === cardId);
  }

  /**
   * Clear all saved flashcards
   */
  static clear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing saved flashcards:', error);
    }
  }

  /**
   * Set localStorage with saved flashcards
   */
  private static setStorage(cards: Flashcard[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      const jsonString = JSON.stringify(cards);
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (error) {
      console.error('Error saving flashcards to localStorage:', error);
      // If quota exceeded, try to remove some old cards
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, removing oldest cards');
        // Remove oldest 25% of cards
        const toKeep = Math.floor(cards.length * 0.75);
        const trimmed = cards.slice(-toKeep);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (e) {
          console.error('Failed to save even after trimming:', e);
        }
      }
    }
  }
}

