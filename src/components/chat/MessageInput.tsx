import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, onTypingStart, onTypingStop, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    onTypingStop();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, onSend, onTypingStop, disabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onTypingStart();

    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm p-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onTypingStop}
          placeholder="Type a message..."
          disabled={disabled}
          className="min-h-[40px] max-h-[120px] resize-none rounded-xl border-border/50 bg-muted/30 focus:bg-background text-sm py-2.5 px-3.5 transition-colors"
          rows={1}
          id="chat-message-input"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="h-10 w-10 rounded-xl shrink-0 bg-primary hover:bg-primary/90 transition-all"
          aria-label="Send message"
          id="chat-send-btn"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
