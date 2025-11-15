'use client';

import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Settings, Home, Moon, Sun, BookmarkCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SavedFlashcardsViewer } from './saved-flashcards-viewer';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sessions, currentSessionId, loadSession } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedFlashcardsOpen, setSavedFlashcardsOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  const handleNewChat = () => {
    router.push('/subjects');
  };

  const handleSessionClick = (sessionId: string) => {
    loadSession(sessionId);
    router.push(`/chat/${sessionId}`);
  };

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/" className="block mb-4">
          <img 
            src="/Pasted image.png" 
            alt="OLLAP" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Link>
        <Button
          onClick={handleNewChat}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-sidebar-border">
        <Input
          placeholder="Search chats..."
          className="bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/50"
        />
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-sidebar-foreground/50 text-sm">
            No conversations yet
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm transition-colors ${
                currentSessionId === session.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <div className="truncate font-medium">{session.title}</div>
              <div className="text-xs opacity-75 truncate">
                {session.messages[0]?.content.slice(0, 50)}...
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {pathname !== '/' && (
          <Link href="/" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground"
            >
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          onClick={() => setSavedFlashcardsOpen(true)}
          className="w-full justify-start text-sidebar-foreground"
        >
          <BookmarkCheck className="mr-2 h-4 w-4" />
          Saved Flashcards
        </Button>
        <Button
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          className="w-full justify-start text-sidebar-foreground"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Saved Flashcards Dialog */}
      <Dialog open={savedFlashcardsOpen} onOpenChange={setSavedFlashcardsOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Saved Flashcards</DialogTitle>
            <DialogDescription>
              View and manage your saved flashcards
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <SavedFlashcardsViewer onClose={() => setSavedFlashcardsOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your ollap preferences and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h3 className="text-sm font-medium mb-4">Appearance</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle dark theme
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) => {
                    setTheme(checked ? 'dark' : 'light');
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
