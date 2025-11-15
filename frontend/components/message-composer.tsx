'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Sparkles } from 'lucide-react';

export function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted before using actual disabled value
  // This prevents hydration mismatch when disabled prop differs between SSR and client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR, always render as enabled (false) to match initial client render
  // After hydration, use the actual disabled prop value
  const isDisabled = isMounted ? Boolean(disabled) : false;

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  return (
    <div className="p-6 border-t border-border bg-card/50">
      <div className="flex gap-3">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ollap anything..."
          disabled={isDisabled}
          className="flex-1 resize-none min-h-12 max-h-48"
        />
        <Button
          onClick={handleSend}
          disabled={isDisabled || !message.trim()}
          size="icon"
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onSend(message || 'make flashcards')}
          disabled={isDisabled}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Make Flashcards
        </Button>
      </div>
    </div>
  );
}
