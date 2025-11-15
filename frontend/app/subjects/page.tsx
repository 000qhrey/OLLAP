'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SubjectsPage() {
  const router = useRouter();
  const { createSession, updateSessionSubject } = useStore();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjects() {
      try {
        setError(null);
        const response = await fetch('/api/subjects');
        
        if (response.ok) {
          const data = await response.json();
          const subjectsList = Array.isArray(data.subjects) ? data.subjects : [];
          setSubjects(subjectsList);
          
          if (subjectsList.length === 0) {
            setError('No subjects available. Please ensure documents are ingested.');
          }
        } else {
          const errorText = await response.text();
          setError(`Failed to load subjects: ${errorText || response.statusText}`);
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        setError('Failed to connect to backend. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSubjects();
  }, []);

  const handleSubjectSelect = (subject: string) => {
    const sessionId = createSession(`New ${subject.charAt(0).toUpperCase() + subject.slice(1)} Session`);
    updateSessionSubject(sessionId, subject);
    router.push(`/chat/${sessionId}`);
  };

  // Get current day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get day name
  const getDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">
            {getGreeting()}!
          </h1>
          <p className="text-xl text-muted-foreground">
            What are you learning today?
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading subjects...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setLoading(true);
                fetch('/api/subjects')
                  .then((res) => res.json())
                  .then((data) => {
                    setSubjects(data.subjects || []);
                    setLoading(false);
                  })
                  .catch(() => setLoading(false));
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Subjects Grid */}
        {!loading && !error && subjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => {
              const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
              return (
                <Card
                  key={subject}
                  className="p-6 border-border hover:border-primary/50 transition-all cursor-pointer hover:shadow-lg group"
                  onClick={() => handleSubjectSelect(subject)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{subjectName}</h3>
                        <Badge className="bg-primary/10 text-primary border-primary/20 mt-1">
                          {subjectName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                      Click to select
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && subjects.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No subjects available</h3>
            <p className="text-muted-foreground mb-6">
              Please ensure documents are ingested in the backend.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

