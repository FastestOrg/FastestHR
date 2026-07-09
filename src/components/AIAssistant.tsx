import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const isMobile = useIsMobile();
  const { profile } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! 👋 I'm FastestAI, your custom organizational assistant. Ask me anything about company policies, leave guidelines, payroll structure, or shifts!",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const text = input.trim();
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      // Map history to simple format (Gemini model helper)
      const historyList = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('fastest-ai-assistant', {
        body: {
          query: text,
          history: historyList,
          companyId: profile?.company_id
        }
      });

      if (error) throw error;

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I couldn't generate a response. Please try rephrasing.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('FastestAI error:', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to FastestAI right now. Please check if your system is online or try again in a bit.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!open) {
    return (
      <div className={`fixed right-6 z-50 ${isMobile ? 'bottom-24' : 'bottom-6'}`}>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
          aria-label="Open FastestAI"
          title="Open FastestAI"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 animate-in fade-in slide-in-from-bottom-4 ${isMobile ? 'bottom-20 right-3 left-3' : 'bottom-6 right-6'}`}>
      <Card className={`shadow-2xl border-primary/20 bg-[#09090b]/90 backdrop-blur-xl ${isMobile ? 'w-full' : 'w-80 sm:w-96'}`}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-primary/5 rounded-t-lg border-b border-border/10">
          <CardTitle className="text-sm flex items-center gap-2 text-white">
            <Bot className="w-5 h-5 text-primary" />
            <span>FastestAI</span>
            <Badge className="bg-success/10 text-success border-success/30 text-[10px] font-bold">Online</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white" onClick={() => setOpen(false)} aria-label="Close FastestAI" title="Close FastestAI">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`p-1.5 rounded-full h-7 w-7 flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                  {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'assistant' ? 'bg-muted/30 text-white' : 'bg-primary text-primary-foreground'}`}>
                  <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                  <span className="text-[9px] opacity-60 mt-1 block text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-2">
                <div className="p-1.5 rounded-full h-7 w-7 flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                  <Bot className="h-3.5 w-3.5 animate-pulse" />
                </div>
                <div className="max-w-[80%] rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border/10 p-3 flex gap-2">
            <Input
              placeholder="Ask FastestAI about work policies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              className="text-xs bg-background/50 border-border/50 text-white focus-visible:ring-primary h-9"
              autoFocus
              disabled={isThinking}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || isThinking} aria-label="Send message" title="Send message" className="h-9 w-9">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
