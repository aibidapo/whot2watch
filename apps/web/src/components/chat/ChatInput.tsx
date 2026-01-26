'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
}

export function ChatInput({ onSend, disabled, autoFocus }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2 border-t border-border p-3">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask about movies or shows..."
        maxLength={1000}
        disabled={disabled}
        className="flex-1"
        aria-label="Type a message"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        variant="primary"
      >
        Send
      </Button>
    </div>
  );
}
