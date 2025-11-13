
'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getAllReceipts, getAllReceiptsForUser, getReceiptsForManager } from '@/lib/receipt-store';
import { runAssistant } from '@/ai/flows/assistant-flow';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Loader2, Send, User, UploadCloud } from 'lucide-react';
import type { ProcessedReceipt } from '@/types';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        setMessages([
          {
            id: 'init',
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! I am your AI assistant. How can I help you today?`,
          },
        ]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isResponding) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsResponding(true);

    try {
      let relevantReceipts: ProcessedReceipt[];

      if (user.role === 'admin') {
        relevantReceipts = await getAllReceipts();
      } else if (user.role === 'manager') {
        relevantReceipts = await getReceiptsForManager(user.id);
      } else {
        relevantReceipts = await getAllReceiptsForUser(user.email);
      }

      const receiptHistoryString = JSON.stringify(
        relevantReceipts.map(r => ({ 
            fileName: r.fileName, 
            status: r.status || (r.isFraudulent ? 'flagged' : 'clear'), 
            uploaded_at: r.uploadedAt,
            uploadedBy: r.uploadedBy 
        }))
      );

      const result = await runAssistant(input, receiptHistoryString);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
      };

      if (result.suggestUpload && user.role === 'employee') {
        assistantMessage.action = {
          label: 'Upload a Receipt',
          onClick: () => {
            router.push('/employee/upload');
            onClose();
          },
        };
      }
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chatbot error:', error);
      // runAssistant already handles errors and returns user-friendly messages
      // This catch is for unexpected errors outside of runAssistant
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, but I encountered an unexpected error. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-lg flex flex-col p-0 bg-background">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-headline flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">AI Assistant</div>
              <div className="text-sm text-muted-foreground font-normal">
                Ask anything about your expenses
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="p-2 rounded-full bg-primary/10 text-primary flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] origin-button ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                  {message.action && (
                    <Button
                      onClick={message.action.onClick}
                      variant="secondary"
                      size="sm"
                      className="mt-3 origin-button"
                    >
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {message.action.label}
                    </Button>
                  )}
                </div>
                 {message.role === 'user' && (
                  <div className="p-2 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isResponding && (
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        <Bot className="w-4 h-4" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border text-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="p-4 border-t border-border bg-background">
          <form onSubmit={handleSubmit} className="w-full flex items-center gap-3">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your expenses..."
                className="min-h-0 flex-1 resize-none rounded-2xl border-border focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isResponding}
              />
            </div>
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isResponding}
              className="origin-button rounded-full h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

    