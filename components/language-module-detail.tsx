'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type LanguageModule, type LanguageTutorMessage, type ModuleContent, type ModuleFocusArea } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Check, ArrowLeft, Play, Square, MessageSquare, Sparkles, User } from 'lucide-react';
import { useTimer, formatDuration } from '@/lib/timer/context';
import { FOCUS_LABELS } from '@/components/language-module-list';
import { SpeakButton } from '@/components/speak-button';
import { LanguageLessonPlayer } from '@/components/language-lesson-player';

type ModuleDetailProps = {
  module: LanguageModule;
  onBack: () => void;
  onModuleCompleted: () => void;
};

export function ModuleDetail({ module, onBack, onModuleCompleted }: ModuleDetailProps) {
  const { running, startSession, completeSession } = useTimer();
  const [tutorMessages, setTutorMessages] = useState<LanguageTutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isThisModuleRunning = running?.kind === 'language' && running?.language === module.language;
  const focusArea = module.focus_area as ModuleFocusArea;
  const content = module.content_json as ModuleContent;

  const fetchTutorMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('language_tutor_messages')
      .select('*')
      .eq('module_id', module.id)
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setTutorMessages(data ?? []);
    }
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tutorMessages]);

  async function handleStartTimer() {
    setError(null);
    try {
      await startSession('language', {
        language: module.language,
        activity_type: module.focus_area,
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
      // Complete timer if running
      if (isThisModuleRunning) {
        await completeSession();
      }

      // Mark module as completed
      const { error: updateError } = await supabase
        .from('language_modules')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', module.id);

      if (updateError) throw new Error(updateError.message);

      // Generate next module via API
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        fetch('/api/language/next-module', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ moduleId: module.id, language: module.language }),
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

    const tempMsg: LanguageTutorMessage = {
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

      const res = await fetch('/api/language/tutor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: trimmed, moduleId: module.id, language: module.language }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const tempAssistant: LanguageTutorMessage = {
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Module {module.module_number}</span>
            <Badge variant="secondary" className="text-[10px]">
              {FOCUS_LABELS[focusArea]}
            </Badge>
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

      {/* Timer bar */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        {isThisModuleRunning ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                {formatDuration(elapsed)}
              </span>
              <span className="text-xs text-muted-foreground">studying {module.language}</span>
            </div>
            <div className="flex-1" />
            {!module.completed && !showPlayer && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowPlayer(true)}>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Practice lesson
                </Button>
                <Button size="sm" onClick={handleCompleteModule} disabled={completing}>
                  {completing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                  Mark complete
                </Button>
              </>
            )}
          </>
        ) : module.completed ? (
          <p className="text-sm text-muted-foreground">Module completed</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Ready to study this module?</p>
            <div className="flex-1" />
            {!showPlayer && (
              <>
                <Button size="sm" onClick={() => setShowPlayer(true)}>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Practice lesson
                </Button>
                <Button size="sm" variant="outline" onClick={handleStartTimer} disabled={!!running}>
                  <Play className="mr-2 h-3.5 w-3.5" />
                  Start studying
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showPlayer && !module.completed && (
        <LanguageLessonPlayer
          lessonId={module.id}
          language={module.language}
          onExit={() => setShowPlayer(false)}
          onPassed={async () => {
            await handleCompleteModule();
            setShowPlayer(false);
          }}
        />
      )}

      {/* Module content */}
      <ModuleContentDisplay content={content} focusArea={focusArea} language={module.language} />

      {/* Tutor chat */}
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
                Ask the tutor a question about this module, request more examples,
                or have it check something you wrote in {module.language}.
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
                placeholder={`Ask about this module, or write in ${module.language} for corrections...`}
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

function ModuleContentDisplay({
  content,
  focusArea,
  language,
}: {
  content: ModuleContent;
  focusArea: ModuleFocusArea;
  language: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {content.intro && (
          <p className="text-sm text-muted-foreground leading-relaxed">{content.intro}</p>
        )}

        {/* Vocabulary */}
        {content.words && content.words.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Vocabulary</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {content.words.map((w, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {w.word}
                      <SpeakButton text={w.word} language={language} />
                    </span>
                    <span className="text-xs text-muted-foreground">{w.translation}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs italic text-muted-foreground">
                    {w.example}
                    <SpeakButton text={w.example} language={language} />
                  </p>
                  <p className="text-xs text-muted-foreground/70">{w.example_translation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar */}
        {content.rule && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Grammar Rule</h4>
            <p className="text-sm leading-relaxed">{content.rule}</p>
          </div>
        )}

        {content.practice_sentences && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Practice</h4>
            <div className="space-y-2">
              {Array.isArray(content.practice_sentences) ? (
                content.practice_sentences.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{p.prompt}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      {p.answer}
                      <SpeakButton text={p.answer} language={language} />
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{content.practice_sentences.prompt}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                    {content.practice_sentences.answer}
                    <SpeakButton text={content.practice_sentences.answer} language={language} />
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Speaking */}
        {content.speaking_prompts && content.speaking_prompts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Speaking Prompts</h4>
            <p className="text-xs text-muted-foreground">Respond to these in {focusArea === 'speaking' ? 'the target language' : 'your own words'}:</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {content.speaking_prompts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Listening */}
        {content.listening_prompt && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Listening Exercise</h4>
            <p className="flex items-start gap-1.5 text-sm leading-relaxed italic">
              {content.listening_prompt}
              <SpeakButton text={content.listening_prompt} language={language} />
            </p>
            {content.tips && content.tips.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tips:</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {content.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Reading */}
        {content.reading_text && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Reading Passage</h4>
            <p className="flex items-start gap-1.5 text-sm leading-relaxed">
              {content.reading_text}
              <SpeakButton text={content.reading_text} language={language} />
            </p>
            {content.reading_questions && content.reading_questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Comprehension questions:</p>
                {content.reading_questions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{q.question}</p>
                    <p className="mt-1 text-muted-foreground">{q.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TutorBubble({ msg }: { msg: LanguageTutorMessage }) {
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
        isUser
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-card border border-border'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
    </div>
  );
}
