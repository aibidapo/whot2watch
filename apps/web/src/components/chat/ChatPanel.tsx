'use client';

import { useEffect } from 'react';
import type { ChatMessageData, ChatError as ChatErrorType } from './types';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatError } from './ChatError';

interface ChatPanelProps {
  messages: ChatMessageData[];
  isLoading: boolean;
  error: ChatErrorType | null;
  onSend: (message: string) => void;
  onClose: () => void;
  onClearError: () => void;
  onEndSession: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  error,
  onSend,
  onClose,
  onClearError,
  onEndSession,
}: ChatPanelProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="AI Concierge chat"
      className="fixed inset-0 z-50 flex flex-col bg-card sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[600px] sm:w-[400px] sm:rounded-xl sm:border sm:border-border sm:shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold brand-text">AI Concierge</h2>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={onEndSession}
              className="text-xs text-muted transition-colors hover:text-foreground"
              aria-label="New conversation"
            >
              New chat
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted transition-colors hover:text-foreground"
            aria-label="Close chat"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <ChatError error={error} onDismiss={onClearError} />}

      {/* Messages */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        onFollowUp={onSend}
      />

      {/* Input */}
      <ChatInput onSend={onSend} disabled={isLoading} autoFocus />
    </div>
  );
}
