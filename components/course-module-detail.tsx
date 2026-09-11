'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type CourseModule, type CourseTutorMessage, type CourseModuleContent } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Check, ArrowLeft, Play, MessageSquare, Sparkles, User } from 'lucide-react';
import { useTimer, formatDuration } from '@/lib/timer/context';

type CourseModuleDetailProps = {
  module: CourseModule;
  onBack: () => void;
  onModuleCompleted: () => void;
};

export function CourseModuleDetail({ module, onBack, onModuleCompleted }: CourseModuleDetailProps) {
  const { running, startSession, completeSession } = useTimer();
  const [tutorMessages, setTutorMessages] = useState<CourseTutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isThisModuleRunning = running?.kind === 'course' && running?.course_name === module.course_name;
  const content = module.content_json as CourseModuleContent;

  const fetchTutorMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('course_tutor_messages')
      .select('*')
      .eq('module_id', module.id)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else setTutorMessages(data ?? []);
  }, [module.id]);

  useEffect(() => {
    fetchTutorMessages();
  }, [fetchTutorMessages]);

  useEffect(() => {
    if (isThisModuleRunning && running) {
      const start = new Date(running.started_at).getTime();
      const update = () => setElapsed(Date.now() - start);
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [isThisModuleRunning, running]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [tutorMessages]);

  async function handleStartTimer() {
    setError(null);
    try {
      await startSession('course', {
        course_name: module.course_name,
        note: `Module ${module.module_number}: ${module.title}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    }
  }

  async function handleCompleteModule() {
    setCompleting(true);
    setError(null);
    try {
      if (isThisModuleRunning) await completeSession();

      const { error: updateError } = await supabase
        .from('course_modules')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', module.id);
      if (updateError) throw new Error(updateError.message);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        fetch('/api/course/next-module', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ moduleId: module.id, courseName: module.course_name }),
        }).catch((err) => console.error('Failed to generate next module:', err));
      }

      onModuleCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete module');
    } finally {
      setCompleting(false);
    }
  }

  async function handleSendTutor() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setInput('');

    const tempMsg: CourseTutorMessage = {
      id: 'temp-' + Date.now(),
      user_id: '',
      module_id: module.id,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setTutorMessages((prev) => [...prev, tempMsg]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/course/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ message: trimmed, moduleId: module.id, courseName: module.course_name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const tempAssistant: CourseTutorMessage = {
        id: 'temp-a-' + Date.now(),
        user_id: '',
        module_id: module.id,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, tempAssistant]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      setTutorMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTutor();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Module {module.module_number}</span>
            {module.completed && (
              <Badge className="text-[10px] bg-success/10 text-success border-success/20">
                <Check className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-semibold">{module.title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        {isThisModuleRunning ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                {formatDuration(elapsed)}
              </span>
              <span className="text-xs text-muted-foreground">studying {module.course_name}</span>
            </div>
            <div className="flex-1" />
            {!module.completed && (
              <Button size="sm" onClick={handleCompleteModule} disabled={completing}>
                {completing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                Complete module
              </Button>
            )}
          </>
        ) : module.completed ? (
          <p className="text-sm text-muted-foreground">Module completed</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Ready to study this module?</p>
            <div className="flex-1" />
            <Button size="sm" onClick={handleStartTimer} disabled={!!running}>
              <Play className="mr-2 h-3.5 w-3.5" />
              Start studying
            </Button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <CourseModuleContentDisplay content={content} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            AI Tutor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-64 min-h-[100px] space-y-3 overflow-y-auto p-4">
            {tutorMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ask about this module, request a different explanation, or check your
                understanding of a concept.
              </p>
            ) : (
              tutorMessages.map((msg) => <TutorBubble key={msg.id} msg={msg} />)
            )}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this module..."
                rows={1}
                className="min-h-[40px] max-h-32 resize-none"
                disabled={sending}
              />
              <Button size="icon" onClick={handleSendTutor} disabled={!input.trim() || sending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CourseModuleContentDisplay({ content }: { content: CourseModuleContent }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {content.intro && (
          <p className="text-sm text-muted-foreground leading-relaxed">{content.intro}</p>
        )}

        {content.key_points && content.key_points.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Key points</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {content.key_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {content.terms && content.terms.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Key terms</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {content.terms.map((t, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{t.term}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{t.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.lab_or_exercise && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Exercise</h4>
            <p className="text-sm leading-relaxed rounded-lg border border-border p-3">{content.lab_or_exercise}</p>
          </div>
        )}

        {content.practice_questions && content.practice_questions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Check your understanding</h4>
            <div className="space-y-2">
              {content.practice_questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-1 text-muted-foreground">{q.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.resources && content.resources.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Go further</h4>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {content.resources.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TutorBubble({ msg }: { msg: CourseTutorMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-secondary' : 'bg-primary'
      }`}>
        {isUser ? (
          <User className="h-3 w-3 text-secondary-foreground" />
        ) : (
          <Sparkles className="h-3 w-3 text-primary-foreground" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
        isUser ? 'bg-secondary text-secondary-foreground' : 'bg-card border border-border'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
    </div>
  );
}
