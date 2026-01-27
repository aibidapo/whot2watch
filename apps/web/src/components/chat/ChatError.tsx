import type { ChatError as ChatErrorType } from './types';

interface ChatErrorProps {
  error: ChatErrorType;
  onDismiss: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  CONCIERGE_DISABLED: 'AI Concierge is currently unavailable. Try again later.',
  RATE_LIMIT_EXCEEDED:
    "You've reached the message limit. Please wait before trying again.",
  DAILY_LIMIT_EXCEEDED:
    "You've used all your daily messages. Upgrade to Premium for more.",
  SESSION_EXHAUSTED:
    'This conversation has reached its limit. Start a new one.',
  NETWORK_ERROR: 'Connection lost. Check your internet and try again.',
};

export function ChatError({ error, onDismiss }: ChatErrorProps) {
  const displayMessage = ERROR_MESSAGES[error.code] || error.message;

  return (
    <div className="mx-3 my-2 flex flex-col gap-2 rounded-lg border border-error-border bg-error-bg p-3 text-sm text-error-text">
      <div className="flex items-start gap-2">
        <p className="flex-1">{displayMessage}</p>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-error-text opacity-70 hover:opacity-100 transition-opacity"
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
      {error.code === 'DAILY_LIMIT_EXCEEDED' && (
        <button
          className="self-start rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          onClick={() => window.open('/upgrade', '_blank')}
        >
          Upgrade to Premium
        </button>
      )}
    </div>
  );
}
