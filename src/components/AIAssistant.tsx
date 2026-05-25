import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const hrKnowledge: Record<string, string> = {
  'leave': 'To apply for leave, go to Leave Management → Apply Leave. Select your leave type, dates, and submit. Your manager will review and approve/reject the request. You can track your leave balance on the Leave page.',
  'payroll': 'Payroll is processed monthly by your HR admin. You can view your payslips under the Payroll section. Your salary structure shows the breakdown of your compensation components.',
  'attendance': 'Clock in/out using the Attendance page. Your total hours are tracked automatically. If you missed a clock-in, contact HR for regularization.',
  'performance': 'Performance is tracked through OKRs (Objectives & Key Results). Set your goals on the Performance page and update progress regularly. Review cycles happen quarterly.',
  'onboarding': 'New employees go through a 5-step onboarding process: Welcome, Document Submission, Policy Acknowledgement, IT Setup, and Team Introduction. Track your progress on the Onboarding page.',
  'resignation': 'To resign, submit a formal resignation to your manager. The Exit Management module handles the process including exit interviews, asset returns, and final settlement.',
  'documents': 'Company documents including policies, NDAs, and templates are available in the Documents section. You can download any document you have access to.',
  'helpdesk': 'Raise a support ticket on the Help Desk page. Select the category (Payroll, Leave, Benefits, IT, etc.), set priority, and describe your issue. The HR/IT team will respond.',
  'benefits': 'Your benefits package is part of your salary structure. Check the Payroll section for your compensation breakdown. Contact HR for questions about specific benefits.',
  'holiday': 'Company holidays are defined in the Leave Management settings. Check with your HR admin for the current year\'s holiday calendar.',
  'training': 'Browse available courses on the Learning & Dev page. You can enroll in courses and track your progress. Completed courses count towards your professional development.',
  'policy': 'All company policies are available in the Documents section under HR Policies. Key policies include the Employee Handbook, Code of Conduct, Remote Work Policy, and Leave Policy.',
  'hello': 'Hello! I\'m FastestHR AI Assistant. I can help you with questions about leave, payroll, attendance, performance reviews, onboarding, and more. What would you like to know?',
  'hi': 'Hi there! 👋 I\'m your HR assistant. Ask me about any HR-related topic — leave policies, payroll, attendance, performance, documents, or anything else!',
  'help': 'I can help you with:\n• Leave & attendance policies\n• Payroll & salary questions\n• Performance & goals\n• Onboarding process\n• Document management\n• Help desk tickets\n• Exit & resignation process\n\nJust type your question!',
};

function getResponse(input: string): string {
  const lower = input.toLowerCase();

  for (const [keyword, response] of Object.entries(hrKnowledge)) {
    if (lower.includes(keyword)) return response;
  }

  if (lower.includes('salary') || lower.includes('pay') || lower.includes('compensation')) {
    return hrKnowledge['payroll'];
  }
  if (lower.includes('time off') || lower.includes('vacation') || lower.includes('pto')) {
    return hrKnowledge['leave'];
  }
  if (lower.includes('goal') || lower.includes('review') || lower.includes('appraisal')) {
    return hrKnowledge['performance'];
  }
  if (lower.includes('quit') || lower.includes('resign') || lower.includes('exit') || lower.includes('leaving')) {
    return hrKnowledge['resignation'];
  }
  if (lower.includes('course') || lower.includes('learn') || lower.includes('train')) {
    return hrKnowledge['training'];
  }
  if (lower.includes('ticket') || lower.includes('support') || lower.includes('issue')) {
    return hrKnowledge['helpdesk'];
  }

  return "I'm not sure about that specific topic. I can help with leave, payroll, attendance, performance, onboarding, documents, help desk tickets, and exit management. Could you rephrase your question?";
}

export function AIAssistant() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! 👋 I'm your FastestHR AI Assistant. Ask me anything about HR policies, leave, payroll, attendance, or any other HR topic!",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate thinking delay
    setTimeout(() => {
      const response = getResponse(input);
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
    }, 500);
  };

  if (!open) {
    return (
      <div className={`fixed right-6 z-50 ${isMobile ? 'bottom-24' : 'bottom-6'}`}>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
          aria-label="Open HR AI Assistant"
          title="Open HR AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 animate-in fade-in slide-in-from-bottom-4 ${isMobile ? 'bottom-20 right-3 left-3' : 'bottom-6 right-6'}`}>
      <Card className={`shadow-2xl border-primary/20 ${isMobile ? 'w-full' : 'w-80 sm:w-96'}`}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-primary/5 rounded-t-lg">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span>HR AI Assistant</span>
            <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Online</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close AI Assistant" title="Close AI Assistant">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`p-1.5 rounded-full h-7 w-7 flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                  {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'assistant' ? 'bg-muted/50 text-foreground' : 'bg-primary text-primary-foreground'}`}>
                  <p className="whitespace-pre-line">{msg.content}</p>
                  <span className="text-[10px] opacity-60 mt-1 block">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border/50 p-3 flex gap-2">
            <Input
              placeholder="Ask about HR policies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              className="text-sm"
              autoFocus
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim()} aria-label="Send message" title="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
