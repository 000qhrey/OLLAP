'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, Sparkles, BookOpen, Zap } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleStartSession = () => {
    router.push('/subjects');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      {/* Subtle background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <img 
              src="/Pasted image.png" 
              alt="OLLAP" 
              className="h-12 w-auto"
            />
          </div>
          <h1 className="text-5xl font-bold mb-4 text-foreground">
            Welcome to ollap
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Your intelligent learning companion
          </p>
          <p className="text-base text-muted-foreground">
            Study smarter with AI-powered learning, flashcards, and adaptive lessons
          </p>
        </div>
        {/* CTA Button */}
        <div className="flex justify-center gap-4">
          <Button
            onClick={handleStartSession}
            size="lg"
            className="px-8 py-6 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold group"
          >
            Start Learning
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Footer Text */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          No account needed. Start learning instantly.
        </p>
      </div>
    </div>
  );
}
