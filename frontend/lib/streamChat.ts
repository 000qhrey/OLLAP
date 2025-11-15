export async function streamChat({
  sessionId,
  message,
  subject,
  onToken,
  onTool,
  onDone,
}: {
  sessionId?: string;
  message: string;
  subject: string;
  onToken: (token: string) => void;
  onTool: (name: string, args: any) => void;
  onDone: (data: any) => void;
}) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, subject }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Chat request failed: ${errorText}`);
  }
  if (!resp.body) throw new Error('No stream from server');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      if (!part.trim()) continue;
      let parsed;
      try {
        parsed = JSON.parse(part);
      } catch (e) {
        continue;
      }

      if (parsed.type === 'delta') onToken(parsed.token);
      else if (parsed.type === 'tool') onTool(parsed.name, parsed.args);
      else if (parsed.type === 'done') onDone(parsed);
    }
  }
}
