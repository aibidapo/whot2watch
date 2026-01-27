'use client';

import { useChat } from './hooks/useChat';
import { ChatPanel } from './ChatPanel';

export function ChatFab() {
  const chat = useChat();

  // Don't render anything until health check completes, or if disabled
  if (chat.isEnabled !== true) return null;

  return (
    <>
      {/* Floating action button */}
      {!chat.isOpen && (
        <button
          onClick={chat.toggle}
          aria-label="Open AI Concierge"
          className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 fab-pulse"
          style={{ background: 'var(--brand-grad)' }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {chat.isOpen && (
        <ChatPanel
          messages={chat.messages}
          isLoading={chat.isLoading}
          error={chat.error}
          quota={chat.quota}
          onSend={chat.send}
          onClose={chat.close}
          onClearError={chat.clearError}
          onEndSession={chat.endSession}
        />
      )}
    </>
  );
}
