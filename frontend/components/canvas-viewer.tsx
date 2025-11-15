'use client';

export function CanvasViewer({ canvasId }: { canvasId: string }) {
  return (
    <div className="p-6 h-full overflow-y-auto bg-gradient-to-b from-card to-background">
      <div className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-start gap-2 mb-6">
          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
          <h2 className="text-2xl font-semibold">Lesson: {canvasId}</h2>
        </div>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Lesson content will be displayed here. This is a placeholder for structured lessons and course materials.
          </p>
          <div className="bg-primary/10 border border-primary/20 rounded p-4 mt-6">
            <p className="text-sm text-foreground">
              📚 <span className="font-semibold">Learning Resource</span>
            </p>
            <p className="text-xs mt-2">Interactive content would render here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
