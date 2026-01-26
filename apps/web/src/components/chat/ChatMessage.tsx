import type { ChatMessageData } from './types';
import { ChatRecommendationCard } from './ChatRecommendationCard';

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-sm text-accent-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-4 py-1">
      <div className="max-w-[85%] space-y-2">
        {message.text && (
          <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm">
            {message.text}
          </div>
        )}
        {message.recommendations.length > 0 && (
          <div className="space-y-2">
            {message.recommendations.map((rec) => (
              <ChatRecommendationCard
                key={rec.title.id}
                recommendation={rec}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
