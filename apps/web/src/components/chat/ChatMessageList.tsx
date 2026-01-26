'use client';

import { useRef, useEffect } from 'react';
import type { ChatMessageData } from './types';
import { ChatMessage } from './ChatMessage';
import { ChatFollowUps } from './ChatFollowUps';
import { ChatTypingIndicator } from './ChatTypingIndicator';

interface ChatMessageListProps {
  messages: ChatMessageData[];
  isLoading: boolean;
  onFollowUp: (question: string) => void;
}

export function ChatMessageList({
  messages,
  isLoading,
  onFollowUp,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Find follow-up questions from the last assistant message
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const followUps =
    lastAssistant && !isLoading ? lastAssistant.followUpQuestions : [];

  return (
    <div className="flex-1 overflow-y-auto" role="log" aria-live="polite">
      {messages.length === 0 && !isLoading && (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted">
          <p className="font-medium">AI Concierge</p>
          <p>
            Ask me to recommend movies, find where to watch a show, or discover
            something new.
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {followUps.length > 0 && (
        <ChatFollowUps questions={followUps} onSelect={onFollowUp} />
      )}

      {isLoading && <ChatTypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
