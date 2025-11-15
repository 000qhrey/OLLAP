'use client';

import { Message } from '@/lib/store';
import { MessageBubble } from './message-bubble';
import { useEffect, useRef, useState } from 'react';

export function MessageList({ 
  messages,
  onFlashcardClick 
}: { 
  messages: Message[];
  onFlashcardClick?: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component only renders content after hydration to prevent mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Scroll only within the container, not the entire page
    if (containerRef.current && isMounted) {
      const container = containerRef.current;
      // Scroll to bottom of the container
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isMounted]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-6 space-y-4"
      role="log"
      aria-live="polite"
    >
      {!isMounted ? (
        // Render empty state during SSR to match initial client render
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
            <p>Ask me anything about your studies</p>
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
            <p>Ask me anything about your studies</p>
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            onFlashcardClick={onFlashcardClick}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
