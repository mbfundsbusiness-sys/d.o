import { callGemini } from '@/lib/gemini';
import type { LangQuestionType, ModuleContent } from '@/lib/supabase/client';

export type RawQuestion = {
  question_type: LangQuestionType;
  prompt: string;
  options: string[] | null;
  correct_answer: string;
  acceptable_answers?: string[];
  explanation?: string;
  hint?: string;
  difficulty?: number;
};

function systemPrompt(difficulty: number): string {
  return `You are a language-lesson question generator. Given one lesson's teaching
content and a target difficulty, generate ONE practice question strictly
about THIS lesson's material — do not introduce vocabulary or grammar that
isn't in the provided content.

Target difficulty: ${difficulty}/5, where:
1 = basic recognition (very short, obvious context)
2 = basic recall (short, one concept)
3 = independent production (no multiple choice hints, a full short sentence)
4 = contextual application (a realistic scenario, less scaffolding)
5 = complex application (combines this lesson's concept with a plausible
    everyday context, minimal scaffolding, no hand-holding)

Return ONE JSON object:
{
  "question_type": "multiple_choice" | "translation" | "fill_blank",
  "prompt": string,
  "options": string[] | null,   // exactly 4 options, ONLY for multiple_choice, else null
  "correct_answer": string,
  "acceptable_answers": string[], // other exact strings that should also count as correct, [] if none
  "explanation": string,   // one or two sentences, shown when the learner gets it wrong
  "hint": string,          // a small clue, not the answer
  "difficulty": ${difficulty}
}

Rules:
- Prefer "multiple_choice" at difficulty 1-2, "fill_blank" or "translation" at
  difficulty 3+ (less scaffolding as difficulty rises).
- For "multiple_choice": options must include the correct_answer plus 3
  plausible but wrong choices in the SAME language as the correct_answer.
- For "translation": prompt is an English sentence/phrase, correct_answer is
  the target-language translation.
- For "fill_blank": prompt contains a blank written as "___", correct_answer
  is only the missing word/phrase (not the full sentence).
- The correct_answer must be unambiguous and directly supported by the
  lesson content provided.
- Return ONLY the JSON object, no other text, no markdown fences.`;
}

function validate(q: unknown): q is RawQuestion {
  const r = q as RawQuestion;
  if (!r || typeof r.prompt !== 'string' || !r.prompt.trim()) return false;
  if (!['multiple_choice', 'translation', 'fill_blank'].includes(r.question_type)) return false;
  if (typeof r.correct_answer !== 'string' || !r.correct_answer.trim()) return false;
  if (r.question_type === 'multiple_choice') {
    if (!Array.isArray(r.options) || r.options.length < 2) return false;
    if (!r.options.includes(r.correct_answer)) return false;
  }
  return true;
}

/**
 * Generates one validated question at the given difficulty, grounded in the
 * lesson's own content. Retries once on a malformed response before giving
 * up (the caller should fall back to a safe default if this throws).
 */
export async function generateOneQuestion({
  apiKey,
  language,
  lessonTitle,
  focusArea,
  contentJson,
  difficulty,
  avoidPrompts,
}: {
  apiKey: string;
  language: string;
  lessonTitle: string;
  focusArea: string;
  contentJson: ModuleContent;
  difficulty: number;
  avoidPrompts: string[];
}): Promise<RawQuestion> {
  const userMessage = `Language: ${language}
Lesson: ${lessonTitle}
Focus area: ${focusArea}
Lesson content: ${JSON.stringify(contentJson)}
${avoidPrompts.length > 0 ? `\nAlready asked in this lesson — do not repeat these or trivial rewordings:\n${avoidPrompts.map((p) => `- ${p}`).join('\n')}` : ''}

Return ONLY the JSON object for one new question at difficulty ${difficulty}.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const rawText = await callGemini({
      apiKey,
      system: systemPrompt(difficulty),
      maxOutputTokens: 1024,
      messages: [{ role: 'user', content: userMessage }],
    });

    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (validate(parsed)) return parsed;
    } catch {
      // fall through to retry
    }
  }

  throw new Error('Failed to generate a valid question');
}
