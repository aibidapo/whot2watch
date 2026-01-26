interface ChatFollowUpsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function ChatFollowUps({ questions, onSelect }: ChatFollowUpsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {questions.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted shadow-sm transition-all duration-200 hover:shadow-md hover:bg-accent hover:text-accent-foreground"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
