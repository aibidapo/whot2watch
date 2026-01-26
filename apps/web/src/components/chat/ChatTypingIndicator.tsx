export function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span
        className="h-2 w-2 rounded-full bg-muted animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="h-2 w-2 rounded-full bg-muted animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="h-2 w-2 rounded-full bg-muted animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}
