import type { ChatError as ChatErrorType } from './types';

interface ChatErrorProps {
  error: ChatErrorType;
  onDismiss: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  CONCIERGE_DISABLED: 'AI Concierge is currently unavailable. Try again later.',
  RATE_LIMIT_EXCEEDED:
    "You've reached the message limit. Please wait before trying again.",
  SESSION_EXHAUSTED:
    'This conversation has reached its limit. Start a new one.',
  NETWORK_ERROR: 'Connection lost. Check your internet and try again.',
};

export function ChatError({ error, onDismiss }: ChatErrorProps) {
  const displayMessage = ERROR_MESSAGES[error.code] || error.message;

  return (
    <div className="mx-3 my-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-300">
      <p className="flex-1">{displayMessage}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-red-400 hover:text-red-200"
        aria-label="Dismiss error"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
