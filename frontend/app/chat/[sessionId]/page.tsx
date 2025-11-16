'use client';

import { useStore, Message } from '@/lib/store';
import { Sidebar } from '@/components/sidebar';
import { MessageList } from '@/components/message-list';
import { MessageComposer } from '@/components/message-composer';
import { FlashcardViewer } from '@/components/flashcard-viewer';
import { CanvasViewer } from '@/components/canvas-viewer';
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { streamChat } from '@/lib/streamChat';
import { FlashcardCompact } from '@/components/flashcard-compact';
import { GripVertical } from 'lucide-react';
import { cleanLaTeX } from '@/lib/latex-cleaner';

// Helper function to detect flashcard requests
function shouldGenerateFlashcards(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const flashcardKeywords = [
    'make flashcards',
    'generate flashcards',
    'create flashcards',
    'flashcards for',
    'flashcard',
    'make cards',
    'generate cards',
  ];
  return flashcardKeywords.some((keyword) => lowerMessage.includes(keyword));
}

// Extract topic from message
function extractTopic(message: string): string {
  // Try to extract topic after common phrases
  const patterns = [
    /(?:flashcards?|cards?)\s+(?:for|about|on)\s+(.+)/i,
    /(?:make|generate|create)\s+(?:flashcards?|cards?)\s+(?:for|about|on)?\s*(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: use the whole message or a default
  return message.length > 50 ? message.slice(0, 50) + '...' : message;
}

// Calculate similarity between two strings (simple Levenshtein-based approach)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Simple character-based similarity
  const longerNormalized = longer.toLowerCase().replace(/\s+/g, ' ');
  const shorterNormalized = shorter.toLowerCase().replace(/\s+/g, ' ');
  
  // Check if shorter is a substring of longer (common in duplicates)
  if (longerNormalized.includes(shorterNormalized) || shorterNormalized.includes(longerNormalized.substring(0, shorterNormalized.length))) {
    return 0.9; // Very likely duplicate
  }
  
  // Simple word overlap check
  const words1 = longerNormalized.split(/\s+/).filter(w => w.length > 3);
  const words2 = shorterNormalized.split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity;
}

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const {
    loadSession,
    getCurrentSession,
    appendMessage,
    updateMessageChunk,
    updateLastMessage,
    setSessionFlashcards,
    markSessionFlashcardKnown,
  } = useStore();
  
  // Helper to update message metadata
  const updateMessageMetadata = (messageId: string, metadata: Record<string, any>) => {
    const session = getCurrentSession();
    if (!session) return;
    
    // Use the store's set function
    const store = useStore.getState();
    useStore.setState({
      sessions: store.sessions.map((s) =>
        s.id === session.id
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? { ...m, metadata: { ...m.metadata, ...metadata } }
                  : m
              ),
            }
          : s
      ),
    });
  };
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelWidth, setPanelWidth] = useState(384); // Default 96 * 4 = 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      // Constrain between 300px and 800px
      const constrainedWidth = Math.max(300, Math.min(800, newWidth));
      setPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Load session and add intro message based on subject
  useEffect(() => {
    loadSession(sessionId);
    
    // Small delay to ensure session is loaded
    setTimeout(() => {
      const currentSession = getCurrentSession();
      if (currentSession && currentSession.messages.length === 0) {
        const subject = currentSession.subject?.toLowerCase();
        let introMsg: Message | null = null;
        
        if (subject === 'chemistry') {
          introMsg = {
            id: `msg-intro-${Date.now()}`,
            role: 'assistant',
            content: "Hi! I'm **Abel**, and I'll be your guide for chemistry. I'm here to help you understand chemical concepts, solve problems, and answer any questions you have. Feel free to ask me anything about chemistry!",
            createdAt: new Date().toISOString(),
          };
        } else if (subject === 'mathematics' || subject === 'maths' || subject === 'math') {
          introMsg = {
            id: `msg-intro-${Date.now()}`,
            role: 'assistant',
            content: "Hi! I'm **John**, and I'll be your guide for mathematics. I'm here to help you understand mathematical concepts, solve problems step-by-step, and build your problem-solving skills. Feel free to ask me anything about math!",
            createdAt: new Date().toISOString(),
          };
        } else if (subject === 'science' || subject === 'physics' || subject === 'biology') {
          introMsg = {
            id: `msg-intro-${Date.now()}`,
            role: 'assistant',
            content: "Hi! I'm **Chris**, and I'll be your guide for science. I'm here to help you explore scientific concepts, understand how things work, and connect theory to real-world applications. Feel free to ask me anything about science!",
            createdAt: new Date().toISOString(),
          };
        }
        
        if (introMsg) {
          appendMessage(introMsg);
        }
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const session = getCurrentSession();
  const [expandedFlashcards, setExpandedFlashcards] = useState(false);
  const showFlashcards = (session?.flashcards?.length || 0) > 0;
  const showCanvas = !!session?.selectedCanvasId;

  const handleGenerateFlashcards = async (topic?: string) => {
    if (!session || !session.subject) {
      console.error('Session or subject not available');
      return;
    }

    // Add waiting message
    const waitingMsg: Message = {
      id: `msg-waiting-${Date.now()}`,
      role: 'assistant',
      content: 'Please wait, I am cooking...',
      createdAt: new Date().toISOString(),
    };
    appendMessage(waitingMsg);

    try {
      // Prepare request body - include chat context if topic is not provided or is generic
      const requestBody: any = {
        subject: session.subject,
        num: 8,
      };

      // If topic is provided and meaningful, use it; otherwise use chat context
      if (topic && topic.trim() && !topic.includes('...')) {
        requestBody.topic = topic;
      } else {
        // Extract chat context from session messages
        const chatContext = session.messages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
        
        if (chatContext.length > 0) {
          requestBody.chat_context = chatContext;
        } else {
          // Fallback: use topic if available, otherwise use a default
          requestBody.topic = topic || `${session.subject} concepts`;
        }
      }

      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      if (data.cards && data.cards.length > 0) {
        setSessionFlashcards(session.id, data.cards);
        
        // Update waiting message with success message and attach flashcards
        const successContent = `Flashcards ready! Click below to view them`;
        updateLastMessage(successContent);
        
        // Update message metadata with flashcards
        setTimeout(() => {
          updateMessageMetadata(waitingMsg.id, { flashcards: data.cards });
        }, 100);
      } else {
        // Update waiting message with error
        updateLastMessage('Sorry, I couldn\'t generate flashcards. Please try again.');
      }
    } catch (error) {
      console.error('Flashcard generation error:', error);
      // Update waiting message with error
      updateLastMessage('Sorry, there was an error generating flashcards. Please try again.');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!session || !session.subject) {
      updateLastMessage('Subject not set. Please start a new chat from the subjects page.');
      return;
    }

    // Check if this is a flashcard request
    if (shouldGenerateFlashcards(text)) {
      const extractedTopic = extractTopic(text);
      
      // Add user message
      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      appendMessage(userMsg);

      // Generate flashcards - pass topic only if it was explicitly extracted
      // Otherwise, let the backend extract from chat context
      const topicToUse = extractedTopic && extractedTopic !== text ? extractedTopic : undefined;
      await handleGenerateFlashcards(topicToUse);
      return;
    }

    // Regular chat message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendMessage(userMsg);

    // Create assistant waiting message
    const waitingMsg: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: 'Please wait, I am cooking...',
      streaming: false,
      createdAt: new Date().toISOString(),
    };
    appendMessage(waitingMsg);
    setIsStreaming(true);

    try {
      let firstToken = true;
      await streamChat({
        sessionId: session.id,
        message: text,
        subject: session.subject,
        onToken: (token) => {
          // Clean "assistant:" prefix from tokens
          const cleanedToken = token.replace(/^(assistant|Assistant):\s*/i, '');
          
          if (firstToken) {
            // Replace waiting message with first token (cleaned)
            updateLastMessage(cleanedToken);
            firstToken = false;
          } else {
            updateMessageChunk(cleanedToken);
          }
        },
        onTool: (name, args) => {
          if (name === 'generateFlashcards') {
            const topic = args.topic || extractTopic(text);
            handleGenerateFlashcards(topic);
          }
        },
        onDone: (data) => {
          setIsStreaming(false);
          // Final deduplication check: remove any duplicate content from the last message
          const currentSession = getCurrentSession();
          if (currentSession && currentSession.messages.length > 0) {
            const lastMessage = currentSession.messages[currentSession.messages.length - 1];
            if (lastMessage && lastMessage.content) {
              let content = lastMessage.content.trim();
              
              // Check if the entire response is duplicated (common pattern)
              // Split by common section markers to detect full duplication
              const midPoint = Math.floor(content.length / 2);
              const firstHalf = content.substring(0, midPoint).trim();
              const secondHalf = content.substring(midPoint).trim();
              
              // If second half is very similar to first half (80% similarity), it's likely a duplicate
              if (firstHalf.length > 100 && secondHalf.length > 100) {
                const similarity = calculateSimilarity(firstHalf, secondHalf);
                if (similarity > 0.8) {
                  // Likely duplicate, keep only first half
                  content = firstHalf;
                  // Clean LaTeX formatting after deduplication
                  content = cleanLaTeX(content);
                  updateLastMessage(content);
                  return;
                }
              }
              
              // Check for duplicate paragraphs/sections
              const sections = content.split(/\n{2,}/).filter(s => s.trim());
              if (sections.length > 1) {
                const seen = new Map<string, number>();
                const uniqueSections: string[] = [];
                
                sections.forEach(section => {
                  // Normalize section for comparison (first 150 chars, lowercase, remove extra whitespace)
                  const normalized = section.trim().toLowerCase().substring(0, 150).replace(/\s+/g, ' ');
                  const count = seen.get(normalized) || 0;
                  
                  if (count === 0) {
                    // First occurrence, keep it
                    seen.set(normalized, 1);
                    uniqueSections.push(section);
                  } else {
                    // Duplicate, skip it
                    seen.set(normalized, count + 1);
                  }
                });
                
                if (uniqueSections.length < sections.length) {
                  // Found duplicates, update message with deduplicated content
                  content = uniqueSections.join('\n\n');
                }
              }
              
              // Clean LaTeX formatting after all processing is complete
              content = cleanLaTeX(content);
              updateLastMessage(content);
            }
          }
        },
      });
    } catch (error) {
      console.error('Chat error:', error);
      updateLastMessage('Sorry, there was an error processing your message.');
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MessageList 
          messages={session?.messages || []} 
          onFlashcardClick={() => setExpandedFlashcards(true)}
        />
        <MessageComposer 
          onSend={handleSendMessage} 
          disabled={isStreaming || !session?.subject}
        />
      </div>

      {/* Right Panel */}
      {(expandedFlashcards && showFlashcards) || showCanvas ? (
        <div 
          className="border-l border-border flex flex-col relative overflow-hidden"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Resize handle */}
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/70 transition-colors z-10 ${
              isResizing ? 'bg-primary' : 'bg-border/50'
            }`}
            style={{ marginLeft: '-2px' }}
            title="Drag to resize"
          />
          
          {expandedFlashcards && showFlashcards ? (
            <>
              <div className="p-2 border-b border-border flex items-center justify-between bg-card/50">
                <h3 className="text-sm font-semibold">Flashcards</h3>
                <button
                  onClick={() => setExpandedFlashcards(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                >
                  Collapse
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FlashcardViewer
                  cards={session?.flashcards || []}
                  onMarkKnown={(id) => {
                    markSessionFlashcardKnown(sessionId, id);
                  }}
                />
              </div>
            </>
          ) : showCanvas ? (
            <CanvasViewer canvasId={session?.selectedCanvasId || ''} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
